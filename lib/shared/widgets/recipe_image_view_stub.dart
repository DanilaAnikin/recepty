import 'package:flutter/material.dart';

Widget buildRecipeImageView({
  required String? path,
  required double width,
  required double height,
  required double borderRadius,
  required IconData placeholderIcon,
}) {
  return Container(
    width: width,
    height: height,
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: 0.92),
      borderRadius: BorderRadius.circular(borderRadius),
      border: Border.all(color: const Color(0xFFE0D1C8)),
    ),
    child: Icon(placeholderIcon, size: 34),
  );
}
