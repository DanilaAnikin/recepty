import 'package:isar/isar.dart';

import '../../core/constants/app_units.dart';

part 'recipe_entity.g.dart';

@embedded
class RecipeIngredientEmbedded {
  RecipeIngredientEmbedded();

  int? ingredientId;
  late String ingredientNameSnapshot;
  late String normalizedIngredientName;
  late double amount;

  @enumerated
  late IngredientUnit unit;
}

@collection
class RecipeEntity {
  RecipeEntity();

  Id id = Isar.autoIncrement;

  @Index()
  late String normalizedTitle;

  @Index()
  late String title;

  late String description;
  String? imagePath;
  late int cookingCount;
  late DateTime createdAt;
  late DateTime updatedAt;
  List<RecipeIngredientEmbedded> ingredients = [];
}
