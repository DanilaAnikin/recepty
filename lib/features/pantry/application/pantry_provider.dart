import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/db/repository_providers.dart';

final pantrySelectionProvider = StreamProvider<Set<int>>((ref) {
  return ref.watch(pantryRepositoryProvider).watchSelectedIngredientIds();
});
