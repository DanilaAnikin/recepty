import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/constants/app_units.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/ingredient_name_formatter.dart';
import '../../../core/utils/text_normalizer.dart';
import '../../../data/db/repository_providers.dart';
import '../../../data/models/ingredient_entity.dart';
import '../../../data/models/recipe_entity.dart';
import '../../../shared/widgets/content_scaffold.dart';
import '../../../shared/widgets/recipe_image_view.dart';
import '../../../shared/widgets/section_card.dart';
import '../../ingredients/application/ingredients_provider.dart';
import '../application/recipe_image_storage_provider.dart';
import 'ingredient_picker_dialog.dart';

class RecipeFormScreen extends ConsumerStatefulWidget {
  const RecipeFormScreen({super.key, this.recipe});

  final RecipeEntity? recipe;

  bool get isEditing => recipe != null;

  @override
  ConsumerState<RecipeFormScreen> createState() => _RecipeFormScreenState();
}

class _RecipeFormScreenState extends ConsumerState<RecipeFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _picker = ImagePicker();
  final List<_DraftRecipeIngredient> _ingredients = [];
  bool _isSaving = false;
  String? _imagePath;

  @override
  void initState() {
    super.initState();
    final recipe = widget.recipe;
    if (recipe != null) {
      _titleController.text = recipe.title;
      _descriptionController.text = recipe.description;
      _imagePath = recipe.imagePath;
      for (final item in recipe.ingredients) {
        _ingredients.add(
          _DraftRecipeIngredient(
            ingredientId: item.ingredientId,
            ingredientName: item.ingredientNameSnapshot,
            amountController: TextEditingController(text: formatAmount(item.amount)),
            unit: item.unit,
          ),
        );
      }
    }
    if (_ingredients.isEmpty) {
      _ingredients.add(_DraftRecipeIngredient.empty());
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    for (final item in _ingredients) {
      item.amountController.dispose();
    }
    super.dispose();
  }

  Future<void> _pickImage() async {
    final image = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 88);
    if (image == null) {
      return;
    }
    final encodedImage = await ref.read(recipeImageStorageProvider).persistXFile(image);
    setState(() {
      _imagePath = encodedImage;
    });
  }

  Future<void> _save(List<IngredientEntity> allIngredients) async {
    if (_isSaving || !_formKey.currentState!.validate()) {
      return;
    }

    final validRows = _ingredients.where((item) => item.ingredientId != null).toList();
    if (validRows.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Přidej alespoň jednu ingredienci.')),
        
      );
      return;
    }

    final ingredientMap = {for (final item in allIngredients) item.id: item};
    final embeddedItems = <RecipeIngredientEmbedded>[];
    for (final row in validRows) {
      final ingredient = ingredientMap[row.ingredientId];
      if (ingredient == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Některá ingredience už v seznamu neexistuje. Vyber ji znovu.')),
        );
        return;
      }
      final amount = double.tryParse(row.amountController.text.replaceAll(',', '.'));
      if (amount == null || amount <= 0) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Množství musí být větší než 0.')),
        );
        return;
      }

      embeddedItems.add(
        RecipeIngredientEmbedded(
          ingredientId: ingredient.id,
          ingredientNameSnapshot: ingredient.name,
          normalizedIngredientName: ingredient.normalizedName,
          amount: amount,
          unit: row.unit,
        ),
      );
    }

    setState(() {
      _isSaving = true;
    });

    try {
      final repository = ref.read(recipeRepositoryProvider);
      final recipe = widget.recipe ?? RecipeEntity();

      final now = DateTime.now();
      recipe
        ..title = _titleController.text.trim()
        ..normalizedTitle = TextNormalizer.normalize(_titleController.text)
        ..description = _descriptionController.text.trim()
        ..imagePath = _imagePath
        ..updatedAt = now
        ..cookingCount = widget.recipe?.cookingCount ?? 0
        ..createdAt = widget.recipe?.createdAt ?? now
        ..ingredients = embeddedItems;

      await repository.save(recipe);

      if (!mounted) {
        return;
      }
      Navigator.of(context).pop();
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Recept se nepodařilo uložit: $error')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isSaving = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final ingredients = ref.watch(ingredientsStreamProvider);
    return ContentScaffold(
      appBar: AppBar(
        title: Text(widget.isEditing ? 'Upravit recept' : 'Nový recept'),
      ),
      body: ingredients.when(
        data: (allIngredients) {
          return Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              children: [
                SectionCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      TextFormField(
                        controller: _titleController,
                        decoration: const InputDecoration(labelText: 'Název receptu'),
                        validator: (value) {
                          if (value == null || value.trim().isEmpty) {
                            return 'Zadej název receptu.';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _descriptionController,
                        maxLines: 5,
                        minLines: 3,
                        decoration: const InputDecoration(labelText: 'Postup nebo poznámka'),
                      ),
                      const SizedBox(height: 14),
                      Wrap(
                        spacing: 12,
                        runSpacing: 12,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          _RecipeImagePreview(imagePath: _imagePath),
                          OutlinedButton.icon(
                            onPressed: _pickImage,
                            icon: const Icon(Icons.photo_library_outlined),
                            label: const Text('Vybrat fotku'),
                          ),
                          if (_imagePath != null)
                            TextButton.icon(
                              onPressed: () => setState(() => _imagePath = null),
                              icon: const Icon(Icons.delete_outline),
                              label: const Text('Odebrat fotku'),
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
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Ingredience',
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                          ),
                          FilledButton.tonalIcon(
                            onPressed: () {
                              setState(() {
                                _ingredients.add(_DraftRecipeIngredient.empty());
                              });
                            },
                            icon: const Icon(Icons.add),
                            label: const Text('Přidat řádek'),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      for (var index = 0; index < _ingredients.length; index++) ...[
                        _RecipeIngredientRow(
                          value: _ingredients[index],
                          onPickIngredient: () async {
                            final ingredient = await showIngredientPickerDialog(context);
                            if (ingredient == null) {
                              return;
                            }
                            setState(() {
                              _ingredients[index]
                                ..ingredientId = ingredient.id
                                ..ingredientName = ingredient.name;
                            });
                          },
                          onUnitChanged: (unit) => setState(() => _ingredients[index].unit = unit),
                          onRemove: _ingredients.length == 1
                              ? null
                              : () {
                                  setState(() {
                                    final removed = _ingredients.removeAt(index);
                                    removed.amountController.dispose();
                                  });
                                },
                        ),
                        if (index < _ingredients.length - 1) const Divider(height: 24),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: _isSaving ? null : () => _save(allIngredients),
                  icon: const Icon(Icons.save_outlined),
                  label: Text(_isSaving ? 'Ukládám...' : 'Uložit recept'),
                ),
              ],
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('$error')),
      ),
    );
  }
}

class _RecipeImagePreview extends StatelessWidget {
  const _RecipeImagePreview({required this.imagePath});

  final String? imagePath;

  @override
  Widget build(BuildContext context) {
    return RecipeImageView(
      path: imagePath,
      width: 112,
      height: 112,
      borderRadius: 20,
      placeholderIcon: Icons.photo_camera_back_outlined,
    );
  }
}

class _RecipeIngredientRow extends StatelessWidget {
  const _RecipeIngredientRow({
    required this.value,
    required this.onPickIngredient,
    required this.onUnitChanged,
    required this.onRemove,
  });

  final _DraftRecipeIngredient value;
  final VoidCallback onPickIngredient;
  final ValueChanged<IngredientUnit> onUnitChanged;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final compact = MediaQuery.sizeOf(context).width < 420;
    return Column(
      children: [
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(
            value.ingredientName == null
                ? 'Vyber ingredienci'
                : IngredientNameFormatter.prettify(value.ingredientName!),
          ),
          subtitle: value.ingredientName == null ? const Text('Klepni a vyber ingredienci') : null,
          leading: const Icon(Icons.restaurant_menu),
          trailing: const Icon(Icons.chevron_right),
          onTap: onPickIngredient,
        ),
        const SizedBox(height: 10),
        compact
            ? Column(
                children: [
                  TextFormField(
                    controller: value.amountController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(labelText: 'Množství'),
                    validator: (text) {
                      if ((value.ingredientId == null) && (text == null || text.isEmpty)) {
                        return null;
                      }
                      final amount = double.tryParse((text ?? '').replaceAll(',', '.'));
                      if (amount == null || amount <= 0) {
                        return 'Zadej množství.';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<IngredientUnit>(
                    initialValue: value.unit,
                    decoration: const InputDecoration(labelText: 'Jednotka'),
                    items: IngredientUnit.values
                        .map((unit) => DropdownMenuItem(value: unit, child: Text(unit.label)))
                        .toList(),
                    onChanged: (unit) {
                      if (unit != null) {
                        onUnitChanged(unit);
                      }
                    },
                  ),
                  if (onRemove != null) ...[
                    const SizedBox(height: 10),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton.icon(
                        onPressed: onRemove,
                        icon: const Icon(Icons.delete_outline),
                        label: const Text('Odebrat'),
                      ),
                    ),
                  ],
                ],
              )
            : Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: value.amountController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: 'Množství'),
                      validator: (text) {
                        if ((value.ingredientId == null) && (text == null || text.isEmpty)) {
                          return null;
                        }
                        final amount = double.tryParse((text ?? '').replaceAll(',', '.'));
                        if (amount == null || amount <= 0) {
                          return 'Zadej množství.';
                        }
                        return null;
                      },
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: DropdownButtonFormField<IngredientUnit>(
                      initialValue: value.unit,
                      decoration: const InputDecoration(labelText: 'Jednotka'),
                      items: IngredientUnit.values
                          .map((unit) => DropdownMenuItem(value: unit, child: Text(unit.label)))
                          .toList(),
                      onChanged: (unit) {
                        if (unit != null) {
                          onUnitChanged(unit);
                        }
                      },
                    ),
                  ),
                  const SizedBox(width: 10),
                  IconButton(
                    onPressed: onRemove,
                    icon: const Icon(Icons.delete_outline),
                  ),
                ],
              ),
      ],
    );
  }
}

class _DraftRecipeIngredient {
  _DraftRecipeIngredient({
    required this.amountController,
    required this.unit,
    this.ingredientId,
    this.ingredientName,
  });

  factory _DraftRecipeIngredient.empty() {
    return _DraftRecipeIngredient(
      amountController: TextEditingController(),
      unit: IngredientUnit.ks,
    );
  }

  int? ingredientId;
  String? ingredientName;
  final TextEditingController amountController;
  IngredientUnit unit;
}
