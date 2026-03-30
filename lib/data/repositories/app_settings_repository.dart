import 'package:flutter/material.dart';
import 'package:sembast/sembast.dart';

import '../db/app_database.dart';

class AppSettingsRepository {
  const AppSettingsRepository(this._db);

  final Database _db;

  Future<ThemeMode> readThemeMode() async {
    final raw = await metaStore.record(themeModeKey).get(_db) as String?;
    return switch (raw) {
      'light' => ThemeMode.light,
      'dark' => ThemeMode.dark,
      _ => ThemeMode.system,
    };
  }

  Future<void> writeThemeMode(ThemeMode mode) async {
    await metaStore.record(themeModeKey).put(_db, mode.name);
  }
}
