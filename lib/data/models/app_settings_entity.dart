import 'package:isar/isar.dart';

part 'app_settings_entity.g.dart';

@collection
class AppSettingsEntity {
  AppSettingsEntity();

  Id id = 1;
  int seedVersionApplied = 0;
}
