import 'package:flutter_test/flutter_test.dart';
import 'package:teriprojekt/core/constants/app_units.dart';
import 'package:teriprojekt/core/utils/text_normalizer.dart';
import 'package:teriprojekt/data/models/recipe_entity.dart';
import 'package:teriprojekt/features/recipes/application/recipe_matcher.dart';

void main() {
  test('text normalizer removes diacritics and extra spaces', () {
    expect(TextNormalizer.normalize('  Kureci   prsa  '), 'kureci prsa');
    expect(TextNormalizer.normalize('Červená cibule'), 'cervena cibule');
  });

  test(
    'recipe matcher returns full match only when all ingredients are selected',
    () {
      final recipe = RecipeEntity()
        ..title = 'Test'
        ..normalizedTitle = 'test'
        ..description = ''
        ..cookingCount = 0
        ..createdAt = DateTime(2026)
        ..updatedAt = DateTime(2026)
        ..ingredients = [
          RecipeIngredientEmbedded(
            ingredientId: 1,
            ingredientNameSnapshot: 'Mouka',
            normalizedIngredientName: 'mouka',
            amountText: '100',
            unit: IngredientUnit.g,
          ),
          RecipeIngredientEmbedded(
            ingredientId: 2,
            ingredientNameSnapshot: 'Mleko',
            normalizedIngredientName: 'mleko',
            amountText: '200',
            unit: IngredientUnit.ml,
          ),
        ];

      final full = RecipeMatcher.evaluate(
        recipe: recipe,
        selectedIngredientIds: {1, 2},
        query: '',
        mode: RecipeMatchMode.full,
      );
      final partial = RecipeMatcher.evaluate(
        recipe: recipe,
        selectedIngredientIds: {1},
        query: '',
        mode: RecipeMatchMode.partial,
      );

      expect(full.matches, isTrue);
      expect(partial.matches, isTrue);
      expect(partial.missingIngredients, ['Mleko']);
    },
  );

  test('recipe ingredient preserves par unit in map serialization', () {
    final ingredient = RecipeIngredientEmbedded(
      ingredientId: 3,
      ingredientNameSnapshot: 'Rohlik',
      normalizedIngredientName: 'rohlik',
      amountText: '2',
      unit: IngredientUnit.par,
    );

    final roundTrip = RecipeIngredientEmbedded.fromMap(ingredient.toMap());

    expect(roundTrip.unit, IngredientUnit.par);
    expect(roundTrip.unit.label, 'pár');
  });

  test('recipe ingredient loads legacy numeric amount as text', () {
    final ingredient = RecipeIngredientEmbedded.fromMap({
      'ingredientId': 4,
      'ingredientNameSnapshot': 'Cukr',
      'normalizedIngredientName': 'cukr',
      'amount': 1.5,
      'unit': IngredientUnit.kg.name,
    });

    expect(ingredient.amountText, '1.5');
  });
}
