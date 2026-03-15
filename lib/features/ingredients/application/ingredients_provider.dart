import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/db/repository_providers.dart';
import '../../../data/models/ingredient_entity.dart';

final ingredientsStreamProvider = StreamProvider<List<IngredientEntity>>((ref) {
  return ref.watch(ingredientRepositoryProvider).watchAll();
});
