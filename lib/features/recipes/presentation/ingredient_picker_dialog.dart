import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/utils/ingredient_name_formatter.dart';
import '../../../core/utils/text_normalizer.dart';
import '../../../data/models/ingredient_entity.dart';
import '../../../shared/widgets/filter_pill.dart';
import '../../../shared/widgets/search_input.dart';
import '../../ingredients/application/ingredients_provider.dart';

Future<IngredientEntity?> showIngredientPickerDialog(BuildContext context) {
  return showDialog<IngredientEntity>(
    context: context,
    builder: (context) => const IngredientPickerDialog(),
  );
}

class IngredientPickerDialog extends ConsumerStatefulWidget {
  const IngredientPickerDialog({super.key});

  @override
  ConsumerState<IngredientPickerDialog> createState() => _IngredientPickerDialogState();
}

class _IngredientPickerDialogState extends ConsumerState<IngredientPickerDialog> {
  final TextEditingController _searchController = TextEditingController();
  bool _favoritesOnly = false;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ingredients = ref.watch(ingredientsStreamProvider);
    return AlertDialog(
      title: const Text('Vyber ingredienci'),
      content: SizedBox(
        width: 420,
        height: 480,
        child: ingredients.when(
          data: (items) {
            final query = TextNormalizer.normalize(_searchController.text);
            final filtered = items.where((item) {
              final matchesFavorites = !_favoritesOnly || item.isFavorite;
              final matchesQuery = query.isEmpty || item.normalizedName.contains(query);
              return matchesFavorites && matchesQuery;
            }).toList();

            return Column(
              children: [
                SearchInput(
                  controller: _searchController,
                  hintText: 'Hledat ingredienci',
                  onChanged: (_) => setState(() {}),
                ),
                const SizedBox(height: 10),
                Row(
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
                const SizedBox(height: 10),
                Expanded(
                  child: ListView.builder(
                    itemCount: filtered.length,
                    itemBuilder: (context, index) {
                      final item = filtered[index];
                      return ListTile(
                        title: Text(IngredientNameFormatter.prettify(item.name)),
                        trailing: item.isFavorite
                            ? const Icon(Icons.favorite, color: Color(0xFFC65670))
                            : null,
                        onTap: () => Navigator.of(context).pop(item),
                      );
                    },
                  ),
                ),
              ],
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => Center(child: Text('$error')),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Zavřít'),
        ),
      ],
    );
  }
}
