import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sembast/sembast.dart';

import '../data/db/app_seed_service.dart';
import '../data/db/database_factory.dart';

final appBootstrapProvider = Provider<AppBootstrap>((ref) {
  throw UnimplementedError('AppBootstrap has not been initialized.');
});

class AppBootstrap {
  const AppBootstrap(this.db);

  final Database db;

  static Future<AppBootstrap> create() async {
    final db = await openAppDatabase();
    await AppSeedService(db).ensureSeedData();
    return AppBootstrap(db);
  }
}
