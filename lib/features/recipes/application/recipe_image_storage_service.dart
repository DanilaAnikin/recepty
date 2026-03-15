import 'dart:convert';

import 'package:image_picker/image_picker.dart';

class RecipeImageStorageService {
  const RecipeImageStorageService();

  Future<String> persistXFile(XFile file) async {
    final bytes = await file.readAsBytes();
    final extension = _extension(file.name.isNotEmpty ? file.name : file.path);
    final mime = switch (extension) {
      'png' => 'image/png',
      'webp' => 'image/webp',
      'gif' => 'image/gif',
      _ => 'image/jpeg',
    };
    return 'data:$mime;base64,${base64Encode(bytes)}';
  }

  Future<void> deleteIfExists(String? path) async {}

  String _extension(String value) {
    final dotIndex = value.lastIndexOf('.');
    if (dotIndex == -1 || dotIndex == value.length - 1) {
      return 'jpg';
    }
    return value.substring(dotIndex + 1).toLowerCase();
  }
}
