import 'package:dikonekti/models/doctor_verification.dart';
import 'package:dikonekti/models/user_account.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> profile(String role, {Object? status = 'approved', bool withStatus = true}) => {
      'username': 'u1',
      'role': role,
      'first_name': 'Jane',
      'last_name': 'Doe',
      if (withStatus) 'verification_status': status,
    };

void main() {
  group('verificationStatus', () {
    test('is read for a doctor', () {
      final doctor = UserAccount.fromJson(profile('doctor', status: 'pending'));
      expect(doctor.verificationStatus, VerificationStatus.pending);
    });

    test('is null for a Disabled User (the backend sends null)', () {
      final patient = UserAccount.fromJson(profile('disabled', status: null));
      expect(patient.verificationStatus, isNull);
    });

    test('is unknown for a value this app does not know, and null when absent', () {
      expect(UserAccount.fromJson(profile('doctor', status: 'suspended')).verificationStatus, VerificationStatus.unknown);
      expect(UserAccount.fromJson(profile('doctor', withStatus: false)).verificationStatus, isNull);
    });
  });

  group('needsVerification', () {
    test('is false only for an approved doctor', () {
      expect(UserAccount.fromJson(profile('doctor', status: 'approved')).needsVerification, isFalse);
    });

    test('is true for every other doctor state, failing closed', () {
      for (final status in ['not_submitted', 'pending', 'rejected', 'suspended', '', null, 5]) {
        expect(UserAccount.fromJson(profile('doctor', status: status)).needsVerification, isTrue, reason: '$status');
      }
      expect(UserAccount.fromJson(profile('doctor', withStatus: false)).needsVerification, isTrue);
    });

    test('is false for a Disabled User whatever the field says', () {
      for (final status in ['approved', 'pending', null, 'rejected']) {
        expect(UserAccount.fromJson(profile('disabled', status: status)).needsVerification, isFalse, reason: '$status');
      }
    });

    test('treats the role case-insensitively like the rest of the app', () {
      expect(UserAccount.fromJson(profile('Doctor', status: 'pending')).needsVerification, isTrue);
      expect(UserAccount.fromJson(profile('DOCTOR', status: 'approved')).needsVerification, isFalse);
    });

    test('is false for an unknown role', () {
      expect(UserAccount.fromJson(profile('admin', status: null)).needsVerification, isFalse);
    });
  });

  test('existing fields still parse', () {
    final doctor = UserAccount.fromJson({...profile('doctor'), 'specialization': 'Vision', 'area': 'Stone Town'});
    expect(doctor.username, 'u1');
    expect(doctor.displayName, 'Dr. Jane Doe');
    expect(doctor.specialization, 'Vision');
    expect(doctor.area, 'Stone Town');
  });
}
