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
import '../../../shared/widgets/theme_mode_button.dart';
import '../../pantry/application/pantry_provider.dart';
import '../../pantry/presentation/pantry_selector_screen.dart';
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
  }

  @override
  Widget build(BuildContext context) {
    final recipes = ref.watch(recipesStreamProvider);
    final pantry = ref.watch(pantrySelectionProvider);

    return ContentScaffold(
      appBar: AppBar(
        title: const BrandWordmark(height: 52),
        actions: const [ThemeModeButton()],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          Navigator.of(context).push(
            MaterialPageRoute<void>(builder: (_) => const RecipeFormScreen()),
          );
        },
        child: const Icon(Icons.add),
      ),
      body: recipes.when(
        data: (recipesData) => pantry.when(
          data: (selectedIngredients) {
            final colorScheme = Theme.of(context).colorScheme;
            final bottomInset = MediaQuery.paddingOf(context).bottom;
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

            return ListView(
              padding: EdgeInsets.fromLTRB(16, 8, 16, 116 + bottomInset),
              children: [
                SectionCard(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Expanded(child: BrandWordmark(height: 58)),
                          if (selectedIngredients.isNotEmpty)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 6,
                              ),
                              decoration: BoxDecoration(
                                color: colorScheme.secondaryContainer,
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                '${selectedIngredients.length} doma',
                                style: Theme.of(context).textTheme.labelMedium
                                    ?.copyWith(
                                      color: colorScheme.onSecondaryContainer,
                                      fontWeight: FontWeight.w700,
                                    ),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      SearchInput(
                        controller: _searchController,
                        hintText: 'Hledat recept nebo ingredienci',
                        onChanged: (_) => setState(() {}),
                      ),
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        crossAxisAlignment: WrapCrossAlignment.center,
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
                                  : 'Upravit domácí zásoby',
                            ),
                          ),
                          SegmentedButton<RecipeMatchMode>(
                            segments: const [
                              ButtonSegment(
                                value: RecipeMatchMode.full,
                                label: Text('Celé'),
                              ),
                              ButtonSegment(
                                value: RecipeMatchMode.partial,
                                label: Text('Částečné'),
                              ),
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
                const SizedBox(height: 14),
                if (filtered.isEmpty)
                  EmptyStateView(
                    icon: Icons.menu_book_outlined,
                    title: recipesData.isEmpty
                        ? 'Zatím tu nic není'
                        : 'Nic neodpovídá filtru',
                    message: recipesData.isEmpty
                        ? 'Přidej první recept a aplikace začne fungovat naplno.'
                        : 'Zkus upravit hledání nebo výběr ingrediencí, které máš doma.',
                  )
                else
                  for (var index = 0; index < filtered.length; index++) ...[
                    _RecipeCard(
                      recipe: filtered[index].key,
                      mode: _mode,
                      match: filtered[index].value,
                      onOpen: () {
                        Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) =>
                                RecipeDetailScreen(recipe: filtered[index].key),
                          ),
                        );
                      },
                      onIncrement: () async {
                        await ref
                            .read(recipeRepositoryProvider)
                            .incrementCookingCount(filtered[index].key);
                      },
                      onEditCount: () async {
                        final recipe = filtered[index].key;
                        final count = await showCountEditDialog(
                          context,
                          recipe.cookingCount,
                        );
                        if (count == null) {
                          return;
                        }
                        await ref
                            .read(recipeRepositoryProvider)
                            .setCookingCount(recipe, count);
                      },
                      onEdit: () {
                        Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) =>
                                RecipeFormScreen(recipe: filtered[index].key),
                          ),
                        );
                      },
                      onDelete: () => _deleteRecipe(filtered[index].key),
                    ),
                    if (index != filtered.length - 1)
                      const SizedBox(height: 14),
                  ],
              ],
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
    final colorScheme = Theme.of(context).colorScheme;
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
                        style: Theme.of(
                          context,
                        ).textTheme.titleLarge?.copyWith(fontSize: 22),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '${recipe.ingredients.length} ingrediencí',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: colorScheme.onSurfaceVariant,
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
            if (mode == RecipeMatchMode.partial &&
                match.missingIngredients.isNotEmpty) ...[
              const SizedBox(height: 14),
              Text(
                'Chybí: ${match.missingIngredients.map(IngredientNameFormatter.prettify).join(', ')}',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: colorScheme.error,
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
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.local_fire_department_outlined,
            size: 16,
            color: colorScheme.primary,
          ),
          const SizedBox(width: 6),
          Text('${count}x'),
          const SizedBox(width: 6),
          InkWell(
            onTap: onIncrement,
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: 4),
              child: Icon(
                Icons.add_circle,
                size: 18,
                color: colorScheme.primary,
              ),
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
