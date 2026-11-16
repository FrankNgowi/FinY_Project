import 'package:dikonekti/models/doctor_verification.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('VerificationStatus.parse', () {
    test('reads the four values the backend sends', () {
      expect(VerificationStatus.parse('not_submitted'), VerificationStatus.notSubmitted);
      expect(VerificationStatus.parse('pending'), VerificationStatus.pending);
      expect(VerificationStatus.parse('approved'), VerificationStatus.approved);
      expect(VerificationStatus.parse('rejected'), VerificationStatus.rejected);
    });

    test('anything else is unknown, never approved', () {
      for (final value in [null, '', ' ', 'Approved', 'APPROVED', 'approved ', 'suspended', 'approve', '1']) {
        expect(VerificationStatus.parse(value), VerificationStatus.unknown, reason: '"$value"');
      }
    });
  });

  group('DoctorVerification.fromJson', () {
    test('parses a pending record', () {
      final record = DoctorVerification.fromJson({
        'status': 'pending',
        'submitted_at': '2026-11-13T10:42:00Z',
        'rejection_reason': '',
      });
      expect(record.status, VerificationStatus.pending);
      expect(record.submittedAt, DateTime.utc(2026, 11, 13, 10, 42));
      expect(record.rejectionReason, '');
    });

    test('a record that was never submitted has no time', () {
      final record = DoctorVerification.fromJson({
        'status': 'not_submitted',
        'submitted_at': null,
        'rejection_reason': '',
      });
      expect(record.submittedAt, isNull);
      expect(record.submittedLabel, isNull);
    });

    test('keeps the reviewer reason exactly as sent, markup included', () {
      final record = DoctorVerification.fromJson({
        'status': 'rejected',
        'submitted_at': '2026-11-13T10:42:00Z',
        'rejection_reason': '<b>Licence</b> number does not match.',
      });
      expect(record.rejectionReason, '<b>Licence</b> number does not match.');
    });

    test('copes with missing, null and malformed fields', () {
      final empty = DoctorVerification.fromJson({});
      expect(empty.status, VerificationStatus.unknown);
      expect(empty.submittedAt, isNull);
      expect(empty.rejectionReason, '');

      final odd = DoctorVerification.fromJson({
        'status': 7,
        'submitted_at': 'not a date',
        'rejection_reason': null,
      });
      expect(odd.status, VerificationStatus.unknown);
      expect(odd.submittedAt, isNull);
      expect(odd.rejectionReason, '');
    });
  });

  group('submittedLabel', () {
    test('reads like "13 Nov 2026, 10:42" in the device time zone', () {
      final local = DateTime(2026, 11, 13, 10, 42);
      final record = DoctorVerification.fromJson({
        'status': 'pending',
        'submitted_at': local.toUtc().toIso8601String(),
        'rejection_reason': '',
      });
      expect(record.submittedLabel, '13 Nov 2026, 10:42');
    });

    test('pads hours and minutes and uses the right month name', () {
      final local = DateTime(2027, 1, 5, 9, 5);
      final record = DoctorVerification(
        status: VerificationStatus.pending,
        submittedAt: local.toUtc(),
        rejectionReason: '',
      );
      expect(record.submittedLabel, '5 Jan 2027, 09:05');
    });

    test('has a name for every month', () {
      const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      for (var month = 1; month <= 12; month++) {
        final record = DoctorVerification(
          status: VerificationStatus.pending,
          submittedAt: DateTime(2026, month, 15, 12, 0).toUtc(),
          rejectionReason: '',
        );
        expect(record.submittedLabel, '15 ${names[month - 1]} 2026, 12:00');
      }
    });
  });
}
