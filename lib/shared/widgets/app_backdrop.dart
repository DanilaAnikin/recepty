import 'package:flutter/material.dart';

class AppBackdrop extends StatelessWidget {
  const AppBackdrop({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Color(0xFFFFF6F2),
            Color(0xFFF7EFE8),
            Color(0xFFF2E6DF),
          ],
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            top: -40,
            right: -20,
            child: _Blob(size: 180, color: Color(0xFFFFD7D7)),
          ),
          Positioned(
            top: 180,
            left: -48,
            child: _Blob(size: 148, color: Color(0xFFE9F1DA)),
          ),
          Positioned(
            bottom: -42,
            right: 8,
            child: _Blob(size: 132, color: Color(0xFFF5DDC9)),
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
