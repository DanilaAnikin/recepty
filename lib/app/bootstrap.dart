import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:isar/isar.dart';
import 'package:path_provider/path_provider.dart';

import '../data/db/app_seed_service.dart';
import '../data/models/app_settings_entity.dart';
import '../data/models/ingredient_entity.dart';
import '../data/models/pantry_selection_entity.dart';
import '../data/models/recipe_entity.dart';

final appBootstrapProvider = Provider<AppBootstrap>((ref) {
  throw UnimplementedError('AppBootstrap has not been initialized.');
});

class AppBootstrap {
  const AppBootstrap(this.isar);

  final Isar isar;

  static Future<AppBootstrap> create() async {
    final directory = await getApplicationDocumentsDirectory();
    final isar = await Isar.open(
      [
        IngredientEntitySchema,
        RecipeEntitySchema,
        PantrySelectionEntitySchema,
        AppSettingsEntitySchema,
      ],
      directory: directory.path,
      inspector: false,
    );
    await AppSeedService(isar).ensureSeedData();
    return AppBootstrap(isar);
  }
}
