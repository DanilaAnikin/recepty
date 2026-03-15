import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'recipe_image_storage_service.dart';

final recipeImageStorageProvider = Provider<RecipeImageStorageService>((ref) {
  return const RecipeImageStorageService();
});
