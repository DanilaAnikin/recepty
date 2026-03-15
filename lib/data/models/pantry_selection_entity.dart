import 'package:isar/isar.dart';

part 'pantry_selection_entity.g.dart';

@collection
class PantrySelectionEntity {
  PantrySelectionEntity();

  Id id = Isar.autoIncrement;

  @Index(unique: true, replace: true)
  late int ingredientId;

  late DateTime updatedAt;
}
