import 'package:flutter/material.dart';

class AppTheme {
  static ThemeData lightTheme() {
    return _buildTheme(Brightness.light);
  }

  static ThemeData darkTheme() {
    return _buildTheme(Brightness.dark);
  }

  static ThemeData _buildTheme(Brightness brightness) {
    const textTheme = TextTheme(
      displayLarge: TextStyle(
        fontFamily: 'Georgia',
        fontWeight: FontWeight.w700,
      ),
      displayMedium: TextStyle(
        fontFamily: 'Georgia',
        fontWeight: FontWeight.w700,
      ),
      displaySmall: TextStyle(
        fontFamily: 'Georgia',
        fontWeight: FontWeight.w700,
      ),
      headlineLarge: TextStyle(
        fontFamily: 'Georgia',
        fontWeight: FontWeight.w700,
      ),
      headlineMedium: TextStyle(
        fontFamily: 'Georgia',
        fontWeight: FontWeight.w700,
      ),
      headlineSmall: TextStyle(
        fontFamily: 'Georgia',
        fontWeight: FontWeight.w700,
      ),
      titleLarge: TextStyle(fontFamily: 'Georgia', fontWeight: FontWeight.w700),
      titleMedium: TextStyle(
        fontFamily: 'Georgia',
        fontWeight: FontWeight.w600,
      ),
      titleSmall: TextStyle(fontFamily: 'Georgia', fontWeight: FontWeight.w600),
      bodyLarge: TextStyle(fontFamily: 'Arial', fontWeight: FontWeight.w400),
      bodyMedium: TextStyle(fontFamily: 'Arial', fontWeight: FontWeight.w400),
      bodySmall: TextStyle(fontFamily: 'Arial', fontWeight: FontWeight.w400),
      labelLarge: TextStyle(fontFamily: 'Arial', fontWeight: FontWeight.w600),
      labelMedium: TextStyle(fontFamily: 'Arial', fontWeight: FontWeight.w600),
      labelSmall: TextStyle(fontFamily: 'Arial', fontWeight: FontWeight.w600),
    );

    final colorScheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFFC65670),
      brightness: brightness,
    );
    final isDark = brightness == Brightness.dark;
    final backgroundColors = isDark
        ? const AppThemeBackdrop(
            top: Color(0xFF171315),
            middle: Color(0xFF1C161A),
            bottom: Color(0xFF251A21),
            blobPrimary: Color(0xFF8D4357),
            blobSecondary: Color(0xFF416550),
            blobTertiary: Color(0xFF7C5C48),
          )
        : const AppThemeBackdrop(
            top: Color(0xFFFFF6F2),
            middle: Color(0xFFF7EFE8),
            bottom: Color(0xFFF2E6DF),
            blobPrimary: Color(0xFFFFD7D7),
            blobSecondary: Color(0xFFE9F1DA),
            blobTertiary: Color(0xFFF5DDC9),
          );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: backgroundColors.middle,
      textTheme: textTheme.apply(
        bodyColor: colorScheme.onSurface,
        displayColor: colorScheme.onSurface,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        foregroundColor: colorScheme.onSurface,
        centerTitle: false,
        titleTextStyle: textTheme.titleLarge?.copyWith(
          color: colorScheme.onSurface,
          fontSize: 22,
        ),
      ),
      cardTheme: CardThemeData(
        color: colorScheme.surfaceContainerHigh.withValues(
          alpha: isDark ? 0.92 : 0.97,
        ),
        margin: EdgeInsets.zero,
        elevation: 0.4,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(26),
          side: BorderSide(color: colorScheme.outlineVariant),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: colorScheme.surfaceContainerHigh,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: colorScheme.surfaceContainerHighest,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 14,
        ),
        hintStyle: TextStyle(color: colorScheme.onSurfaceVariant),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide(color: colorScheme.outlineVariant),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide(color: colorScheme.outlineVariant),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide(color: colorScheme.primary, width: 1.6),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: colorScheme.surfaceContainerHigh.withValues(
          alpha: 0.96,
        ),
        indicatorColor: colorScheme.secondaryContainer,
        labelTextStyle: WidgetStateProperty.all(
          textTheme.labelMedium?.copyWith(color: colorScheme.onSurface),
        ),
      ),
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: ButtonStyle(
          shape: WidgetStatePropertyAll(
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
          side: WidgetStatePropertyAll(
            BorderSide(color: colorScheme.outlineVariant),
          ),
          backgroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return colorScheme.primary;
            }
            return colorScheme.surfaceContainerHighest;
          }),
          foregroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return colorScheme.onPrimary;
            }
            return colorScheme.onSurfaceVariant;
          }),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: colorScheme.primary,
          foregroundColor: colorScheme.onPrimary,
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
          textStyle: textTheme.labelLarge,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: colorScheme.onSurface,
          side: BorderSide(color: colorScheme.outlineVariant),
          backgroundColor: colorScheme.surfaceContainerHigh.withValues(
            alpha: 0.88,
          ),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
          textStyle: textTheme.labelLarge,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: colorScheme.onSurface,
          textStyle: textTheme.labelLarge,
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: colorScheme.surfaceContainerHighest,
        selectedColor: colorScheme.secondaryContainer,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        side: BorderSide(color: colorScheme.outlineVariant),
        labelStyle: textTheme.labelMedium!.copyWith(
          color: colorScheme.onSurfaceVariant,
        ),
      ),
      popupMenuTheme: PopupMenuThemeData(
        color: colorScheme.surfaceContainerHigh,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: colorScheme.inverseSurface,
        contentTextStyle: textTheme.bodyMedium?.copyWith(
          color: colorScheme.onInverseSurface,
        ),
      ),
      dividerTheme: DividerThemeData(
        color: colorScheme.outlineVariant.withValues(alpha: 0.75),
      ),
      checkboxTheme: CheckboxThemeData(
        fillColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return colorScheme.primary;
          }
          return colorScheme.surfaceContainerHighest;
        }),
        side: BorderSide(color: colorScheme.outlineVariant),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: colorScheme.primary,
        foregroundColor: colorScheme.onPrimary,
      ),
      extensions: [backgroundColors],
    );
  }
}

class AppThemeBackdrop extends ThemeExtension<AppThemeBackdrop> {
  const AppThemeBackdrop({
    required this.top,
    required this.middle,
    required this.bottom,
    required this.blobPrimary,
    required this.blobSecondary,
    required this.blobTertiary,
  });

  final Color top;
  final Color middle;
  final Color bottom;
  final Color blobPrimary;
  final Color blobSecondary;
  final Color blobTertiary;

  @override
  AppThemeBackdrop copyWith({
    Color? top,
    Color? middle,
    Color? bottom,
    Color? blobPrimary,
    Color? blobSecondary,
    Color? blobTertiary,
  }) {
    return AppThemeBackdrop(
      top: top ?? this.top,
      middle: middle ?? this.middle,
      bottom: bottom ?? this.bottom,
      blobPrimary: blobPrimary ?? this.blobPrimary,
      blobSecondary: blobSecondary ?? this.blobSecondary,
      blobTertiary: blobTertiary ?? this.blobTertiary,
    );
  }

  @override
  AppThemeBackdrop lerp(ThemeExtension<AppThemeBackdrop>? other, double t) {
    if (other is! AppThemeBackdrop) {
      return this;
    }
    return AppThemeBackdrop(
      top: Color.lerp(top, other.top, t) ?? top,
      middle: Color.lerp(middle, other.middle, t) ?? middle,
      bottom: Color.lerp(bottom, other.bottom, t) ?? bottom,
      blobPrimary: Color.lerp(blobPrimary, other.blobPrimary, t) ?? blobPrimary,
      blobSecondary:
          Color.lerp(blobSecondary, other.blobSecondary, t) ?? blobSecondary,
      blobTertiary:
          Color.lerp(blobTertiary, other.blobTertiary, t) ?? blobTertiary,
    );
  }
}
