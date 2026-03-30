import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';

class AppBackdrop extends StatelessWidget {
  const AppBackdrop({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final backdrop = Theme.of(context).extension<AppThemeBackdrop>()!;
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [backdrop.top, backdrop.middle, backdrop.bottom],
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            top: -40,
            right: -20,
            child: _Blob(size: 180, color: backdrop.blobPrimary),
          ),
          Positioned(
            top: 180,
            left: -48,
            child: _Blob(size: 148, color: backdrop.blobSecondary),
          ),
          Positioned(
            bottom: -42,
            right: 8,
            child: _Blob(size: 132, color: backdrop.blobTertiary),
          ),
          child,
        ],
      ),
    );
  }
}

class _Blob extends StatelessWidget {
  const _Blob({required this.size, required this.color});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.45),
          borderRadius: BorderRadius.circular(size / 2),
        ),
      ),
    );
  }
}
