class IngredientEntity {
  IngredientEntity({
    this.id = 0,
    required this.normalizedName,
    required this.name,
    required this.firstLetter,
    required this.isFavorite,
    required this.isSystem,
    required this.createdAt,
    required this.updatedAt,
  });

  int id;
  String normalizedName;
  String name;
  String firstLetter;
  bool isFavorite;
  bool isSystem;
  DateTime createdAt;
  DateTime updatedAt;

  factory IngredientEntity.fromMap(Map<String, Object?> map, int id) {
    return IngredientEntity(
      id: id,
      normalizedName: map['normalizedName']! as String,
      name: map['name']! as String,
      firstLetter: map['firstLetter']! as String,
      isFavorite: map['isFavorite']! as bool,
      isSystem: map['isSystem']! as bool,
      createdAt: DateTime.parse(map['createdAt']! as String),
      updatedAt: DateTime.parse(map['updatedAt']! as String),
    );
  }

  Map<String, Object?> toMap() {
    return {
      'normalizedName': normalizedName,
      'name': name,
      'firstLetter': firstLetter,
      'isFavorite': isFavorite,
      'isSystem': isSystem,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }
}
