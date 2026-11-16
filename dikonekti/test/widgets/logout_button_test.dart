import 'package:dikonekti/widgets/logout_button.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/harness.dart';

void main() {
  Future<int> pump(WidgetTester tester) async {
    var logouts = 0;
    await tester.pumpWidget(appAround(Scaffold(appBar: AppBar(actions: [LogoutButton(onLogout: () => logouts++)]))));
    return logouts;
  }

  testWidgets('asks for confirmation before logging out', (tester) async {
    var logouts = 0;
    await tester.pumpWidget(appAround(Scaffold(appBar: AppBar(actions: [LogoutButton(onLogout: () => logouts++)]))));
    await tester.tap(find.byTooltip('Log out'));
    await tester.pumpAndSettle();
    expect(find.text('Log Out?'), findsOneWidget);
    expect(logouts, 0);
  });

  testWidgets('Cancel keeps the user signed in', (tester) async {
    var logouts = 0;
    await tester.pumpWidget(appAround(Scaffold(appBar: AppBar(actions: [LogoutButton(onLogout: () => logouts++)]))));
    await tester.tap(find.byTooltip('Log out'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(logouts, 0);
    expect(find.text('Log Out?'), findsNothing);
  });

  testWidgets('Log Out signs the user out exactly once', (tester) async {
    var logouts = 0;
    await tester.pumpWidget(appAround(Scaffold(appBar: AppBar(actions: [LogoutButton(onLogout: () => logouts++)]))));
    await tester.tap(find.byTooltip('Log out'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Log Out'));
    await tester.pumpAndSettle();
    expect(logouts, 1);
  });

  testWidgets('is announced to screen readers as a button', (tester) async {
    await pump(tester);
    expect(find.bySemanticsLabel('Log out button'), findsOneWidget);
  });
}
