import 'dart:convert';

import 'package:dikonekti/screens/create_account_page.dart';
import 'package:dikonekti/services/api_client.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import '../support/harness.dart';

void main() {
  // The doctor list is read through ApiClient, which looks in the token store first.
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  tearDown(() => ApiClient.client = http.Client());

  Future<void> showPage(WidgetTester tester, http.Response Function() doctors) async {
    ApiClient.client = MockClient((request) async => doctors());
    tester.view.physicalSize = const Size(900, 3000);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(appAround(CreateAccountPage(onLoginSuccess: (_) {})));
    await tester.pumpAndSettle();
  }

  http.Response ok(Object body) => http.Response(jsonEncode(body), 200, headers: {'content-type': 'application/json'});

  group('the doctor list a Disabled User picks from', () {
    testWidgets('says no verified doctor is available when the list is empty, and sign-up still works without one', (tester) async {
      await showPage(tester, () => ok([]));
      expect(find.text('No verified doctors are available yet. You can add one later from your profile.'), findsOneWidget);
      expect(find.textContaining('No doctors have registered yet'), findsNothing);
      expect(find.text('Registered Doctor'), findsNothing);
    });

    testWidgets('offers the doctors the server sends (it only sends approved ones) and no empty-list notice', (tester) async {
      await showPage(tester, () => ok([
            {'username': 'jane', 'role': 'doctor', 'first_name': 'Jane', 'last_name': 'Doe', 'specialization': 'Vision'},
          ]));
      expect(find.text('Registered Doctor'), findsOneWidget);
      expect(find.textContaining('No verified doctors'), findsNothing);
    });

    testWidgets('keeps the existing message when the list cannot be loaded', (tester) async {
      await showPage(tester, () => http.Response(jsonEncode({'detail': 'Server error'}), 500, headers: {'content-type': 'application/json'}));
      expect(find.textContaining('Could not load doctors (Server error)'), findsOneWidget);
    });
  });

  group('registrationSuccessMessage', () {
    test('tells a doctor what to do next', () {
      expect(registrationSuccessMessage(isDoctor: true), 'Account created. Next, upload your confirmation letter or certificate.');
    });

    test('keeps the existing text for a Disabled User', () {
      expect(registrationSuccessMessage(isDoctor: false), 'Account created successfully.');
    });
  });
}
