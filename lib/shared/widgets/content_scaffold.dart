import 'package:flutter/material.dart';

import '../../core/utils/layout_utils.dart';
import 'app_backdrop.dart';

class ContentScaffold extends StatelessWidget {
  const ContentScaffold({
    required this.body,
    super.key,
    this.appBar,
    this.floatingActionButton,
  });

  final PreferredSizeWidget? appBar;
  final Widget body;
  final Widget? floatingActionButton;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: appBar,
      floatingActionButton: floatingActionButton,
      body: AppBackdrop(
        child: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) {
              return Align(
                alignment: Alignment.topCenter,
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    maxWidth: LayoutUtils.contentWidth(constraints),
                  ),
                  child: body,
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
