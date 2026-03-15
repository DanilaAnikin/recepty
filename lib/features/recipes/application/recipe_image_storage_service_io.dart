import 'dart:io';

import 'package:path_provider/path_provider.dart';

class RecipeImageStorageService {
  const RecipeImageStorageService();

  Future<String> persistImage(String sourcePath) async {
    final file = File(sourcePath);
    if (!await file.exists()) {
      return sourcePath;
    }

    final directory = await getApplicationDocumentsDirectory();
    final imagesDir = Directory('${directory.path}/recipe_images');
    if (!await imagesDir.exists()) {
      await imagesDir.create(recursive: true);
    }

    final extension = sourcePath.contains('.') ? sourcePath.split('.').last : 'jpg';
    final targetPath =
        '${imagesDir.path}/recipe_${DateTime.now().microsecondsSinceEpoch}.$extension';
    final copied = await file.copy(targetPath);
    return copied.path;
  }

  Future<void> deleteIfExists(String? path) async {
    if (path == null || path.isEmpty) {
      return;
    }
    final file = File(path);
    if (await file.exists()) {
      await file.delete();
    }
  }
}
