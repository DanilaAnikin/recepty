import 'package:isar/isar.dart';

import '../models/pantry_selection_entity.dart';

class PantryRepository {
  const PantryRepository(this._isar);

  final Isar _isar;

  Stream<Set<int>> watchSelectedIngredientIds() {
    return _isar.pantrySelectionEntitys.where().watch(fireImmediately: true).map(
          (items) => items.map((item) => item.ingredientId).toSet(),
        );
  }

  Future<void> replaceSelection(Set<int> ingredientIds) async {
    await _isar.writeTxn(() async {
      await _isar.pantrySelectionEntitys.clear();
      final now = DateTime.now();
      await _isar.pantrySelectionEntitys.putAll(
        ingredientIds
            .map(
              (id) => PantrySelectionEntity()
                ..ingredientId = id
                ..updatedAt = now,
            )
            .toList(),
      );
    });
  }
}
