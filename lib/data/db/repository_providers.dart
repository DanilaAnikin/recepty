import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/bootstrap.dart';
import '../repositories/app_settings_repository.dart';
import '../repositories/ingredient_repository.dart';
import '../repositories/pantry_repository.dart';
import '../repositories/recipe_repository.dart';

final appSettingsRepositoryProvider = Provider<AppSettingsRepository>((ref) {
  final bootstrap = ref.watch(appBootstrapProvider);
  return AppSettingsRepository(bootstrap.db);
});

final ingredientRepositoryProvider = Provider<IngredientRepository>((ref) {
  final bootstrap = ref.watch(appBootstrapProvider);
  return IngredientRepository(bootstrap.db);
});

final pantryRepositoryProvider = Provider<PantryRepository>((ref) {
  final bootstrap = ref.watch(appBootstrapProvider);
  return PantryRepository(bootstrap.db);
});

final recipeRepositoryProvider = Provider<RecipeRepository>((ref) {
  final bootstrap = ref.watch(appBootstrapProvider);
  return RecipeRepository(bootstrap.db);
});
