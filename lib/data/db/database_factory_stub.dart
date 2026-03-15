import 'package:sembast/sembast_memory.dart';

Future<Database> openAppDatabase() {
  final factory = newDatabaseFactoryMemory();
  return factory.openDatabase('recepty_terinky.db');
}
