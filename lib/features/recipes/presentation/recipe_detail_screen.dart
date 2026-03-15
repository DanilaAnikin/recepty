import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/utils/formatters.dart';
import '../../../core/utils/ingredient_name_formatter.dart';
import '../../../data/db/repository_providers.dart';
import '../../../data/models/recipe_entity.dart';
import '../../../shared/widgets/content_scaffold.dart';
import '../../../shared/widgets/recipe_image_view.dart';
import '../../../shared/widgets/section_card.dart';
import '../application/recipes_provider.dart';
import 'count_edit_dialog.dart';
import 'recipe_form_screen.dart';

class RecipeDetailScreen extends ConsumerWidget {
  const RecipeDetailScreen({required this.recipe, super.key});

  final RecipeEntity recipe;

  Future<void> _deleteRecipe(BuildContext context, WidgetRef ref, RecipeEntity currentRecipe) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Smazat recept?'),
        content: Text('Recept "${currentRecipe.title}" bude trvale odstraněný.'),
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
    if (confirmed != true || !context.mounted) {
      return;
    }
    await ref.read(recipeRepositoryProvider).delete(currentRecipe.id);
    if (context.mounted) {
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final liveRecipe = ref.watch(recipesStreamProvider).maybeWhen(
          data: (items) {
            for (final item in items) {
              if (item.id == recipe.id) {
                return item;
              }
            }
            return null;
          },
          orElse: () => recipe,
        );

    if (liveRecipe == null) {
      return const Scaffold(
        body: Center(child: Text('Recept už neexistuje.')),
      );
    }

    return ContentScaffold(
      appBar: AppBar(
        title: const Text('Detail receptu'),
        actions: [
          IconButton(
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => RecipeFormScreen(recipe: liveRecipe),
                ),
              );
            },
            icon: const Icon(Icons.edit_outlined),
          ),
          IconButton(
            onPressed: () => _deleteRecipe(context, ref, liveRecipe),
            icon: const Icon(Icons.delete_outline),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(liveRecipe.title, style: Theme.of(context).textTheme.headlineSmall),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              _MetaChip(
                                icon: Icons.restaurant_menu,
                                label: '${liveRecipe.ingredients.length} ingrediencí',
                              ),
                              _MetaChip(
                                icon: Icons.favorite,
                                label: '${liveRecipe.cookingCount}x uvařeno',
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    _DetailImage(imagePath: liveRecipe.imagePath),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    FilledButton.icon(
                      onPressed: () async {
                        await ref.read(recipeRepositoryProvider).incrementCookingCount(liveRecipe);
                      },
                      icon: const Icon(Icons.add),
                      label: const Text('Přidat vaření'),
                    ),
                    const SizedBox(width: 10),
                    OutlinedButton.icon(
                      onPressed: () async {
                        final count = await showCountEditDialog(context, liveRecipe.cookingCount);
                        if (count == null) {
                          return;
                        }
                        await ref.read(recipeRepositoryProvider).setCookingCount(liveRecipe, count);
                      },
                      icon: const Icon(Icons.tune),
                      label: const Text('Upravit počet'),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                    Text('Ingredience', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 10),
                for (final item in liveRecipe.ingredients)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Padding(
                          padding: EdgeInsets.only(top: 5),
                          child: Icon(Icons.circle, size: 8),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            '${IngredientNameFormatter.prettify(item.ingredientNameSnapshot)} - ${formatAmount(item.amount)} ${item.unit.label}',
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Postup', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 10),
                Text(
                  liveRecipe.description.isEmpty ? 'Zatím bez postupu.' : liveRecipe.description,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE0D1C8)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: const Color(0xFFC65670)),
          const SizedBox(width: 6),
          Text(label),
        ],
      ),
    );
  }
}

class _DetailImage extends StatelessWidget {
  const _DetailImage({required this.imagePath});

  final String? imagePath;

  @override
  Widget build(BuildContext context) {
    return RecipeImageView(
      path: imagePath,
      width: 112,
      height: 112,
      borderRadius: 22,
      placeholderIcon: Icons.photo_camera_back_outlined,
    );
  }
}
