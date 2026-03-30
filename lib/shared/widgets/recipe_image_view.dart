import 'package:flutter/material.dart';

import 'recipe_image_view_stub.dart'
    if (dart.library.io) 'recipe_image_view_io.dart'
    if (dart.library.js_interop) 'recipe_image_view_web.dart'
    as image_impl;

class RecipeImageView extends StatelessWidget {
  const RecipeImageView({
    required this.path,
    required this.width,
    required this.height,
    required this.borderRadius,
    required this.placeholderIcon,
    super.key,
  });

  final String? path;
  final double width;
  final double height;
  final double borderRadius;
  final IconData placeholderIcon;

  @override
  Widget build(BuildContext context) {
    return image_impl.buildRecipeImageView(
      path: path,
      width: width,
      height: height,
      borderRadius: borderRadius,
      placeholderIcon: placeholderIcon,
    );
  }
}
