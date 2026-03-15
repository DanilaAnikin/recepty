import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:isar/isar.dart';

import '../../core/utils/text_normalizer.dart';
import '../models/app_settings_entity.dart';
import '../models/ingredient_entity.dart';

class AppSeedService {
  const AppSeedService(this._isar);

  static const _seedVersion = 1;
  final Isar _isar;

  Future<void> ensureSeedData() async {
    final settings = await _isar.appSettingsEntitys.get(1) ?? AppSettingsEntity();
    if (settings.seedVersionApplied >= _seedVersion) {
      return;
    }

    final raw = await rootBundle.loadString('assets/seeds/default_ingredients_v1.json');
    final decoded = (jsonDecode(raw) as List<dynamic>).cast<String>();
    final now = DateTime.now();
    final existing = await _isar.ingredientEntitys.where().findAll();
    final normalizedExisting = existing.map((item) => item.normalizedName).toSet();
    final seedItems = decoded
        .map((name) => name.trim())
        .where((name) => name.isNotEmpty)
        .map((name) => MapEntry(TextNormalizer.normalize(name), name))
        .where((entry) => !normalizedExisting.contains(entry.key))
        .map(
          (entry) => IngredientEntity()
            ..name = entry.value
            ..normalizedName = entry.key
            ..firstLetter = TextNormalizer.firstLetter(entry.value)
            ..isFavorite = false
            ..isSystem = true
            ..createdAt = now
            ..updatedAt = now,
        )
        .toList();

    await _isar.writeTxn(() async {
      if (seedItems.isNotEmpty) {
        await _isar.ingredientEntitys.putAll(seedItems);
      }
      settings.seedVersionApplied = _seedVersion;
      await _isar.appSettingsEntitys.put(settings);
    });
  }
}
