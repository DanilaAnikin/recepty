import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_units.dart';
import '../../../core/utils/ingredient_name_formatter.dart';
import '../../../data/db/repository_providers.dart';
import '../../../data/models/recipe_entity.dart';
import '../../../shared/widgets/brand_wordmark.dart';
import '../../../shared/widgets/content_scaffold.dart';
import '../../../shared/widgets/empty_state_view.dart';
import '../../../shared/widgets/recipe_image_view.dart';
import '../../../shared/widgets/search_input.dart';
import '../../../shared/widgets/section_card.dart';
import '../../pantry/application/pantry_provider.dart';
import '../../pantry/presentation/pantry_selector_screen.dart';
import '../application/recipe_image_storage_provider.dart';
import '../application/recipe_match_result.dart';
import '../application/recipe_matcher.dart';
import '../application/recipes_provider.dart';
import 'count_edit_dialog.dart';
import 'recipe_detail_screen.dart';
import 'recipe_form_screen.dart';

class RecipesScreen extends ConsumerStatefulWidget {
  const RecipesScreen({super.key});

  @override
  ConsumerState<RecipesScreen> createState() => _RecipesScreenState();
}

class _RecipesScreenState extends ConsumerState<RecipesScreen> {
  final TextEditingController _searchController = TextEditingController();
  RecipeMatchMode _mode = RecipeMatchMode.full;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _deleteRecipe(RecipeEntity recipe) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Smazat recept?'),
        content: Text('Recept "${recipe.title}" bude trvale odstraněný.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Zrušit'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Smazat'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) {
      return;
    }
    await ref.read(recipeRepositoryProvider).delete(recipe.id);
    await ref.read(recipeImageStorageProvider).deleteIfExists(recipe.imagePath);
  }

  @override
  Widget build(BuildContext context) {
    final recipes = ref.watch(recipesStreamProvider);
    final pantry = ref.watch(pantrySelectionProvider);

    return ContentScaffold(
      appBar: AppBar(
        title: const BrandWordmark(height: 34),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => const RecipeFormScreen(),
            ),
          );
        },
        child: const Icon(Icons.add),
      ),
      body: recipes.when(
        data: (recipesData) => pantry.when(
          data: (selectedIngredients) {
            final filtered = recipesData
                .map(
                  (recipe) => MapEntry(
                    recipe,
                    RecipeMatcher.evaluate(
                      recipe: recipe,
                      selectedIngredientIds: selectedIngredients,
                      query: _searchController.text,
                      mode: _mode,
                    ),
                  ),
                )
                .where((entry) => entry.value.matches)
                .toList();

            return Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 92),
              child: Column(
                children: [
                  SectionCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const BrandWordmark(height: 46),
                        const SizedBox(height: 12),
                        Text(
                          'Vař z toho, co máš doma',
                          style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontSize: 28),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Hledej recepty podle názvu i ingrediencí a přepínej mezi úplnou a částečnou shodou.',
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                color: const Color(0xFF6E5C57),
                              ),
                        ),
                        const SizedBox(height: 16),
                        SearchInput(
                          controller: _searchController,
                          hintText: 'Hledat recept nebo ingredienci',
                          onChanged: (_) => setState(() {}),
                        ),
                        const SizedBox(height: 14),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            OutlinedButton.icon(
                              onPressed: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute<void>(
                                    builder: (_) => const PantrySelectorScreen(),
                                  ),
                                );
                              },
                              icon: const Icon(Icons.shopping_basket_outlined),
                              label: Text(
                                selectedIngredients.isEmpty
                                    ? 'Vybrat ingredience'
                                    : '${selectedIngredients.length} doma',
                              ),
                            ),
                            SegmentedButton<RecipeMatchMode>(
                              segments: const [
                                ButtonSegment(value: RecipeMatchMode.full, label: Text('Celé')),
                                ButtonSegment(value: RecipeMatchMode.partial, label: Text('Částečné')),
                              ],
                              selected: {_mode},
                              onSelectionChanged: (selection) {
                                setState(() => _mode = selection.first);
                              },
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Expanded(
                    child: filtered.isEmpty
                        ? EmptyStateView(
                            icon: Icons.menu_book_outlined,
                            title: recipesData.isEmpty ? 'Zatím tu nic není' : 'Nic neodpovídá filtru',
                            message: recipesData.isEmpty
                                ? 'Přidej první recept a aplikace začne fungovat naplno.'
                                : 'Zkus upravit hledání nebo výběr ingrediencí, které máš doma.',
                          )
                        : ListView.separated(
                            itemCount: filtered.length,
                            separatorBuilder: (_, _) => const SizedBox(height: 14),
                            itemBuilder: (context, index) {
                              final recipe = filtered[index].key;
                              final match = filtered[index].value;
                              return _RecipeCard(
                                recipe: recipe,
                                mode: _mode,
                                match: match,
                                onOpen: () {
                                  Navigator.of(context).push(
                                    MaterialPageRoute<void>(
                                      builder: (_) => RecipeDetailScreen(recipe: recipe),
                                    ),
                                  );
                                },
                                onIncrement: () async {
                                  await ref.read(recipeRepositoryProvider).incrementCookingCount(recipe);
                                },
                                onEditCount: () async {
                                  final count = await showCountEditDialog(context, recipe.cookingCount);
                                  if (count == null) {
                                    return;
                                  }
                                  await ref.read(recipeRepositoryProvider).setCookingCount(recipe, count);
                                },
                                onEdit: () {
                                  Navigator.of(context).push(
                                    MaterialPageRoute<void>(
                                      builder: (_) => RecipeFormScreen(recipe: recipe),
                                    ),
                                  );
                                },
                                onDelete: () => _deleteRecipe(recipe),
                              );
                            },
                          ),
                  ),
                ],
              ),
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => Center(child: Text('$error')),
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => EmptyStateView(
          icon: Icons.error_outline,
          title: 'Nastala chyba',
          message: '$error',
        ),
      ),
    );
  }
}

class _RecipeCard extends StatelessWidget {
  const _RecipeCard({
    required this.recipe,
    required this.mode,
    required this.match,
    required this.onOpen,
    required this.onIncrement,
    required this.onEditCount,
    required this.onEdit,
    required this.onDelete,
  });

  final RecipeEntity recipe;
  final RecipeMatchMode mode;
  final RecipeMatchResult match;
  final VoidCallback onOpen;
  final VoidCallback onIncrement;
  final VoidCallback onEditCount;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      padding: const EdgeInsets.all(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: onOpen,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _RecipeCardImage(imagePath: recipe.imagePath),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        recipe.title,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 22),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '${recipe.ingredients.length} ingrediencí',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: const Color(0xFF6E5C57),
                            ),
                      ),
                      const SizedBox(height: 10),
                      _CounterPill(
                        count: recipe.cookingCount,
                        onIncrement: onIncrement,
                        onEdit: onEditCount,
                      ),
                    ],
                  ),
                ),
                PopupMenuButton<String>(
                  onSelected: (value) {
                    if (value == 'edit') {
                      onEdit();
                    } else if (value == 'delete') {
                      onDelete();
                    }
                  },
                  itemBuilder: (context) => const [
                    PopupMenuItem(value: 'edit', child: Text('Upravit')),
                    PopupMenuItem(value: 'delete', child: Text('Smazat')),
                  ],
                ),
              ],
            ),
            if (mode == RecipeMatchMode.partial && match.missingIngredients.isNotEmpty) ...[
              const SizedBox(height: 14),
              Text(
                'Chybí: ${match.missingIngredients.map(IngredientNameFormatter.prettify).join(', ')}',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: const Color(0xFFB63131),
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _RecipeCardImage extends StatelessWidget {
  const _RecipeCardImage({required this.imagePath});

  final String? imagePath;

  @override
  Widget build(BuildContext context) {
    return RecipeImageView(
      path: imagePath,
      width: 92,
      height: 92,
      borderRadius: 22,
      placeholderIcon: Icons.ramen_dining_outlined,
    );
  }
}

class _CounterPill extends StatelessWidget {
  const _CounterPill({
    required this.count,
    required this.onIncrement,
    required this.onEdit,
  });

  final int count;
  final VoidCallback onIncrement;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE0D1C8)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.local_fire_department_outlined, size: 16, color: Color(0xFFC65670)),
          const SizedBox(width: 6),
          Text('${count}x'),
          const SizedBox(width: 6),
          InkWell(
            onTap: onIncrement,
            child: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 4),
              child: Icon(Icons.add_circle, size: 18, color: Color(0xFFC65670)),
            ),
          ),
          InkWell(
            onTap: onEdit,
            child: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 4),
              child: Icon(Icons.edit_outlined, size: 16),
            ),
          ),
        ],
      ),
    );
  }
}
