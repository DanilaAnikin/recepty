import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/settings/application/theme_mode_provider.dart';

class ThemeModeButton extends ConsumerWidget {
  const ThemeModeButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);
    return PopupMenuButton<ThemeMode>(
      tooltip: 'Vzhled',
      initialValue: themeMode,
      onSelected: (mode) =>
          ref.read(themeModeProvider.notifier).setThemeMode(mode),
      icon: Icon(_iconFor(themeMode)),
      itemBuilder: (context) => const [
        PopupMenuItem(
          value: ThemeMode.system,
          child: ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(Icons.brightness_auto_outlined),
            title: Text('Podle systému'),
          ),
        ),
        PopupMenuItem(
          value: ThemeMode.light,
          child: ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(Icons.light_mode_outlined),
            title: Text('Světlý režim'),
          ),
        ),
        PopupMenuItem(
          value: ThemeMode.dark,
          child: ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(Icons.dark_mode_outlined),
            title: Text('Tmavý režim'),
          ),
        ),
      ],
    );
  }

  IconData _iconFor(ThemeMode mode) {
    return switch (mode) {
      ThemeMode.light => Icons.light_mode_outlined,
      ThemeMode.dark => Icons.dark_mode_outlined,
      ThemeMode.system => Icons.brightness_auto_outlined,
    };
  }
}
