import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/utils/ingredient_name_formatter.dart';
import '../../../data/db/repository_providers.dart';
import '../../../data/models/ingredient_entity.dart';
import '../../../data/repositories/ingredient_repository.dart';

Future<IngredientEntity?> showIngredientEditorDialog(
  BuildContext context,
  WidgetRef ref, {
  IngredientEntity? ingredient,
  String? initialName,
}) async {
  return showDialog<IngredientEntity>(
    context: context,
    builder: (context) => IngredientEditorDialog(
      ingredient: ingredient,
      initialName: initialName,
    ),
  );
}

class IngredientEditorDialog extends ConsumerStatefulWidget {
  const IngredientEditorDialog({super.key, this.ingredient, this.initialName});

  final IngredientEntity? ingredient;
  final String? initialName;

  @override
  ConsumerState<IngredientEditorDialog> createState() =>
      _IngredientEditorDialogState();
}

class _IngredientEditorDialogState
    extends ConsumerState<IngredientEditorDialog> {
  late final TextEditingController _nameController;
  final _formKey = GlobalKey<FormState>();
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(
      text: widget.ingredient == null
          ? widget.initialName?.trim() ?? ''
          : IngredientNameFormatter.prettify(widget.ingredient!.name),
    );
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_isSaving || !_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _isSaving = true;
    });

    final repo = ref.read(ingredientRepositoryProvider);
    try {
      late final IngredientEntity savedIngredient;
      if (widget.ingredient == null) {
        savedIngredient = await repo.create(
          name: _nameController.text,
          isSystem: false,
        );
      } else {
        savedIngredient = await repo.update(
          entity: widget.ingredient!,
          name: _nameController.text,
        );
      }
      if (mounted) {
        Navigator.of(context).pop(savedIngredient);
      }
    } on IngredientRepositoryException catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
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
    return AlertDialog(
      title: Text(
        widget.ingredient == null ? 'Nová ingredience' : 'Upravit ingredienci',
      ),
      content: Form(
        key: _formKey,
        child: TextFormField(
          controller: _nameController,
          autofocus: true,
          textInputAction: TextInputAction.done,
          decoration: const InputDecoration(labelText: 'Název ingredience'),
          validator: (value) {
            if (value == null || value.trim().isEmpty) {
              return 'Zadej název ingredience.';
            }
            return null;
          },
          onFieldSubmitted: (_) => _save(),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _isSaving ? null : () => Navigator.of(context).pop(),
          child: const Text('Zrušit'),
        ),
        FilledButton(
          onPressed: _isSaving ? null : _save,
          child: Text(_isSaving ? 'Ukládám...' : 'Uložit'),
        ),
      ],
    );
  }
}
