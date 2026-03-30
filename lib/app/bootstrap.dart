import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sembast/sembast.dart';

import '../data/db/app_seed_service.dart';
import '../data/db/database_factory.dart';
import '../data/repositories/app_settings_repository.dart';

final appBootstrapProvider = Provider<AppBootstrap>((ref) {
  throw UnimplementedError('AppBootstrap has not been initialized.');
});

class AppBootstrap {
  const AppBootstrap({required this.db, required this.initialThemeMode});

  final Database db;
  final ThemeMode initialThemeMode;

  static Future<AppBootstrap> create() async {
    final db = await openAppDatabase();
    await AppSeedService(db).ensureSeedData();
    final initialThemeMode = await AppSettingsRepository(db).readThemeMode();
    return AppBootstrap(db: db, initialThemeMode: initialThemeMode);
  }
}
