enum IngredientUnit {
  g('g'),
  kg('kg'),
  ml('ml'),
  l('l'),
  ks('ks'),
  lzicka('lžička'),
  lzice('lžíce');

  const IngredientUnit(this.label);

  final String label;
}

enum RecipeMatchMode {
  full('Celé'),
  partial('Částečné');

  const RecipeMatchMode(this.label);

  final String label;
}
