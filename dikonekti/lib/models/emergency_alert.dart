class EmergencyAlert {
  EmergencyAlert({
    required this.id,
    required this.patientUsername,
    required this.patientName,
    this.patientArea,
    this.disabilityType,
    this.latitude,
    this.longitude,
    this.locationError,
    required this.timestamp,
    this.acknowledged = false,
  });

  final String id;
  final String patientUsername;
  final String patientName;
  final String? patientArea;
  final String? disabilityType;
  final double? latitude;
  final double? longitude;

  /// Set when the app tried to attach GPS coordinates but couldn't
  /// (permission denied, location services off, timed out, etc). The
  /// alert still gets sent regardless — this just tells the doctor why
  /// there's no pin.
  final String? locationError;

  final DateTime timestamp;
  final bool acknowledged;

  bool get hasLocation => latitude != null && longitude != null;

  String? get mapsUrl => hasLocation
      ? 'https://www.google.com/maps/search/?api=1&query=$latitude,$longitude'
      : null;

  String get coordinatesLabel => hasLocation
      ? '${latitude!.toStringAsFixed(5)}, ${longitude!.toStringAsFixed(5)}'
      : 'Location unavailable';

  factory EmergencyAlert.fromJson(Map<String, dynamic> json) {
    return EmergencyAlert(
      id: json['id'].toString(),
      patientUsername: json['patient_username'] as String? ?? '',
      patientName: json['patient_name'] as String? ?? '',
      patientArea: json['patient_area'] as String?,
      disabilityType: json['disability_type'] as String?,
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      locationError: json['location_error'] as String?,
      timestamp: DateTime.tryParse(json['timestamp'] as String? ?? '') ??
          DateTime.now(),
      acknowledged: json['acknowledged'] as bool? ?? false,
    );
  }
}