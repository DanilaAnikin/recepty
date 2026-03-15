import 'package:isar/isar.dart';

import '../../core/utils/text_normalizer.dart';
import '../models/ingredient_entity.dart';
import '../models/pantry_selection_entity.dart';

class IngredientRepository {
  const IngredientRepository(this._isar);

  final Isar _isar;

  Stream<List<IngredientEntity>> watchAll() {
    return _isar.ingredientEntitys.where().watch(fireImmediately: true).map((items) {
      final sorted = [...items];
      sorted.sort((a, b) => a.normalizedName.compareTo(b.normalizedName));
      return sorted;
    });
  }

  Future<List<IngredientEntity>> getByIds(Iterable<int> ids) async {
    if (ids.isEmpty) {
      return [];
    }
    return _isar.ingredientEntitys.getAll(ids.toList()).then(
          (items) => items.whereType<IngredientEntity>().toList(),
        );
  }

  Future<IngredientEntity?> getByNormalizedName(String normalizedName) {
    return _isar.ingredientEntitys.filter().normalizedNameEqualTo(normalizedName).findFirst();
  }

  Future<IngredientEntity> create({
    required String name,
    required bool isSystem,
  }) async {
    final normalizedName = TextNormalizer.normalize(name);
    final existing = await getByNormalizedName(normalizedName);
    if (existing != null) {
      throw const IngredientRepositoryException('Ingredience se stejnym nazvem uz existuje.');
    }

    final entity = IngredientEntity()
      ..name = name.trim()
      ..normalizedName = normalizedName
      ..firstLetter = TextNormalizer.firstLetter(name)
      ..isFavorite = false
      ..isSystem = isSystem
      ..createdAt = DateTime.now()
      ..updatedAt = DateTime.now();

    await _isar.writeTxn(() async {
      await _isar.ingredientEntitys.put(entity);
    });

    return entity;
  }

  Future<IngredientEntity> update({
    required IngredientEntity entity,
    required String name,
  }) async {
    final normalizedName = TextNormalizer.normalize(name);
    final existing = await getByNormalizedName(normalizedName);
    if (existing != null && existing.id != entity.id) {
      throw const IngredientRepositoryException('Ingredience se stejnym nazvem uz existuje.');
    }

    entity
      ..name = name.trim()
      ..normalizedName = normalizedName
      ..firstLetter = TextNormalizer.firstLetter(name)
      ..updatedAt = DateTime.now();

    await _isar.writeTxn(() async {
      await _isar.ingredientEntitys.put(entity);
    });

    return entity;
  }

  Future<void> toggleFavorite(IngredientEntity entity) async {
    entity
      ..isFavorite = !entity.isFavorite
      ..updatedAt = DateTime.now();

    await _isar.writeTxn(() async {
      await _isar.ingredientEntitys.put(entity);
    });
  }

  Future<void> delete(IngredientEntity entity) async {
    await _isar.writeTxn(() async {
      await _isar.pantrySelectionEntitys
          .filter()
          .ingredientIdEqualTo(entity.id)
          .deleteAll();
      await _isar.ingredientEntitys.delete(entity.id);
    });
  }
}

class IngredientRepositoryException implements Exception {
  const IngredientRepositoryException(this.message);

  final String message;
}
