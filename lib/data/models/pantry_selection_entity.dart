class PantrySelectionEntity {
  PantrySelectionEntity({this.ingredientId = 0, DateTime? updatedAt})
    : updatedAt = updatedAt ?? DateTime.now();

  int ingredientId;
  DateTime updatedAt;
}
