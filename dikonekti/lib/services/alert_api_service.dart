import 'package:dikonekti/models/emergency_alert.dart';

import 'api_client.dart';

/// Talks to the Django backend's /api/alerts/ endpoints.
///
/// Note there's no `doctorUsername` parameter anywhere here — the server
/// resolves the doctor from whichever patient's token sent the request,
/// and scopes `getAlerts()` to whoever is logged in. The client can't
/// spoof either side of that relationship.
class EmergencyAlertApiService {
  /// Disabled-user only. Sends whatever GPS fix (if any) was obtained —
  /// a missing location should never block an emergency alert, so both
  /// [latitude]/[longitude] and [locationError] are optional.
  static Future<EmergencyAlert> createAlert({
    double? latitude,
    double? longitude,
    String? locationError,
  }) async {
    final response = await ApiClient.postMap('/alerts/', {
      'latitude': latitude,
      'longitude': longitude,
      'location_error': locationError,
    });
    return EmergencyAlert.fromJson(response);
  }

  /// Doctor: alerts routed to them. Disabled user: alerts they sent.
  /// Which one you get back depends entirely on who's logged in.
  static Future<List<EmergencyAlert>> getAlerts() async {
    final response = await ApiClient.getList('/alerts/');
    return response
        .cast<Map<String, dynamic>>()
        .map(EmergencyAlert.fromJson)
        .toList();
  }

  /// Doctor-only, and only for an alert actually routed to them — the
  /// server rejects (403) any attempt to acknowledge someone else's.
  static Future<EmergencyAlert> acknowledgeAlert(String alertId) async {
    final response = await ApiClient.patchMap(
      '/alerts/$alertId/acknowledge/',
      {},
    );
    return EmergencyAlert.fromJson(response);
  }
}