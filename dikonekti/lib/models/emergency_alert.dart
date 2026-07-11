class EmergencyAlert {
  EmergencyAlert({
    required this.id,
    required this.patientName,
    this.patientArea,
    this.disabilityType,
    this.latitude,
    this.longitude,
    DateTime? timestamp,
    this.acknowledged = false,
  }) : timestamp = timestamp ?? DateTime.now();

  final String id;
  final String patientName;
  final String? patientArea;
  final String? disabilityType;
  final double? latitude;
  final double? longitude;
  final DateTime timestamp;
  bool acknowledged;
}
