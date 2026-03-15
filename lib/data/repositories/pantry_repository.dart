import 'package:sembast/sembast.dart';

import '../db/app_database.dart';

class PantryRepository {
  const PantryRepository(this._db);

  final Database _db;

  Stream<Set<int>> watchSelectedIngredientIds() {
    return metaStore.record(pantrySelectionKey).onSnapshot(_db).map((snapshot) {
      final raw = snapshot?.value;
      return (raw as List<Object?>? ?? []).whereType<int>().toSet();
    });
  }

  Future<void> replaceSelection(Set<int> ingredientIds) async {
    await metaStore.record(pantrySelectionKey).put(_db, ingredientIds.toList()..sort());
  }
}
