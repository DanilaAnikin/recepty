import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/bootstrap.dart';
import '../../../data/db/repository_providers.dart';
import '../../../data/repositories/app_settings_repository.dart';

final themeModeProvider = StateNotifierProvider<ThemeModeController, ThemeMode>(
  (ref) {
    return ThemeModeController(
      ref.watch(appSettingsRepositoryProvider),
      initialMode: ref.watch(appBootstrapProvider).initialThemeMode,
    );
  },
);

class ThemeModeController extends StateNotifier<ThemeMode> {
  ThemeModeController(this._repository, {required ThemeMode initialMode})
    : super(initialMode);

  final AppSettingsRepository _repository;

  Future<void> setThemeMode(ThemeMode mode) async {
    if (state == mode) {
      return;
    }
    state = mode;
    await _repository.writeThemeMode(mode);
  }
}
