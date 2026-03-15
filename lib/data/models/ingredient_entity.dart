import 'package:isar/isar.dart';

part 'ingredient_entity.g.dart';

@collection
class IngredientEntity {
  IngredientEntity();

  Id id = Isar.autoIncrement;

  @Index(unique: true, replace: false)
  late String normalizedName;

  @Index()
  late String name;

  @Index()
  late String firstLetter;

  late bool isFavorite;
  late bool isSystem;
  late DateTime createdAt;
  late DateTime updatedAt;
}
