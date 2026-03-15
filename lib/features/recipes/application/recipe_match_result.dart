class RecipeMatchResult {
  const RecipeMatchResult({
    required this.matches,
    required this.missingIngredients,
  });

  final bool matches;
  final List<String> missingIngredients;
}
