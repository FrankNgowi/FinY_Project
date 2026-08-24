import 'package:dikonekti/models/user_account.dart';

import 'api_client.dart';
import 'token_storage.dart';

/// Talks to the Django backend's /api/auth/, /api/me/, /api/doctors/, and
/// /api/patients/ endpoints.
///
/// Method names and general shape intentionally mirror the old SQLite
/// version so callers barely change, but note two real differences:
/// - There's no local password storage anymore — auth state lives in the
///   JWT tokens ([TokenStorage]), not a cached UserAccount.
/// - registerUser/loginUser now throw [ApiException] with the server's
///   own validation message on failure, instead of a generic Exception.
class UserApiService {
  /// Registers a new account. Throws [ApiException] with a field-specific
  /// message (e.g. "Username already exists") on validation failure.
  static Future<UserAccount> registerUser({
    required String username,
    required String password,
    required String role,
    required String firstName,
    required String middleName,
    required String lastName,
    required String email,
    required String area,
    String? registeredDoctorUsername,
    String? disabilityType,
    String? specialization,
  }) async {
    final response = await ApiClient.postMap(
      '/auth/register/',
      {
        'username': username,
        'password': password,
        'role': role,
        'first_name': firstName,
        'middle_name': middleName,
        'last_name': lastName,
        'email': email,
        'area': area,
        'registered_doctor_username': registeredDoctorUsername,
        'disability_type': disabilityType,
        'specialization': specialization,
      },
      requiresAuth: false,
    );

    await TokenStorage.saveTokens(
      access: response['access'] as String,
      refresh: response['refresh'] as String,
    );

    return UserAccount.fromJson(response['profile'] as Map<String, dynamic>);
  }

  /// Logs in and stores the resulting JWT pair. Throws [ApiException]
  /// ("No active account found with the given credentials", from
  /// SimpleJWT) on bad credentials.
  static Future<UserAccount> loginUser({
    required String username,
    required String password,
  }) async {
    final response = await ApiClient.postMap(
      '/auth/login/',
      {'username': username, 'password': password},
      requiresAuth: false,
    );

    await TokenStorage.saveTokens(
      access: response['access'] as String,
      refresh: response['refresh'] as String,
    );

    return UserAccount.fromJson(response['profile'] as Map<String, dynamic>);
  }

  /// Re-fetches the current profile — e.g. call this on app launch if a
  /// token is already stored, instead of caching profile data locally.
  static Future<UserAccount> getCurrentProfile() async {
    final response = await ApiClient.getMap('/me/');
    return UserAccount.fromJson(response);
  }

  /// Public — no auth required. Populates the sign-up "Registered Doctor"
  /// dropdown.
  static Future<List<UserAccount>> getAllDoctors() async {
    final response = await ApiClient.getList('/doctors/');
    return response
        .cast<Map<String, dynamic>>()
        .map(UserAccount.fromJson)
        .toList();
  }

  /// The logged-in doctor's own patients. No username parameter — the
  /// server scopes this to whoever the access token belongs to.
  static Future<List<UserAccount>> getMyPatients() async {
    final response = await ApiClient.getList('/patients/');
    return response
        .cast<Map<String, dynamic>>()
        .map(UserAccount.fromJson)
        .toList();
  }

  static Future<void> logout() => TokenStorage.clear();
}