import 'package:sembast/sembast.dart';

import '../db/app_database.dart';
import '../models/recipe_entity.dart';

class RecipeRepository {
  const RecipeRepository(this._db);

  final Database _db;

  Stream<List<RecipeEntity>> watchAll() {
    return recipesStore.query().onSnapshots(_db).map((snapshots) {
      final items = snapshots
          .map((snapshot) => RecipeEntity.fromMap(snapshot.value, snapshot.key))
          .toList();
      items.sort((a, b) {
        final titleCompare = a.normalizedTitle.compareTo(b.normalizedTitle);
        if (titleCompare != 0) {
          return titleCompare;
        }
        return b.updatedAt.compareTo(a.updatedAt);
      });
      return items;
    });
  }

  Future<RecipeEntity?> getById(int id) async {
    final data = await recipesStore.record(id).get(_db);
    if (data == null) {
      return null;
    }
    return RecipeEntity.fromMap(data, id);
  }

  Future<void> save(RecipeEntity recipe) async {
    if (recipe.id == 0) {
      final id = await recipesStore.add(_db, recipe.toMap());
      recipe.id = id;
      return;
    }
    await recipesStore.record(recipe.id).put(_db, recipe.toMap());
  }

  Future<void> delete(int id) async {
    await recipesStore.record(id).delete(_db);
  }

  Future<void> incrementCookingCount(RecipeEntity recipe) async {
    recipe
      ..cookingCount += 1
      ..updatedAt = DateTime.now();
    await save(recipe);
  }

  Future<void> setCookingCount(RecipeEntity recipe, int count) async {
    recipe
      ..cookingCount = count
      ..updatedAt = DateTime.now();
    await save(recipe);
  }
}
