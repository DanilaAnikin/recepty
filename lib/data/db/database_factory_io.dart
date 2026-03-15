import 'package:path/path.dart' as path;
import 'package:path_provider/path_provider.dart';
import 'package:sembast/sembast_io.dart';

Future<Database> openAppDatabase() async {
  final directory = await getApplicationDocumentsDirectory();
  final dbPath = path.join(directory.path, 'recepty_terinky.db');
  return databaseFactoryIo.openDatabase(dbPath);
}
