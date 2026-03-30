import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/shell/presentation/app_shell.dart';
import '../features/settings/application/theme_mode_provider.dart';
import 'theme/app_theme.dart';

class ReceptyTerinkyApp extends ConsumerWidget {
  const ReceptyTerinkyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);
    return MaterialApp(
      title: 'Recepty Terinky',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme(),
      darkTheme: AppTheme.darkTheme(),
      themeMode: themeMode,
      home: const AppShell(),
    );
  }
}
