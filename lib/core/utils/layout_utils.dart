import 'package:flutter/widgets.dart';

class LayoutUtils {
  static double contentWidth(BoxConstraints constraints) {
    if (constraints.maxWidth >= 1200) {
      return 920;
    }
    if (constraints.maxWidth >= 900) {
      return 760;
    }
    return constraints.maxWidth;
  }
}
