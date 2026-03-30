import 'package:sembast/sembast.dart';

import '../../core/utils/text_normalizer.dart';
import '../db/app_database.dart';
import '../models/ingredient_entity.dart';

class IngredientRepository {
  const IngredientRepository(this._db);

  final Database _db;

  Stream<List<IngredientEntity>> watchAll() {
    return ingredientsStore.query().onSnapshots(_db).map((snapshots) {
      final items = snapshots
          .map(
            (snapshot) =>
                IngredientEntity.fromMap(snapshot.value, snapshot.key),
          )
          .toList();
      items.sort((a, b) => a.normalizedName.compareTo(b.normalizedName));
      return items;
    });
  }

  Future<List<IngredientEntity>> getByIds(Iterable<int> ids) async {
    if (ids.isEmpty) {
      return [];
    }
    final snapshots = await ingredientsStore.find(_db);
    return snapshots
        .map(
          (snapshot) => IngredientEntity.fromMap(snapshot.value, snapshot.key),
        )
        .where((item) => ids.contains(item.id))
        .toList();
  }

  Future<IngredientEntity?> getByNormalizedName(String normalizedName) async {
    final snapshot = await ingredientsStore.findFirst(
      _db,
      finder: Finder(filter: Filter.equals('normalizedName', normalizedName)),
    );
    if (snapshot == null) {
      return null;
    }
    return IngredientEntity.fromMap(snapshot.value, snapshot.key);
  }

  Future<IngredientEntity> create({
    required String name,
    required bool isSystem,
  }) async {
    final normalizedName = TextNormalizer.normalize(name);
    final existing = await getByNormalizedName(normalizedName);
    if (existing != null) {
      throw const IngredientRepositoryException(
        'Ingredience se stejným názvem už existuje.',
      );
    }

    final now = DateTime.now();
    final entity = IngredientEntity(
      normalizedName: normalizedName,
      name: name.trim(),
      firstLetter: TextNormalizer.firstLetter(name),
      isFavorite: false,
      isSystem: isSystem,
      createdAt: now,
      updatedAt: now,
    );

    final id = await ingredientsStore.add(_db, entity.toMap());
    entity.id = id;
    return entity;
  }

  Future<IngredientEntity> update({
    required IngredientEntity entity,
    required String name,
  }) async {
    final normalizedName = TextNormalizer.normalize(name);
    final existing = await getByNormalizedName(normalizedName);
    if (existing != null && existing.id != entity.id) {
      throw const IngredientRepositoryException(
        'Ingredience se stejným názvem už existuje.',
      );
    }

    entity
      ..name = name.trim()
      ..normalizedName = normalizedName
      ..firstLetter = TextNormalizer.firstLetter(name)
      ..updatedAt = DateTime.now();

    await ingredientsStore.record(entity.id).put(_db, entity.toMap());
    return entity;
  }

  Future<void> toggleFavorite(IngredientEntity entity) async {
    entity
      ..isFavorite = !entity.isFavorite
      ..updatedAt = DateTime.now();
    await ingredientsStore.record(entity.id).put(_db, entity.toMap());
  }

  Future<void> delete(IngredientEntity entity) async {
    final pantrySelection = await _readPantrySelection();
    pantrySelection.remove(entity.id);
    await metaStore
        .record(pantrySelectionKey)
        .put(_db, pantrySelection.toList());
    await ingredientsStore.record(entity.id).delete(_db);
  }

  Future<Set<int>> _readPantrySelection() async {
    final raw = await metaStore.record(pantrySelectionKey).get(_db);
    final list = (raw as List<Object?>? ?? []).whereType<int>().toSet();
    return list;
  }
}

class IngredientRepositoryException implements Exception {
  const IngredientRepositoryException(this.message);

  final String message;
}
