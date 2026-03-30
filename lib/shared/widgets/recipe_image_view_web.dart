import 'dart:convert';
import 'package:flutter/material.dart';

Widget buildRecipeImageView({
  required String? path,
  required double width,
  required double height,
  required double borderRadius,
  required IconData placeholderIcon,
}) {
  Widget placeholder(BuildContext context, {IconData? icon}) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest.withValues(alpha: 0.92),
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: Icon(
        icon ?? placeholderIcon,
        size: 34,
        color: colorScheme.onSurfaceVariant,
      ),
    );
  }

  if (path == null || path.isEmpty) {
    return Builder(builder: placeholder);
  }

  if (path.startsWith('data:image/')) {
    final commaIndex = path.indexOf(',');
    final payload = commaIndex == -1 ? '' : path.substring(commaIndex + 1);
    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: Image.memory(
        base64Decode(payload),
        width: width,
        height: height,
        fit: BoxFit.cover,
        errorBuilder: (context, error, stackTrace) {
          return placeholder(context, icon: Icons.broken_image_outlined);
        },
      ),
    );
  }

  return ClipRRect(
    borderRadius: BorderRadius.circular(borderRadius),
    child: Image.network(
      path,
      width: width,
      height: height,
      fit: BoxFit.cover,
      errorBuilder: (context, error, stackTrace) {
        return placeholder(context, icon: Icons.broken_image_outlined);
      },
    ),
  );
}
