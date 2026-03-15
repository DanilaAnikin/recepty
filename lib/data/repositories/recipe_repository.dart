import 'package:isar/isar.dart';

import '../models/recipe_entity.dart';

class RecipeRepository {
  const RecipeRepository(this._isar);

  final Isar _isar;

  Stream<List<RecipeEntity>> watchAll() {
    return _isar.recipeEntitys.where().watch(fireImmediately: true).map((items) {
      final sorted = [...items];
      sorted.sort((a, b) {
        final titleCompare = a.normalizedTitle.compareTo(b.normalizedTitle);
        if (titleCompare != 0) {
          return titleCompare;
        }
        return b.updatedAt.compareTo(a.updatedAt);
      });
      return sorted;
    });
  }

  Future<RecipeEntity?> getById(int id) => _isar.recipeEntitys.get(id);

  Future<void> save(RecipeEntity recipe) async {
    await _isar.writeTxn(() async {
      await _isar.recipeEntitys.put(recipe);
    });
  }

  Future<void> delete(int id) async {
    await _isar.writeTxn(() async {
      await _isar.recipeEntitys.delete(id);
    });
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
