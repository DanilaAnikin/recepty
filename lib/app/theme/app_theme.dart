import 'package:flutter/material.dart';

class AppTheme {
  static ThemeData lightTheme() {
    const textTheme = TextTheme(
      displayLarge: TextStyle(fontFamily: 'Georgia', fontWeight: FontWeight.w700),
      displayMedium: TextStyle(fontFamily: 'Georgia', fontWeight: FontWeight.w700),
      displaySmall: TextStyle(fontFamily: 'Georgia', fontWeight: FontWeight.w700),
      headlineLarge: TextStyle(fontFamily: 'Georgia', fontWeight: FontWeight.w700),
      headlineMedium: TextStyle(fontFamily: 'Georgia', fontWeight: FontWeight.w700),
      headlineSmall: TextStyle(fontFamily: 'Georgia', fontWeight: FontWeight.w700),
      titleLarge: TextStyle(fontFamily: 'Georgia', fontWeight: FontWeight.w700),
      titleMedium: TextStyle(fontFamily: 'Georgia', fontWeight: FontWeight.w600),
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
      brightness: Brightness.light,
      surface: const Color(0xFFFFFBF8),
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: const Color(0xFFF7EFE8),
      textTheme: textTheme.apply(
        bodyColor: const Color(0xFF241B19),
        displayColor: const Color(0xFF241B19),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        foregroundColor: const Color(0xFF241B19),
        centerTitle: false,
        titleTextStyle: textTheme.titleLarge?.copyWith(
          color: const Color(0xFF241B19),
          fontSize: 22,
        ),
      ),
      cardTheme: CardThemeData(
        color: Colors.white.withValues(alpha: 0.97),
        margin: EdgeInsets.zero,
        elevation: 0.4,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(26),
          side: const BorderSide(color: Color(0xFFE6D4CA)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        hintStyle: const TextStyle(color: Color(0xFF8C7771)),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: Color(0xFFDECBC1)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: Color(0xFFDECBC1)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: Color(0xFFB94D67), width: 1.6),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: Colors.white.withValues(alpha: 0.96),
        indicatorColor: const Color(0xFFF2D7DE),
        labelTextStyle: WidgetStateProperty.all(
          textTheme.labelMedium?.copyWith(color: const Color(0xFF241B19)),
        ),
      ),
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: ButtonStyle(
          shape: WidgetStatePropertyAll(
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
          side: const WidgetStatePropertyAll(
            BorderSide(color: Color(0xFFE0D1C8)),
          ),
          backgroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return const Color(0xFFC65670);
            }
            return Colors.white;
          }),
          foregroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return Colors.white;
            }
            return const Color(0xFF5B4945);
          }),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: const Color(0xFFC65670),
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          textStyle: textTheme.labelLarge,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: const Color(0xFF6A5550),
          side: const BorderSide(color: Color(0xFFD8C2B7)),
          backgroundColor: Colors.white.withValues(alpha: 0.88),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          textStyle: textTheme.labelLarge,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: const Color(0xFF6A5550),
          textStyle: textTheme.labelLarge,
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: Colors.white,
        selectedColor: const Color(0xFFF4CFD7),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        side: const BorderSide(color: Color(0xFFDECBC1)),
        labelStyle: textTheme.labelMedium!.copyWith(color: const Color(0xFF6A5550)),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: Color(0xFFBE536B),
        foregroundColor: Colors.white,
      ),
    );
  }
}
