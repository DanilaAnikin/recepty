import 'package:flutter/material.dart';

import '../features/shell/presentation/app_shell.dart';
import 'theme/app_theme.dart';

class ReceptyTerinkyApp extends StatelessWidget {
  const ReceptyTerinkyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Recepty Terinky',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme(),
      home: const AppShell(),
    );
  }
}
