import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/utils/ingredient_name_formatter.dart';
import '../../../core/utils/text_normalizer.dart';
import '../../../data/db/repository_providers.dart';
import '../../../data/models/ingredient_entity.dart';
import '../../../shared/widgets/content_scaffold.dart';
import '../../../shared/widgets/empty_state_view.dart';
import '../../../shared/widgets/filter_pill.dart';
import '../../../shared/widgets/search_input.dart';
import '../../../shared/widgets/section_card.dart';
import '../application/ingredients_provider.dart';
import 'ingredient_editor_dialog.dart';

class IngredientsScreen extends ConsumerStatefulWidget {
  const IngredientsScreen({super.key});

  @override
  ConsumerState<IngredientsScreen> createState() => _IngredientsScreenState();
}

class _IngredientsScreenState extends ConsumerState<IngredientsScreen> {
  final TextEditingController _searchController = TextEditingController();
  bool _favoritesOnly = false;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _confirmDelete(IngredientEntity ingredient) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Smazat ingredienci?'),
        content: Text(
          'Ingredience "${IngredientNameFormatter.prettify(ingredient.name)}" bude odstraněná ze seznamu.',
        ),
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

    await ref.read(ingredientRepositoryProvider).delete(ingredient);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Ingredience byla smazaná.')),
      );
    }
  }

  List<_IngredientListEntry> _buildEntries(List<IngredientEntity> ingredients) {
    final query = TextNormalizer.normalize(_searchController.text);
    final filtered = ingredients.where((ingredient) {
      final matchesFavorites = !_favoritesOnly || ingredient.isFavorite;
      final matchesQuery = query.isEmpty || ingredient.normalizedName.contains(query);
      return matchesFavorites && matchesQuery;
    }).toList();

    final entries = <_IngredientListEntry>[];
    String? currentLetter;
    for (final ingredient in filtered) {
      if (ingredient.firstLetter != currentLetter) {
        currentLetter = ingredient.firstLetter;
        entries.add(_HeaderEntry(currentLetter));
      }
      entries.add(_ItemEntry(ingredient));
    }
    return entries;
  }

  @override
  Widget build(BuildContext context) {
    final ingredients = ref.watch(ingredientsStreamProvider);
    return ContentScaffold(
      appBar: AppBar(
        title: const Text('Ingredience'),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => showIngredientEditorDialog(context, ref),
        child: const Icon(Icons.add),
      ),
      body: ingredients.when(
        data: (items) {
          final entries = _buildEntries(items);
          return Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 88),
            child: Column(
              children: [
                SectionCard(
                  child: Column(
                    children: [
                      SearchInput(
                        controller: _searchController,
                        hintText: 'Hledat ingredienci',
                        onChanged: (_) => setState(() {}),
                      ),
                      const SizedBox(height: 14),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          FilterPill(
                            selected: !_favoritesOnly,
                            label: 'Vše',
                            icon: Icons.check,
                            onTap: () => setState(() => _favoritesOnly = false),
                          ),
                          FilterPill(
                            selected: _favoritesOnly,
                            label: 'Oblíbené',
                            icon: Icons.favorite,
                            onTap: () => setState(() => _favoritesOnly = true),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Expanded(
                  child: entries.isEmpty
                      ? EmptyStateView(
                          icon: Icons.restaurant_outlined,
                          title: 'Nic se nenašlo',
                          message: 'Zkus upravit hledání nebo přidej novou ingredienci.',
                          action: FilledButton.icon(
                            onPressed: () => showIngredientEditorDialog(context, ref),
                            icon: const Icon(Icons.add),
                            label: const Text('Přidat ingredienci'),
                          ),
                        )
                      : SectionCard(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          child: ListView.builder(
                            itemCount: entries.length,
                            itemBuilder: (context, index) {
                              final entry = entries[index];
                              if (entry is _HeaderEntry) {
                                return Padding(
                                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
                                  child: Text(
                                    entry.letter,
                                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                                          fontWeight: FontWeight.w700,
                                          fontSize: 12,
                                          letterSpacing: 1.6,
                                          color: const Color(0xFF8A706A),
                                        ),
                                  ),
                                );
                              }

                              final ingredient = (entry as _ItemEntry).ingredient;
                              return ListTile(
                                dense: true,
                                title: Text(IngredientNameFormatter.prettify(ingredient.name)),
                                leading: IconButton(
                                  onPressed: () async {
                                    await ref.read(ingredientRepositoryProvider).toggleFavorite(ingredient);
                                  },
                                  icon: Icon(
                                    ingredient.isFavorite ? Icons.favorite : Icons.favorite_border,
                                    color: ingredient.isFavorite ? const Color(0xFFC65670) : const Color(0xFF8A706A),
                                  ),
                                ),
                                trailing: PopupMenuButton<String>(
                                  onSelected: (value) async {
                                    if (value == 'edit') {
                                      await showIngredientEditorDialog(context, ref, ingredient: ingredient);
                                    } else if (value == 'delete') {
                                      await _confirmDelete(ingredient);
                                    }
                                  },
                                  itemBuilder: (context) => const [
                                    PopupMenuItem(value: 'edit', child: Text('Upravit')),
                                    PopupMenuItem(value: 'delete', child: Text('Smazat')),
                                  ],
                                ),
                              );
                            },
                          ),
                        ),
                ),
              ],
            ),
          );
        },
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

sealed class _IngredientListEntry {}

class _HeaderEntry extends _IngredientListEntry {
  _HeaderEntry(this.letter);

  final String letter;
}

class _ItemEntry extends _IngredientListEntry {
  _ItemEntry(this.ingredient);

  final IngredientEntity ingredient;
}
