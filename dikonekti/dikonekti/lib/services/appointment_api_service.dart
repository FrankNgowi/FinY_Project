import 'package:dikonekti/models/appointment.dart';

import 'api_client.dart';

/// Talks to the Django backend's /api/appointments/ endpoints.
///
/// Same routing pattern as EmergencyAlertApiService: no doctor/patient
/// username ever appears in a request — the server resolves both sides
/// from whoever's token made the call.
class AppointmentApiService {
  /// Disabled-user only.
  static Future<Appointment> createAppointment({
    required DateTime requestedTime,
    String reason = '',
  }) async {
    final response = await ApiClient.postMap('/appointments/', {
      'requested_time': requestedTime.toIso8601String(),
      'reason': reason,
    });
    return Appointment.fromJson(response);
  }

  /// Doctor: appointments routed to them. Disabled user: appointments
  /// they requested. Which one you get depends on who's logged in.
  static Future<List<Appointment>> getAppointments() async {
    final response = await ApiClient.getList('/appointments/');
    return response
        .cast<Map<String, dynamic>>()
        .map(Appointment.fromJson)
        .toList();
  }

  /// Doctor-only. [status] must be 'confirmed' or 'declined'.
  static Future<Appointment> updateStatus(
    String appointmentId,
    String status,
  ) async {
    final response = await ApiClient.patchMap(
      '/appointments/$appointmentId/status/',
      {'status': status},
    );
    return Appointment.fromJson(response);
  }
}