import 'package:sembast_web/sembast_web.dart';

Future<Database> openAppDatabase() {
  return databaseFactoryWeb.openDatabase('recepty_terinky.db');
}
