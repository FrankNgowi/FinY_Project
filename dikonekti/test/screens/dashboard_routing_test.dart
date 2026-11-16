import 'package:dikonekti/models/user_account.dart';
import 'package:dikonekti/screens/dashboard_components.dart';
import 'package:dikonekti/screens/dashboard_page.dart';
import 'package:dikonekti/screens/verification_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/fake_server.dart';
import '../support/harness.dart';

UserAccount account(String role, Object? status, {bool withStatus = true}) => UserAccount.fromJson({
      'username': 'u1',
      'role': role,
      'first_name': 'Jane',
      'last_name': 'Doe',
      if (withStatus) 'verification_status': status,
    });

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('dashboardKindFor', () {
    test('sends an approved doctor to the dashboard', () {
      expect(dashboardKindFor(account('doctor', 'approved')), DashboardKind.doctor);
    });

    test('sends every other doctor state to verification, failing closed', () {
      for (final status in ['not_submitted', 'pending', 'rejected', 'suspended', '', null]) {
        expect(dashboardKindFor(account('doctor', status)), DashboardKind.verification, reason: '$status');
      }
      expect(dashboardKindFor(account('doctor', null, withStatus: false)), DashboardKind.verification);
    });

    test('leaves a Disabled User exactly where they were, whatever the field says', () {
      for (final status in [null, 'approved', 'pending']) {
        expect(dashboardKindFor(account('disabled', status)), DashboardKind.patient, reason: '$status');
      }
    });

    test('treats an unknown role like a patient did before (not as a doctor)', () {
      expect(dashboardKindFor(account('admin', null)), DashboardKind.patient);
    });
  });

  group('DashboardPage', () {
    late FakeServer server;
    setUp(() => (server = FakeServer())..install());
    tearDown(() => server.uninstall());

    Future<void> show(WidgetTester tester, UserAccount user, {VoidCallback? onProfileChanged}) async {
      await tester.pumpWidget(appAround(DashboardPage(
        user: user,
        onLogout: () {},
        onProfileChanged: onProfileChanged ?? () {},
      )));
      addTearDown(() async => tester.pumpWidget(const SizedBox()));
      await tester.pump();
      await tester.pump();
    }

    testWidgets('shows the verification screen to a doctor who is not approved', (tester) async {
      for (final status in ['not_submitted', 'pending', 'rejected']) {
        server.verification = status;
        await show(tester, account('doctor', status));
        expect(find.byType(VerificationPage), findsOneWidget, reason: status);
        expect(find.byType(DoctorDashboard), findsNothing, reason: status);
        await tester.pumpWidget(const SizedBox());
      }
    });

    testWidgets('shows the doctor dashboard to an approved doctor and never asks for verification', (tester) async {
      await show(tester, account('doctor', 'approved'));
      expect(find.byType(DoctorDashboard), findsOneWidget);
      expect(find.byType(VerificationPage), findsNothing);
      expect(server.statusCalls, 0);
    });

    testWidgets('tells the app when the doctor is approved so it can read the profile again', (tester) async {
      var changes = 0;
      server.verification = 'approved';
      await show(tester, account('doctor', 'pending'), onProfileChanged: () => changes++);
      expect(changes, 1);
    });
  });
}
