import 'package:dikonekti/models/user_account.dart';
import 'package:dikonekti/services/api_client.dart';
import 'package:dikonekti/services/alert_api_service.dart';
import 'package:dikonekti/services/location_service.dart';

class EmergencyAlertSendResult {
  const EmergencyAlertSendResult({
    required this.success,
    required this.message,
    required this.hasLocation,
    required this.noDoctorRegistered,
  });

  final bool success;
  final String message;
  final bool hasLocation;
  final bool noDoctorRegistered;
}

/// The actual work of sending an emergency alert: get a best-effort GPS
/// fix, then post to the backend. Used by both the manual Emergency Alert
/// button and the voice-trigger listener so the two paths share one
/// implementation instead of two that could quietly drift apart.
class EmergencyAlertSender {
  static Future<EmergencyAlertSendResult> send(UserAccount user) async {
    final location = await LocationService.getCurrentLocation();
    final noDoctorRegistered = user.registeredDoctor == null;

    try {
      await EmergencyAlertApiService.createAlert(
        latitude: location.latitude,
        longitude: location.longitude,
        locationError: location.error,
      );

      final String message;
      if (noDoctorRegistered) {
        message = 'Emergency alert saved, but no doctor is registered to '
            'your account yet, so no one has been notified. Please add a '
            'doctor from your profile.';
      } else if (location.hasCoordinates) {
        message =
            'Emergency alert sent with your location. Help is on the way.';
      } else {
        message = 'Emergency alert sent. We could not attach your location, '
            'but your doctor has been notified.';
      }

      return EmergencyAlertSendResult(
        success: true,
        message: message,
        hasLocation: location.hasCoordinates,
        noDoctorRegistered: noDoctorRegistered,
      );
    } catch (e) {
      final message = e is ApiException
          ? 'Could not send alert: ${e.message}'
          : 'Could not send the alert. Please check your connection and '
              'try again immediately.';
      return EmergencyAlertSendResult(
        success: false,
        message: message,
        hasLocation: false,
        noDoctorRegistered: noDoctorRegistered,
      );
    }
  }
}