class TextNormalizer {
  static const Map<String, String> _diacritics = {
    'á': 'a',
    'ä': 'a',
    'č': 'c',
    'ď': 'd',
    'é': 'e',
    'ě': 'e',
    'ë': 'e',
    'í': 'i',
    'ľ': 'l',
    'ĺ': 'l',
    'ň': 'n',
    'ó': 'o',
    'ô': 'o',
    'ö': 'o',
    'ř': 'r',
    'ŕ': 'r',
    'š': 's',
    'ť': 't',
    'ú': 'u',
    'ů': 'u',
    'ü': 'u',
    'ý': 'y',
    'ž': 'z',
  };

  static String normalize(String value) {
    final collapsed = value.trim().toLowerCase().replaceAll(RegExp(r'\s+'), ' ');
    final buffer = StringBuffer();
    for (final rune in collapsed.runes) {
      final char = String.fromCharCode(rune);
      buffer.write(_diacritics[char] ?? char);
    }
    return buffer.toString();
  }

  static String firstLetter(String value) {
    final normalized = normalize(value);
    if (normalized.isEmpty) {
      return '#';
    }
    final first = normalized[0].toUpperCase();
    return RegExp(r'[A-Z]').hasMatch(first) ? first : '#';
  }
}
