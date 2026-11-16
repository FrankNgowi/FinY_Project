import 'dart:async';

import 'package:dikonekti/app/app.dart';
import 'package:dikonekti/screens/dashboard_components.dart';
import 'package:dikonekti/screens/login_page.dart';
import 'package:dikonekti/screens/verification_page.dart';
import 'package:dikonekti/services/api_client.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/fake_server.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late FakeServer server;
  tearDown(() => server.uninstall());

  Future<void> open(WidgetTester tester) async {
    await tester.pumpWidget(const MyApp());
    addTearDown(() async => tester.pumpWidget(const SizedBox()));
    await tester.pumpAndSettle();
  }

  group('restoring a session', () {
    testWidgets('opens the dashboard for an approved doctor', (tester) async {
      server = FakeServer(profileStatus: 'approved')..install();
      await open(tester);
      expect(find.byType(DoctorDashboard), findsOneWidget);
      expect(find.byType(VerificationPage), findsNothing);
    });

    testWidgets('opens the verification screen for a doctor who is not approved', (tester) async {
      for (final status in ['not_submitted', 'pending', 'rejected', null]) {
        server = FakeServer(profileStatus: status, verification: status ?? 'not_submitted')..install();
        await open(tester);
        expect(find.byType(VerificationPage), findsOneWidget, reason: '$status');
        expect(find.byType(DoctorDashboard), findsNothing, reason: '$status');
        await tester.pumpWidget(const SizedBox());
      }
    });
  });

  group('when approval is withdrawn while the doctor is using the app', () {
    testWidgets('swaps the dashboard for the verification screen', (tester) async {
      server = FakeServer(profileStatus: 'approved', verification: 'rejected')..install();
      await open(tester);
      expect(find.byType(DoctorDashboard), findsOneWidget);

      server.profile = doctorProfile('rejected'); // an admin revoked them
      ApiClient.verificationRequired.value++; // what a refused request announces
      await tester.pumpAndSettle();

      expect(find.byType(VerificationPage), findsOneWidget);
      expect(find.byType(DoctorDashboard), findsNothing);
    });

    testWidgets('stays on the dashboard when the profile still says approved', (tester) async {
      server = FakeServer(profileStatus: 'approved')..install();
      await open(tester);
      ApiClient.verificationRequired.value++;
      await tester.pumpAndSettle();
      expect(find.byType(DoctorDashboard), findsOneWidget);
      expect(server.meCalls, 2); // once on start, once for the announcement
    });

    testWidgets('keeps the current screen when the profile cannot be read', (tester) async {
      server = FakeServer(profileStatus: 'approved')..install();
      await open(tester);
      server.meFails = true;
      ApiClient.verificationRequired.value++;
      await tester.pumpAndSettle();
      expect(find.byType(DoctorDashboard), findsOneWidget);
    });

    testWidgets('does not react after the app is closed', (tester) async {
      server = FakeServer(profileStatus: 'approved')..install();
      await open(tester);
      await tester.pumpWidget(const SizedBox());
      final before = server.meCalls;
      ApiClient.verificationRequired.value++;
      await tester.pump(const Duration(seconds: 1));
      expect(server.meCalls, before);
    });
  });

  testWidgets('a slow profile reply that lands after logout does not sign the user back in', (tester) async {
    server = FakeServer(profileStatus: 'approved')..install();
    await open(tester);
    expect(find.byType(DoctorDashboard), findsOneWidget);

    server.meGate = Completer<void>();
    ApiClient.verificationRequired.value++; // refresh starts and waits on the gate
    await tester.pump();

    await tester.tap(find.byTooltip('Log out'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Log Out'));
    await tester.pumpAndSettle();
    expect(find.byType(LoginPage), findsOneWidget);

    server.meGate!.complete(); // the old reply arrives now
    await tester.pumpAndSettle();
    expect(find.byType(LoginPage), findsOneWidget);
    expect(find.byType(DoctorDashboard), findsNothing);
  });

  group('after approval', () {
    testWidgets('moves a waiting doctor to the dashboard within about 30 seconds, without reopening the app', (tester) async {
      server = FakeServer(profileStatus: 'pending', verification: 'pending')..install();
      await open(tester);
      expect(find.byType(VerificationPage), findsOneWidget);

      server.verification = 'approved'; // the admin approved them
      server.profile = doctorProfile('approved');
      await tester.pump(const Duration(seconds: 31));
      await tester.pumpAndSettle();

      expect(find.byType(DoctorDashboard), findsOneWidget);
      expect(find.byType(VerificationPage), findsNothing);
    });

    testWidgets('keeps checking if the profile is not approved yet when the status says it is', (tester) async {
      server = FakeServer(profileStatus: 'pending', verification: 'approved')..install();
      await open(tester);
      // the status says approved but /me/ is behind: the screen stays and tries again
      expect(find.byType(VerificationPage), findsOneWidget);
      server.profile = doctorProfile('approved');
      await tester.pump(const Duration(seconds: 31));
      await tester.pumpAndSettle();
      expect(find.byType(DoctorDashboard), findsOneWidget);
    });
  });

  testWidgets('shows the login page when no one is signed in, and never asks about verification', (tester) async {
    server = FakeServer()..install();
    FlutterSecureStorage.setMockInitialValues({}); // no stored token
    await open(tester);
    expect(find.byType(LoginPage), findsOneWidget);
    expect(find.byType(VerificationPage), findsNothing);
    expect(server.meCalls, 0);
  });
}
