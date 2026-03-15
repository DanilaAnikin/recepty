import 'package:flutter/material.dart';

Future<int?> showCountEditDialog(BuildContext context, int initialValue) {
  return showDialog<int>(
    context: context,
    builder: (context) => _CountEditDialog(initialValue: initialValue),
  );
}

class _CountEditDialog extends StatefulWidget {
  const _CountEditDialog({required this.initialValue});

  final int initialValue;

  @override
  State<_CountEditDialog> createState() => _CountEditDialogState();
}

class _CountEditDialogState extends State<_CountEditDialog> {
  late final TextEditingController _controller;
  final _formKey = GlobalKey<FormState>();

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialValue.toString());
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Upravit počet vaření'),
      content: Form(
        key: _formKey,
        child: TextFormField(
          controller: _controller,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'Počet vaření'),
          validator: (value) {
            final parsed = int.tryParse(value ?? '');
            if (parsed == null || parsed < 0) {
              return 'Zadej celé číslo 0 nebo víc.';
            }
            return null;
          },
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Zrušit'),
        ),
        FilledButton(
          onPressed: () {
            if (!_formKey.currentState!.validate()) {
              return;
            }
            Navigator.of(context).pop(int.parse(_controller.text));
          },
          child: const Text('Uložit'),
        ),
      ],
    );
  }
}
