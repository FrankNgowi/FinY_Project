import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import 'token_storage.dart';

/// Thrown for any non-2xx response, carrying the status code and the best
/// human-readable message we could pull out of Django's response body.
class ApiException implements Exception {
  ApiException(this.statusCode, this.message, {this.code});
  final int statusCode;
  final String message;

  /// The machine-readable `code` Django sends with some errors (for example
  /// `verification_required`), or null when there is none.
  final String? code;

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
  //
  // The address can also be set when the app is built or run, without editing
  // this file: `--dart-define=API_BASE_URL=http://10.0.2.2:8000/api`.
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://192.168.1.4:8000/api',
  );

  /// The HTTP client every call goes through. Tests replace it.
  @visibleForTesting
  static http.Client client = http.Client();

  /// Goes up by one every time the server answers `403` with the code
  /// `verification_required`: a doctor whose approval was withdrawn while they
  /// were using the app. The app listens and re-reads the profile, so the one
  /// place that knows who is logged in decides which screen to show.
  static final ValueNotifier<int> verificationRequired = ValueNotifier<int>(0);

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

  /// Sends a multipart form with one file. The file bytes go out exactly as
  /// given. Like every other call it attaches the token and, after a 401,
  /// refreshes it and sends the same file once more.
  static Future<Map<String, dynamic>> postMultipart(
    String path, {
    required String field,
    required String fileName,
    required List<int> bytes,
    required String contentType,
  }) async {
    final result = await _execute(
      () => http.MultipartRequest('POST', Uri.parse('$baseUrl$path'))
        ..files.add(
          http.MultipartFile.fromBytes(
            field,
            bytes,
            filename: fileName,
            contentType: _parseMediaType(contentType),
          ),
        ),
      requiresAuth: true,
    );
    return result as Map<String, dynamic>;
  }

  static Future<dynamic> _send(
    String method,
    String path, {
    Map<String, dynamic>? body,
    bool requiresAuth = true,
  }) {
    return _execute(
      () {
        final request = http.Request(method, Uri.parse('$baseUrl$path'));
        request.headers['Content-Type'] = 'application/json';
        if (method != 'GET') request.body = jsonEncode(body ?? {});
        return request;
      },
      requiresAuth: requiresAuth,
    );
  }

  /// Builds a fresh request for every attempt (a request can only be sent
  /// once), adds the token, and retries once after refreshing it on a 401.
  static Future<dynamic> _execute(
    http.BaseRequest Function() build, {
    required bool requiresAuth,
    bool isRetry = false,
  }) async {
    final request = build();
    if (requiresAuth) {
      final token = await TokenStorage.getAccessToken();
      if (token != null) request.headers['Authorization'] = 'Bearer $token';
    }

    final response = await http.Response.fromStream(await client.send(request));

    // Access token expired mid-session — refresh once and retry the
    // original request rather than bouncing the user back to login.
    if (response.statusCode == 401 && requiresAuth && !isRetry) {
      final refreshed = await _tryRefreshAccessToken();
      if (refreshed) {
        return _execute(build, requiresAuth: requiresAuth, isRetry: true);
      }
    }

    final decoded = response.body.isNotEmpty ? jsonDecode(response.body) : null;

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return decoded ?? <String, dynamic>{};
    }

    final code = decoded is Map<String, dynamic> && decoded['code'] is String
        ? decoded['code'] as String
        : null;
    if (response.statusCode == 403 && code == 'verification_required') {
      verificationRequired.value++;
    }
    throw ApiException(
      response.statusCode,
      _extractErrorMessage(decoded),
      code: code,
    );
  }

  static MediaType _parseMediaType(String contentType) =>
      MediaType.parse(contentType);

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
      final response = await client.post(
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