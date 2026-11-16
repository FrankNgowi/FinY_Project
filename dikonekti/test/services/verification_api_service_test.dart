import 'dart:convert';
import 'dart:typed_data';

import 'package:dikonekti/models/doctor_verification.dart';
import 'package:dikonekti/services/api_client.dart';
import 'package:dikonekti/services/verification_api_service.dart';
import 'package:dikonekti/services/verification_document.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

http.Response json(Object body, [int status = 200]) =>
    http.Response(jsonEncode(body), status, headers: {'content-type': 'application/json'});

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late List<http.Request> seen;
  late http.Response Function(http.Request) respond;
  final pdf = Uint8List.fromList([0x25, 0x50, 0x44, 0x46, 0x2d, 0, 255, 128]);

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({'dikonekti_access_token': 'ACC', 'dikonekti_refresh_token': 'REF'});
    seen = [];
    respond = (_) => json({'status': 'pending', 'submitted_at': '2026-11-13T10:42:00Z', 'rejection_reason': ''});
    ApiClient.client = MockClient((request) async {
      seen.add(request);
      return respond(request);
    });
    ApiClient.verificationRequired.value = 0;
  });

  tearDown(() => ApiClient.client = http.Client());

  group('getStatus', () {
    test('reads the doctor\'s own record from /me/verification/', () async {
      respond = (_) => json({'status': 'rejected', 'submitted_at': '2026-11-13T10:42:00Z', 'rejection_reason': 'Blurry'});
      final record = await VerificationApiService.getStatus();
      expect(record.status, VerificationStatus.rejected);
      expect(record.rejectionReason, 'Blurry');
      expect(seen.single.method, 'GET');
      expect(seen.single.url.path, endsWith('/me/verification/'));
    });

    test('reads every status', () async {
      for (final entry in {
        'not_submitted': VerificationStatus.notSubmitted,
        'pending': VerificationStatus.pending,
        'approved': VerificationStatus.approved,
        'rejected': VerificationStatus.rejected,
        'suspended': VerificationStatus.unknown,
      }.entries) {
        respond = (_) => json({'status': entry.key, 'submitted_at': null, 'rejection_reason': ''});
        expect((await VerificationApiService.getStatus()).status, entry.value);
      }
    });

    test('lets a failure through with its message', () async {
      respond = (_) => json({'detail': 'Only doctors can perform this action.'}, 403);
      await expectLater(
        VerificationApiService.getStatus(),
        throwsA(isA<ApiException>().having((e) => e.message, 'message', 'Only doctors can perform this action.')),
      );
    });
  });

  group('upload', () {
    test('posts the file as the document field with the right type and returns the new record', () async {
      final record = await VerificationApiService.upload(fileName: 'certificate.PDF', bytes: pdf);
      expect(record.status, VerificationStatus.pending);
      final request = seen.single;
      expect(request.method, 'POST');
      expect(request.url.path, endsWith('/me/verification/'));
      final text = latin1.decode(request.bodyBytes);
      expect(text, contains('name="document"'));
      expect(text, contains('filename="certificate.PDF"'));
      expect(text.toLowerCase(), contains('content-type: application/pdf'));
    });

    test('sends jpg and png with their own types', () async {
      await VerificationApiService.upload(fileName: 'a.jpg', bytes: pdf);
      await VerificationApiService.upload(fileName: 'a.png', bytes: pdf);
      expect(latin1.decode(seen[0].bodyBytes).toLowerCase(), contains('content-type: image/jpeg'));
      expect(latin1.decode(seen[1].bodyBytes).toLowerCase(), contains('content-type: image/png'));
    });

    test('refuses a bad file before any request is made', () async {
      final cases = {
        'letter.docx': DocumentRules.chooseFileMessage,
        'cert.pdf.exe': DocumentRules.chooseFileMessage,
      };
      for (final entry in cases.entries) {
        await expectLater(
          VerificationApiService.upload(fileName: entry.key, bytes: pdf),
          throwsA(isA<ApiException>().having((e) => e.message, 'message', entry.value)),
        );
      }
      await expectLater(
        VerificationApiService.upload(fileName: 'a.pdf', bytes: Uint8List(DocumentRules.maxBytes + 1)),
        throwsA(isA<ApiException>().having((e) => e.message, 'message', DocumentRules.tooLargeMessage)),
      );
      await expectLater(
        VerificationApiService.upload(fileName: 'a.pdf', bytes: Uint8List(0)),
        throwsA(isA<ApiException>().having((e) => e.message, 'message', DocumentRules.emptyMessage)),
      );
      expect(seen, isEmpty);
    });

    test('sends exactly 5 MB', () async {
      await VerificationApiService.upload(fileName: 'a.pdf', bytes: Uint8List(DocumentRules.maxBytes));
      expect(seen, hasLength(1));
    });

    test('explains a 413 in plain words, not the server text', () async {
      respond = (_) => json({'detail': 'File too large (max 5 MB).'}, 413);
      await expectLater(
        VerificationApiService.upload(fileName: 'a.pdf', bytes: pdf),
        throwsA(isA<ApiException>()
            .having((e) => e.statusCode, 'status', 413)
            .having((e) => e.message, 'message', 'The file is larger than 5 MB.')),
      );
    });

    test('explains a 429 in plain words, never Django\'s throttling text', () async {
      respond = (_) => json({'detail': 'Request was throttled. Expected available in 3412 seconds.'}, 429);
      await expectLater(
        VerificationApiService.upload(fileName: 'a.pdf', bytes: pdf),
        throwsA(isA<ApiException>()
            .having((e) => e.statusCode, 'status', 429)
            .having((e) => e.message, 'message', 'Too many uploads. Please wait a while and try again.')
            .having((e) => e.message, 'message', isNot(contains('throttled')))),
      );
    });

    test('shows the server\'s own message for a refused or repeated upload', () async {
      respond = (_) => json({'document': ['Only PDF, JPEG or PNG files are accepted.']}, 400);
      await expectLater(
        VerificationApiService.upload(fileName: 'a.pdf', bytes: pdf),
        throwsA(isA<ApiException>().having((e) => e.message, 'message', 'Only PDF, JPEG or PNG files are accepted.')),
      );
      respond = (_) => json({'detail': 'Your document was already submitted.'}, 409);
      await expectLater(
        VerificationApiService.upload(fileName: 'a.pdf', bytes: pdf),
        throwsA(isA<ApiException>().having((e) => e.message, 'message', 'Your document was already submitted.')),
      );
    });

    test('a 403 verification_required from an upload is not possible, but would still be announced', () async {
      respond = (_) => json({'detail': 'x', 'code': 'verification_required'}, 403);
      await expectLater(VerificationApiService.upload(fileName: 'a.pdf', bytes: pdf), throwsA(isA<ApiException>()));
      expect(ApiClient.verificationRequired.value, 1);
    });

    test('lets a network failure through unchanged for the screen to word', () async {
      ApiClient.client = MockClient((_) async => throw http.ClientException('connection refused'));
      await expectLater(VerificationApiService.upload(fileName: 'a.pdf', bytes: pdf), throwsA(isA<http.ClientException>()));
    });
  });
}
