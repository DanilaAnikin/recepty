import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/utils/ingredient_name_formatter.dart';
import '../../../core/utils/text_normalizer.dart';
import '../../../data/db/repository_providers.dart';
import '../../../data/models/ingredient_entity.dart';
import '../../../shared/widgets/content_scaffold.dart';
import '../../../shared/widgets/filter_pill.dart';
import '../../../shared/widgets/search_input.dart';
import '../../../shared/widgets/section_card.dart';
import '../../ingredients/application/ingredients_provider.dart';
import '../application/pantry_provider.dart';

class PantrySelectorScreen extends ConsumerStatefulWidget {
  const PantrySelectorScreen({super.key});

  @override
  ConsumerState<PantrySelectorScreen> createState() => _PantrySelectorScreenState();
}

class _PantrySelectorScreenState extends ConsumerState<PantrySelectorScreen> {
  final TextEditingController _searchController = TextEditingController();
  final Set<int> _draftSelection = {};
  bool _initialized = false;
  bool _favoritesOnly = false;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _initialize(Set<int> selection) {
    if (_initialized) {
      return;
    }
    _draftSelection
      ..clear()
      ..addAll(selection);
    _initialized = true;
  }

  List<IngredientEntity> _filterIngredients(List<IngredientEntity> ingredients) {
    final query = TextNormalizer.normalize(_searchController.text);
    return ingredients.where((item) {
      final matchesQuery = query.isEmpty || item.normalizedName.contains(query);
      final matchesFavorite = !_favoritesOnly || item.isFavorite;
      return matchesQuery && matchesFavorite;
    }).toList();
  }

  Future<void> _save() async {
    await ref.read(pantryRepositoryProvider).replaceSelection(_draftSelection);
    if (mounted) {
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final ingredients = ref.watch(ingredientsStreamProvider);
    final pantrySelection = ref.watch(pantrySelectionProvider);
    return pantrySelection.when(
      data: (selected) {
        _initialize(selected);
        return ContentScaffold(
          appBar: AppBar(
            title: const Text('Co máš doma'),
            actions: [
              TextButton(
                onPressed: _save,
                child: const Text('Uložit'),
              ),
            ],
          ),
          body: ingredients.when(
            data: (items) {
              final filtered = _filterIngredients(items);
              return Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
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
                              FilterPill(
                                selected: false,
                                label: 'Vymazat výběr',
                                icon: Icons.clear,
                                onTap: () => setState(_draftSelection.clear),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    Expanded(
                      child: SectionCard(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: ListView.builder(
                          itemCount: filtered.length,
                          itemBuilder: (context, index) {
                            final item = filtered[index];
                            final selected = _draftSelection.contains(item.id);
                            return CheckboxListTile(
                              value: selected,
                              title: Text(IngredientNameFormatter.prettify(item.name)),
                              secondary: item.isFavorite
                                  ? const Icon(Icons.favorite, color: Color(0xFFC65670))
                                  : null,
                              controlAffinity: ListTileControlAffinity.leading,
                              onChanged: (_) {
                                setState(() {
                                  if (selected) {
                                    _draftSelection.remove(item.id);
                                  } else {
                                    _draftSelection.add(item.id);
                                  }
                                });
                              },
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
            error: (error, _) => Center(child: Text('$error')),
          ),
        );
      },
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (error, _) => Scaffold(body: Center(child: Text('$error'))),
    );
  }
}
