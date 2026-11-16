/// Where a doctor's certificate stands. Mirrors the `status` the backend
/// sends from `/api/me/verification/` and `verification_status` in the
/// profile.
enum VerificationStatus {
  notSubmitted,
  pending,
  approved,
  rejected,

  /// Anything this app does not recognise (a missing field, an older or
  /// newer backend). It is never treated as approved.
  unknown;

  static VerificationStatus parse(Object? value) {
    switch (value) {
      case 'not_submitted':
        return VerificationStatus.notSubmitted;
      case 'pending':
        return VerificationStatus.pending;
      case 'approved':
        return VerificationStatus.approved;
      case 'rejected':
        return VerificationStatus.rejected;
      default:
        return VerificationStatus.unknown;
    }
  }
}

/// A doctor's own verification record, as returned by
/// `GET /api/me/verification/`. It never carries the uploaded file.
class DoctorVerification {
  const DoctorVerification({
    required this.status,
    required this.submittedAt,
    required this.rejectionReason,
  });

  final VerificationStatus status;
  final DateTime? submittedAt;
  final String rejectionReason;

  factory DoctorVerification.fromJson(Map<String, dynamic> json) {
    final submitted = json['submitted_at'];
    final reason = json['rejection_reason'];
    return DoctorVerification(
      status: VerificationStatus.parse(json['status']),
      submittedAt: submitted is String ? DateTime.tryParse(submitted) : null,
      rejectionReason: reason is String ? reason : '',
    );
  }

  static const _months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  /// "13 Nov 2026, 10:42" in the device's time zone, or null when there is
  /// no submission time.
  String? get submittedLabel {
    final time = submittedAt?.toLocal();
    if (time == null) return null;
    final hour = time.hour.toString().padLeft(2, '0');
    final minute = time.minute.toString().padLeft(2, '0');
    return '${time.day} ${_months[time.month - 1]} ${time.year}, $hour:$minute';
  }
}
