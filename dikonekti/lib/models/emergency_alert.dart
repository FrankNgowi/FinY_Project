class EmergencyAlert {
  EmergencyAlert({
    required this.id,
    required this.patientUsername,
    required this.patientName,
    this.patientArea,
    this.disabilityType,
    this.doctorUsername,
    this.latitude,
    this.longitude,
    this.locationError,
    DateTime? timestamp,
    this.acknowledged = false,
  }) : timestamp = timestamp ?? DateTime.now();

  final String id;

  /// The patient's `username`, so a doctor can cross-reference the alert
  /// back to a specific record in their patient list.
  final String patientUsername;
  final String patientName;
  final String? patientArea;
  final String? disabilityType;

  /// The `username` of the doctor this alert is routed to. A doctor's
  /// dashboard only ever shows alerts where this matches their own
  /// username, so one patient's emergency doesn't fan out to every doctor
  /// in the system.
  final String? doctorUsername;

  final double? latitude;
  final double? longitude;

  /// Set when we tried to attach GPS coordinates but couldn't (permission
  /// denied, location services off, timed out, etc). The alert still gets
  /// sent immediately either way — a missing location should never block
  /// an emergency alert — this just tells the doctor why there's no pin.
  final String? locationError;

  final DateTime timestamp;
  bool acknowledged;

  bool get hasLocation => latitude != null && longitude != null;

  /// A Google Maps link a doctor can tap straight from the alert card.
  String? get mapsUrl => hasLocation
      ? 'https://www.google.com/maps/search/?api=1&query=$latitude,$longitude'
      : null;

  String get coordinatesLabel => hasLocation
      ? '${latitude!.toStringAsFixed(5)}, ${longitude!.toStringAsFixed(5)}'
      : 'Location unavailable';

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'patientUsername': patientUsername,
      'patientName': patientName,
      'patientArea': patientArea,
      'disabilityType': disabilityType,
      'doctorUsername': doctorUsername,
      'latitude': latitude,
      'longitude': longitude,
      'locationError': locationError,
      'timestamp': timestamp.toIso8601String(),
      'acknowledged': acknowledged,
    };
  }

  factory EmergencyAlert.fromJson(Map<String, dynamic> json) {
    return EmergencyAlert(
      id: json['id'] as String? ?? DateTime.now().microsecondsSinceEpoch.toString(),
      patientUsername: json['patientUsername'] as String? ?? '',
      patientName: json['patientName'] as String? ?? '',
      patientArea: json['patientArea'] as String?,
      disabilityType: json['disabilityType'] as String?,
      doctorUsername: json['doctorUsername'] as String?,
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      locationError: json['locationError'] as String?,
      timestamp: json['timestamp'] != null
          ? DateTime.tryParse(json['timestamp'] as String) ?? DateTime.now()
          : DateTime.now(),
      acknowledged: json['acknowledged'] as bool? ?? false,
    );
  }
}