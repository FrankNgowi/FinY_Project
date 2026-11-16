import 'dart:typed_data';

import 'package:dikonekti/models/doctor_verification.dart';

import 'api_client.dart';
import 'verification_document.dart';

/// Talks to the Django backend's `/api/me/verification/` endpoint: a doctor
/// reads the state of their certificate and uploads it. Open to a doctor in
/// any state, which is why an unverified doctor can still use it.
class VerificationApiService {
  /// The doctor's own record. Never includes the uploaded file.
  static Future<DoctorVerification> getStatus() async {
    final response = await ApiClient.getMap('/me/verification/');
    return DoctorVerification.fromJson(response);
  }

  /// Uploads the certificate (PDF, JPG or PNG, 5 MB at most). A file that
  /// breaks those rules is refused here and nothing is sent. Throws
  /// [ApiException] with a message fit to show: the two refusals whose raw
  /// text means nothing to a doctor (`413` and Django's `429` throttling
  /// message) are replaced by plain words, anything else keeps the server's
  /// own message.
  static Future<DoctorVerification> upload({
    required String fileName,
    required Uint8List bytes,
  }) async {
    final problem = DocumentRules.validate(fileName, bytes.length);
    if (problem != null) throw ApiException(0, problem);

    try {
      final response = await ApiClient.postMultipart(
        '/me/verification/',
        field: 'document',
        fileName: fileName,
        bytes: bytes,
        contentType: DocumentRules.contentTypeFor(fileName),
      );
      return DoctorVerification.fromJson(response);
    } on ApiException catch (error) {
      if (error.statusCode == 413) {
        throw ApiException(413, DocumentRules.tooLargeMessage, code: error.code);
      }
      if (error.statusCode == 429) {
        throw ApiException(429, DocumentRules.tooManyUploadsMessage, code: error.code);
      }
      rethrow;
    }
  }
}
