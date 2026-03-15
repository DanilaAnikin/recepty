class RecipeImageStorageService {
  const RecipeImageStorageService();

  Future<String> persistImage(String sourcePath) async => sourcePath;

  Future<void> deleteIfExists(String? path) async {}
}
