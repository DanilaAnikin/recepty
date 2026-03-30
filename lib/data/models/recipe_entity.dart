import '../../core/constants/app_units.dart';

class RecipeIngredientEmbedded {
  RecipeIngredientEmbedded({
    this.ingredientId,
    required this.ingredientNameSnapshot,
    required this.normalizedIngredientName,
    required this.amountText,
    required this.unit,
  });

  int? ingredientId;
  String ingredientNameSnapshot;
  String normalizedIngredientName;
  String amountText;
  IngredientUnit unit;

  factory RecipeIngredientEmbedded.fromMap(Map<String, Object?> map) {
    return RecipeIngredientEmbedded(
      ingredientId: map['ingredientId'] as int?,
      ingredientNameSnapshot: map['ingredientNameSnapshot']! as String,
      normalizedIngredientName: map['normalizedIngredientName']! as String,
      amountText: _deserializeAmountText(map),
      unit: IngredientUnit.values.byName(map['unit']! as String),
    );
  }

  Map<String, Object?> toMap() {
    return {
      'ingredientId': ingredientId,
      'ingredientNameSnapshot': ingredientNameSnapshot,
      'normalizedIngredientName': normalizedIngredientName,
      'amountText': amountText,
      'unit': unit.name,
    };
  }

  static String _deserializeAmountText(Map<String, Object?> map) {
    final rawText = map['amountText'];
    if (rawText is String) {
      return rawText;
    }

    final legacyAmount = map['amount'];
    if (legacyAmount is int) {
      return legacyAmount.toString();
    }
    if (legacyAmount is double) {
      if (legacyAmount == legacyAmount.roundToDouble()) {
        return legacyAmount.toStringAsFixed(0);
      }
      return legacyAmount
          .toStringAsFixed(2)
          .replaceFirst(RegExp(r'0+$'), '')
          .replaceFirst(RegExp(r'\.$'), '');
    }

    return '';
  }
}

class RecipeEntity {
  RecipeEntity({
    this.id = 0,
    this.normalizedTitle = '',
    this.title = '',
    this.description = '',
    this.imagePath,
    this.cookingCount = 0,
    DateTime? createdAt,
    DateTime? updatedAt,
    List<RecipeIngredientEmbedded>? ingredients,
  }) : createdAt = createdAt ?? DateTime.now(),
       updatedAt = updatedAt ?? DateTime.now(),
       ingredients = ingredients ?? [];

  int id;
  String normalizedTitle;
  String title;
  String description;
  String? imagePath;
  int cookingCount;
  DateTime createdAt;
  DateTime updatedAt;
  List<RecipeIngredientEmbedded> ingredients;

  factory RecipeEntity.fromMap(Map<String, Object?> map, int id) {
    final rawIngredients = (map['ingredients'] as List<Object?>? ?? [])
        .whereType<Map>()
        .map((item) => Map<String, Object?>.from(item))
        .map(RecipeIngredientEmbedded.fromMap)
        .toList();
    return RecipeEntity(
      id: id,
      normalizedTitle: map['normalizedTitle']! as String,
      title: map['title']! as String,
      description: map['description']! as String,
      imagePath: map['imagePath'] as String?,
      cookingCount: map['cookingCount']! as int,
      createdAt: DateTime.parse(map['createdAt']! as String),
      updatedAt: DateTime.parse(map['updatedAt']! as String),
      ingredients: rawIngredients,
    );
  }

  Map<String, Object?> toMap() {
    return {
      'normalizedTitle': normalizedTitle,
      'title': title,
      'description': description,
      'imagePath': imagePath,
      'cookingCount': cookingCount,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
      'ingredients': ingredients.map((item) => item.toMap()).toList(),
    };
  }
}
