import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/db/repository_providers.dart';
import '../../../data/models/recipe_entity.dart';

final recipesStreamProvider = StreamProvider<List<RecipeEntity>>((ref) {
  return ref.watch(recipeRepositoryProvider).watchAll();
});
