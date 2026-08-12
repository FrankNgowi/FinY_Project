class Appointment {
  Appointment({
    required this.id,
    required this.patientUsername,
    required this.patientName,
    required this.requestedTime,
    required this.reason,
    required this.status,
    required this.createdAt,
  });

  final String id;
  final String patientUsername;
  final String patientName;
  final DateTime requestedTime;
  final String reason;

  /// 'pending', 'confirmed', or 'declined'.
  final String status;
  final DateTime createdAt;

  bool get isPending => status == 'pending';
  bool get isConfirmed => status == 'confirmed';
  bool get isDeclined => status == 'declined';

  factory Appointment.fromJson(Map<String, dynamic> json) {
    return Appointment(
      id: json['id'].toString(),
      patientUsername: json['patient_username'] as String? ?? '',
      patientName: json['patient_name'] as String? ?? '',
      requestedTime:
          DateTime.tryParse(json['requested_time'] as String? ?? '') ??
              DateTime.now(),
      reason: json['reason'] as String? ?? '',
      status: json['status'] as String? ?? 'pending',
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ??
          DateTime.now(),
    );
  }
}