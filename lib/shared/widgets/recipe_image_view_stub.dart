import 'dart:convert';
import 'package:flutter/material.dart';

Widget buildRecipeImageView({
  required String? path,
  required double width,
  required double height,
  required double borderRadius,
  required IconData placeholderIcon,
}) {
  if (path != null && path.startsWith('data:image/')) {
    final commaIndex = path.indexOf(',');
    final payload = commaIndex == -1 ? '' : path.substring(commaIndex + 1);
    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: Image.memory(
        base64Decode(payload),
        width: width,
        height: height,
        fit: BoxFit.cover,
      ),
    );
  }

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
