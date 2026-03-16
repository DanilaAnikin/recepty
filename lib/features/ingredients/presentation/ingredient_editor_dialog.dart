import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/utils/ingredient_name_formatter.dart';
import '../../../data/db/repository_providers.dart';
import '../../../data/models/ingredient_entity.dart';
import '../../../data/repositories/ingredient_repository.dart';

Future<void> showIngredientEditorDialog(
  BuildContext context,
  WidgetRef ref, {
  IngredientEntity? ingredient,
}) async {
  await showDialog<void>(
    context: context,
    builder: (context) => IngredientEditorDialog(ingredient: ingredient),
  );
}

class IngredientEditorDialog extends ConsumerStatefulWidget {
  const IngredientEditorDialog({super.key, this.ingredient});

  final IngredientEntity? ingredient;

  @override
  ConsumerState<IngredientEditorDialog> createState() => _IngredientEditorDialogState();
}

class _IngredientEditorDialogState extends ConsumerState<IngredientEditorDialog> {
  late final TextEditingController _nameController;
  final _formKey = GlobalKey<FormState>();
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(
      text: widget.ingredient == null ? '' : IngredientNameFormatter.prettify(widget.ingredient!.name),
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
      if (widget.ingredient == null) {
        await repo.create(name: _nameController.text, isSystem: false);
      } else {
        await repo.update(entity: widget.ingredient!, name: _nameController.text);
      }
      if (mounted) {
        Navigator.of(context).pop();
      }
    } on IngredientRepositoryException catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
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
    return AlertDialog(
      title: Text(widget.ingredient == null ? 'Nová ingredience' : 'Upravit ingredienci'),
      content: Form(
        key: _formKey,
        child: TextFormField(
          controller: _nameController,
          autofocus: true,
          textInputAction: TextInputAction.done,
          decoration: const InputDecoration(
            labelText: 'Název ingredience',
          ),
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
