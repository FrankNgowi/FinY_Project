import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Stores JWT auth tokens on-device using flutter_secure_storage (Keychain
/// on iOS, an encrypted keystore-backed store on Android) rather than
/// shared_preferences or a plain file — these tokens are effectively a
/// password substitute and deserve the same care.
class TokenStorage {
  static const _storage = FlutterSecureStorage();
  static const _accessKey = 'dikonekti_access_token';
  static const _refreshKey = 'dikonekti_refresh_token';

  static Future<void> saveTokens({
    required String access,
    required String refresh,
  }) async {
    await _storage.write(key: _accessKey, value: access);
    await _storage.write(key: _refreshKey, value: refresh);
  }

  static Future<void> saveAccessToken(String access) async {
    await _storage.write(key: _accessKey, value: access);
  }

  static Future<String?> getAccessToken() => _storage.read(key: _accessKey);
  static Future<String?> getRefreshToken() => _storage.read(key: _refreshKey);

  static Future<void> clear() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
  }
}