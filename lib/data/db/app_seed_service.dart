import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:sembast/sembast.dart';

import '../../core/utils/text_normalizer.dart';
import '../models/ingredient_entity.dart';
import 'app_database.dart';

class AppSeedService {
  const AppSeedService(this._db);

  static const _seedVersion = 1;
  final Database _db;

  Future<void> ensureSeedData() async {
    final appliedVersion = (await metaStore.record(seedVersionKey).get(_db) as int?) ?? 0;
    if (appliedVersion >= _seedVersion) {
      return;
    }

    final raw = await rootBundle.loadString('assets/seeds/default_ingredients_v1.json');
    final decoded = (jsonDecode(raw) as List<dynamic>).cast<String>();
    final existingSnapshots = await ingredientsStore.find(_db);
    final existingNormalizedNames = existingSnapshots
        .map((snapshot) => snapshot.value['normalizedName'])
        .whereType<String>()
        .toSet();
    final now = DateTime.now();

    final items = decoded
        .map((name) => name.trim())
        .where((name) => name.isNotEmpty)
        .map((name) => MapEntry(TextNormalizer.normalize(name), name))
        .where((entry) => !existingNormalizedNames.contains(entry.key))
        .map(
          (entry) => IngredientEntity(
            normalizedName: entry.key,
            name: entry.value,
            firstLetter: TextNormalizer.firstLetter(entry.value),
            isFavorite: false,
            isSystem: true,
            createdAt: now,
            updatedAt: now,
          ).toMap(),
        )
        .toList();

    if (items.isNotEmpty) {
      await ingredientsStore.addAll(_db, items);
    }
    await metaStore.record(seedVersionKey).put(_db, _seedVersion);
    await metaStore.record(pantrySelectionKey).put(_db, <int>[]);
  }
}
