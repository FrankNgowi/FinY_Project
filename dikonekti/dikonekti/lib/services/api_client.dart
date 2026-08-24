import 'dart:convert';

import 'package:http/http.dart' as http;

import 'token_storage.dart';

/// Thrown for any non-2xx response, carrying the status code and the best
/// human-readable message we could pull out of Django's response body.
class ApiException implements Exception {
  ApiException(this.statusCode, this.message);
  final int statusCode;
  final String message;

  @override
  String toString() => message;
}

/// Thin wrapper around `http` calls to the Django backend.
///
/// Handles three things every call needs so individual services don't
/// have to repeat them: attaching the bearer token, silently refreshing
/// an expired access token and retrying once on a 401, and turning
/// Django/DRF's error response shape into a message worth showing a user
/// instead of a raw stack of JSON.
class ApiClient {
  // Use your computer's actual WiFi/LAN IP address here when testing on a
  // physical device — 10.0.2.2 only works inside the Android emulator, it
  // means nothing on a real phone. Find your IP with `ipconfig` (look for
  // "IPv4 Address" under your WiFi adapter) and make sure the phone and
  // computer are on the same network. Use the real domain once deployed.
  static const String baseUrl = 'http://192.168.1.4:8000/api';

  static Future<Map<String, dynamic>> getMap(String path) async {
    final result = await _send('GET', path);
    return result as Map<String, dynamic>;
  }

  static Future<List<dynamic>> getList(String path) async {
    final result = await _send('GET', path);
    return result as List<dynamic>;
  }

  static Future<Map<String, dynamic>> postMap(
    String path,
    Map<String, dynamic> body, {
    bool requiresAuth = true,
  }) async {
    final result = await _send(
      'POST',
      path,
      body: body,
      requiresAuth: requiresAuth,
    );
    return result as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> patchMap(
    String path,
    Map<String, dynamic> body,
  ) async {
    final result = await _send('PATCH', path, body: body);
    return result as Map<String, dynamic>;
  }

  static Future<dynamic> _send(
    String method,
    String path, {
    Map<String, dynamic>? body,
    bool requiresAuth = true,
    bool isRetry = false,
  }) async {
    final uri = Uri.parse('$baseUrl$path');
    final headers = <String, String>{'Content-Type': 'application/json'};

    if (requiresAuth) {
      final token = await TokenStorage.getAccessToken();
      if (token != null) headers['Authorization'] = 'Bearer $token';
    }

    late final http.Response response;
    switch (method) {
      case 'GET':
        response = await http.get(uri, headers: headers);
        break;
      case 'POST':
        response = await http.post(
          uri,
          headers: headers,
          body: jsonEncode(body ?? {}),
        );
        break;
      case 'PATCH':
        response = await http.patch(
          uri,
          headers: headers,
          body: jsonEncode(body ?? {}),
        );
        break;
      default:
        throw ApiException(0, 'Unsupported HTTP method: $method');
    }

    // Access token expired mid-session — refresh once and retry the
    // original request rather than bouncing the user back to login.
    if (response.statusCode == 401 && requiresAuth && !isRetry) {
      final refreshed = await _tryRefreshAccessToken();
      if (refreshed) {
        return _send(
          method,
          path,
          body: body,
          requiresAuth: requiresAuth,
          isRetry: true,
        );
      }
    }

    final decoded = response.body.isNotEmpty ? jsonDecode(response.body) : null;

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return decoded ?? <String, dynamic>{};
    }

    throw ApiException(response.statusCode, _extractErrorMessage(decoded));
  }

  static String _extractErrorMessage(dynamic decoded) {
    if (decoded == null) return 'Something went wrong. Please try again.';
    if (decoded is! Map<String, dynamic> || decoded.isEmpty) {
      return 'Something went wrong. Please try again.';
    }
    // DRF validation errors typically look like {"field": ["message"]}.
    final firstValue = decoded.values.first;
    if (firstValue is List && firstValue.isNotEmpty) {
      return firstValue.first.toString();
    }
    if (decoded['detail'] != null) return decoded['detail'].toString();
    return decoded.toString();
  }

  static Future<bool> _tryRefreshAccessToken() async {
    final refreshToken = await TokenStorage.getRefreshToken();
    if (refreshToken == null) return false;

    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/refresh/'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refresh': refreshToken}),
      );
      if (response.statusCode != 200) return false;

      final decoded = jsonDecode(response.body) as Map<String, dynamic>;
      await TokenStorage.saveAccessToken(decoded['access'] as String);
      return true;
    } catch (_) {
      return false;
    }
  }
}