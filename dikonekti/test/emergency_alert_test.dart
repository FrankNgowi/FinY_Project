import 'package:flutter_test/flutter_test.dart';
import 'package:dikonekti/models/emergency_alert.dart';

void main() {
  test('emergency alert stores coordinates for doctor notification', () {
    final alert = EmergencyAlert(
      id: 'alert-1',
      patientName: 'Jane Doe',
      latitude: 6.5244,
      longitude: 3.3792,
    );

    expect(alert.latitude, 6.5244);
    expect(alert.longitude, 3.3792);
  });
}
