import '../../../core/constants/app_units.dart';
import '../../../core/utils/text_normalizer.dart';
import '../../../data/models/recipe_entity.dart';
import 'recipe_match_result.dart';

class RecipeMatcher {
  const RecipeMatcher._();

  static RecipeMatchResult evaluate({
    required RecipeEntity recipe,
    required Set<int> selectedIngredientIds,
    required String query,
    required RecipeMatchMode mode,
  }) {
    final normalizedQuery = TextNormalizer.normalize(query);
    final recipeNames = recipe.ingredients.map((item) => item.ingredientNameSnapshot).toList();
    final recipeNormalizedNames = recipe.ingredients.map((item) => item.normalizedIngredientName).toList();

    final matchesText = normalizedQuery.isEmpty ||
        recipe.normalizedTitle.contains(normalizedQuery) ||
        recipeNormalizedNames.any((item) => item.contains(normalizedQuery));
    if (!matchesText) {
      return const RecipeMatchResult(matches: false, missingIngredients: []);
    }

    if (selectedIngredientIds.isEmpty) {
      return const RecipeMatchResult(matches: true, missingIngredients: []);
    }

    final missing = <String>[];
    var anySelected = false;
    for (final item in recipe.ingredients) {
      final isSelected = item.ingredientId != null && selectedIngredientIds.contains(item.ingredientId);
      if (isSelected) {
        anySelected = true;
      } else {
        missing.add(item.ingredientNameSnapshot);
      }
    }

    if (mode == RecipeMatchMode.full) {
      return RecipeMatchResult(
        matches: missing.isEmpty,
        missingIngredients: missing,
      );
    }

    return RecipeMatchResult(
      matches: anySelected || recipeNames.isEmpty,
      missingIngredients: missing,
    );
  }
}
