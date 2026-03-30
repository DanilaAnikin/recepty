import 'package:sembast/sembast.dart';

final StoreRef<int, Map<String, Object?>> ingredientsStore = intMapStoreFactory
    .store('ingredients');

final StoreRef<int, Map<String, Object?>> recipesStore = intMapStoreFactory
    .store('recipes');

final StoreRef<String, Object?> metaStore = StoreRef<String, Object?>.main();

const String pantrySelectionKey = 'pantry_selection';
const String seedVersionKey = 'seed_version';
const String themeModeKey = 'theme_mode';
