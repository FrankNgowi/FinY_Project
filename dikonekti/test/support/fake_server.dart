import 'dart:convert';

import 'package:dikonekti/services/api_client.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

Map<String, dynamic> doctorProfile(String? status) => {
      'username': 'jane',
      'role': 'doctor',
      'first_name': 'Jane',
      'last_name': 'Doe',
      'verification_status': status,
    };

/// A stand-in for the Django backend: answers the few endpoints the doctor
/// screens call, from values a test can change while it runs.
class FakeServer {
  FakeServer({String? profileStatus = 'approved', this.verification = 'pending'})
      : profile = doctorProfile(profileStatus);

  Map<String, dynamic> profile;
  String verification;
  int meCalls = 0;
  int statusCalls = 0;
  bool meFails = false;

  void install() {
    FlutterSecureStorage.setMockInitialValues({
      'dikonekti_access_token': 'ACC',
      'dikonekti_refresh_token': 'REF',
    });
    ApiClient.verificationRequired.value = 0;
    ApiClient.client = MockClient((request) async {
      final path = request.url.path;
      if (path.endsWith('/me/verification/')) {
        statusCalls++;
        return _json({
          'status': verification,
          'submitted_at': '2026-11-13T10:42:00Z',
          'rejection_reason': '',
        });
      }
      if (path.endsWith('/me/')) {
        meCalls++;
        if (meFails) return _json({'detail': 'Server error'}, 500);
        return _json(profile);
      }
      if (path.endsWith('/alerts/') || path.endsWith('/patients/')) {
        return _json([]);
      }
      return _json({'detail': 'Not found.'}, 404);
    });
  }

  void uninstall() => ApiClient.client = http.Client();

  static http.Response _json(Object body, [int status = 200]) => http.Response(
        jsonEncode(body),
        status,
        headers: {'content-type': 'application/json'},
      );
}
