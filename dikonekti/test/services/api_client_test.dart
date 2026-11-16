import 'dart:convert';
import 'dart:typed_data';

import 'package:dikonekti/services/api_client.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

http.Response json(Object body, [int status = 200]) =>
    http.Response(jsonEncode(body), status, headers: {'content-type': 'application/json'});

/// Where [needle] first occurs in [haystack], or -1.
int indexOfBytes(List<int> haystack, List<int> needle) {
  for (var i = 0; i + needle.length <= haystack.length; i++) {
    var match = true;
    for (var j = 0; j < needle.length; j++) {
      if (haystack[i + j] != needle[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late List<http.Request> seen;
  late http.Response Function(http.Request) respond;

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({
      'dikonekti_access_token': 'ACC',
      'dikonekti_refresh_token': 'REF',
    });
    seen = [];
    respond = (_) => json({});
    ApiClient.client = MockClient((request) async {
      seen.add(request);
      return respond(request);
    });
    ApiClient.verificationRequired.value = 0;
  });

  tearDown(() => ApiClient.client = http.Client());

  test('the default server address is unchanged', () {
    expect(ApiClient.baseUrl, 'http://192.168.1.4:8000/api');
  });

  group('JSON calls (existing behaviour)', () {
    test('GET sends the bearer token and returns the decoded map', () async {
      respond = (_) => json({'username': 'u1'});
      final result = await ApiClient.getMap('/me/');
      expect(result, {'username': 'u1'});
      expect(seen.single.method, 'GET');
      expect(seen.single.url.toString(), '${ApiClient.baseUrl}/me/');
      expect(seen.single.headers['Authorization'], 'Bearer ACC');
      expect(seen.single.headers['Content-Type'], contains('application/json'));
    });

    test('GET list returns a list', () async {
      respond = (_) => json([1, 2]);
      expect(await ApiClient.getList('/alerts/'), [1, 2]);
    });

    test('POST sends a JSON body and PATCH too', () async {
      respond = (_) => json({'ok': true});
      await ApiClient.postMap('/alerts/', {'a': 1});
      await ApiClient.patchMap('/alerts/1/acknowledge/', {});
      expect(seen[0].method, 'POST');
      expect(jsonDecode(seen[0].body), {'a': 1});
      expect(seen[1].method, 'PATCH');
    });

    test('a call that does not need auth sends no token', () async {
      respond = (_) => json({'access': 'x'});
      await ApiClient.postMap('/auth/login/', {'u': 'p'}, requiresAuth: false);
      expect(seen.single.headers.containsKey('Authorization'), isFalse);
    });

    test('an empty success body gives an empty map', () async {
      respond = (_) => http.Response('', 204);
      expect(await ApiClient.getMap('/x/'), isEmpty);
    });
  });

  group('error messages (existing behaviour)', () {
    Future<ApiException> failure(http.Response response) async {
      respond = (_) => response;
      try {
        await ApiClient.getMap('/x/');
      } on ApiException catch (e) {
        return e;
      }
      fail('expected an ApiException');
    }

    test('uses the first field message of a validation error', () async {
      final e = await failure(json({'area': ['Area is required.']}, 400));
      expect(e.statusCode, 400);
      expect(e.message, 'Area is required.');
    });

    test('uses detail when there is no field list', () async {
      expect((await failure(json({'detail': 'Not found.'}, 404))).message, 'Not found.');
    });

    test('falls back to a generic text for an empty or odd body', () async {
      expect((await failure(http.Response('', 500))).message, 'Something went wrong. Please try again.');
      expect((await failure(json([], 500))).message, 'Something went wrong. Please try again.');
      expect((await failure(json({}, 500))).message, 'Something went wrong. Please try again.');
    });

    test('carries the error code when the server sends one as text', () async {
      final e = await failure(json({'detail': 'Nope.', 'code': 'verification_required'}, 403));
      expect(e.code, 'verification_required');
      expect(e.message, 'Nope.');
    });

    test('ignores a code that is not text', () async {
      final e = await failure(json({'detail': 'Nope.', 'code': ['x']}, 403));
      expect(e.code, isNull);
      expect((await failure(json({'detail': 'Nope.'}, 403))).code, isNull);
    });
  });

  group('token refresh (existing behaviour)', () {
    test('a 401 refreshes the access token and retries once', () async {
      var attempts = 0;
      respond = (request) {
        if (request.url.path.endsWith('/auth/refresh/')) return json({'access': 'NEW'});
        attempts++;
        return attempts == 1 ? json({'detail': 'expired'}, 401) : json({'ok': true});
      };
      expect(await ApiClient.getMap('/me/'), {'ok': true});
      final refresh = seen.firstWhere((r) => r.url.path.endsWith('/auth/refresh/'));
      expect(jsonDecode(refresh.body), {'refresh': 'REF'});
      expect(seen.last.headers['Authorization'], 'Bearer NEW');
      expect(seen.length, 3);
    });

    test('does not loop when the retry is also a 401', () async {
      respond = (request) => request.url.path.endsWith('/auth/refresh/') ? json({'access': 'NEW'}) : json({'detail': 'expired'}, 401);
      await expectLater(ApiClient.getMap('/me/'), throwsA(isA<ApiException>().having((e) => e.statusCode, 'status', 401)));
      expect(seen.where((r) => !r.url.path.endsWith('/auth/refresh/')).length, 2);
    });

    test('gives the original 401 when the refresh fails', () async {
      respond = (request) => request.url.path.endsWith('/auth/refresh/') ? json({'detail': 'bad'}, 401) : json({'detail': 'expired'}, 401);
      await expectLater(ApiClient.getMap('/me/'), throwsA(isA<ApiException>().having((e) => e.statusCode, 'status', 401)));
    });
  });

  group('postMultipart', () {
    // Not valid UTF-8 on purpose: any text conversion would change these bytes.
    final fileBytes = Uint8List.fromList([0, 255, 254, 0, 128, 13, 10, 192, 193, 37, 80, 68, 70]);

    Future<Map<String, dynamic>> upload() => ApiClient.postMultipart(
          '/me/verification/',
          field: 'document',
          fileName: 'certificate.pdf',
          bytes: fileBytes,
          contentType: 'application/pdf',
        );

    test('sends the file unchanged in a multipart form with its name and type', () async {
      respond = (_) => json({'status': 'pending'});
      expect(await upload(), {'status': 'pending'});
      final request = seen.single;
      expect(request.method, 'POST');
      expect(request.url.toString(), '${ApiClient.baseUrl}/me/verification/');
      expect(request.headers['Authorization'], 'Bearer ACC');
      expect(request.headers['content-type'], startsWith('multipart/form-data; boundary='));
      final text = latin1.decode(request.bodyBytes);
      expect(text, contains('name="document"'));
      expect(text, contains('filename="certificate.pdf"'));
      expect(text.toLowerCase(), contains('content-type: application/pdf'));
      expect(indexOfBytes(request.bodyBytes, fileBytes), greaterThan(0));
    });

    test('after a 401 it refreshes and resends the same file with the new token', () async {
      var uploads = 0;
      respond = (request) {
        if (request.url.path.endsWith('/auth/refresh/')) return json({'access': 'NEW'});
        uploads++;
        return uploads == 1 ? json({'detail': 'expired'}, 401) : json({'status': 'pending'});
      };
      expect(await upload(), {'status': 'pending'});
      final sends = seen.where((r) => !r.url.path.endsWith('/auth/refresh/')).toList();
      expect(sends.length, 2);
      expect(sends[0].headers['Authorization'], 'Bearer ACC');
      expect(sends[1].headers['Authorization'], 'Bearer NEW');
      for (final send in sends) {
        expect(indexOfBytes(send.bodyBytes, fileBytes), greaterThan(0));
      }
    });

    test('shows the server message when the file is refused', () async {
      respond = (_) => json({'document': ['Only PDF, JPEG or PNG files are accepted.']}, 400);
      await expectLater(
        upload(),
        throwsA(isA<ApiException>()
            .having((e) => e.statusCode, 'status', 400)
            .having((e) => e.message, 'message', 'Only PDF, JPEG or PNG files are accepted.')),
      );
    });

    test('keeps the status of a 413 and a 429 for the caller to explain', () async {
      for (final status in [413, 429]) {
        respond = (_) => json({'detail': 'raw text'}, status);
        await expectLater(upload(), throwsA(isA<ApiException>().having((e) => e.statusCode, 'status', status)));
      }
    });
  });

  group('verificationRequired', () {
    test('counts a 403 with the verification_required code and still throws it', () async {
      respond = (_) => json({'detail': 'Your account is awaiting verification.', 'code': 'verification_required'}, 403);
      await expectLater(
        ApiClient.getList('/patients/'),
        throwsA(isA<ApiException>()
            .having((e) => e.statusCode, 'status', 403)
            .having((e) => e.code, 'code', 'verification_required')
            .having((e) => e.message, 'message', 'Your account is awaiting verification.')),
      );
      expect(ApiClient.verificationRequired.value, 1);
    });

    test('also counts it on a PATCH and an upload', () async {
      respond = (_) => json({'detail': 'x', 'code': 'verification_required'}, 403);
      await expectLater(ApiClient.patchMap('/alerts/1/acknowledge/', {}), throwsA(isA<ApiException>()));
      await expectLater(
        ApiClient.postMultipart('/me/verification/', field: 'document', fileName: 'a.pdf', bytes: [1], contentType: 'application/pdf'),
        throwsA(isA<ApiException>()),
      );
      expect(ApiClient.verificationRequired.value, 2);
    });

    test('does not count any other failure', () async {
      final others = <http.Response>[
        json({'detail': 'Only doctors can perform this action.'}, 403),
        json({'detail': 'x', 'code': 'permission_denied'}, 403),
        json({'detail': 'x', 'code': ['verification_required']}, 403),
        json({'detail': 'x', 'code': 'verification_required'}, 400),
        json({'detail': 'x', 'code': 'verification_required'}, 401),
        json({'detail': 'x'}, 404),
        json({'detail': 'x'}, 500),
      ];
      for (final response in others) {
        respond = (request) => request.url.path.endsWith('/auth/refresh/') ? json({'detail': 'bad'}, 401) : response;
        await expectLater(ApiClient.getMap('/x/'), throwsA(isA<ApiException>()));
      }
      expect(ApiClient.verificationRequired.value, 0);
    });

    test('does not count a success', () async {
      respond = (_) => json({'ok': true});
      await ApiClient.getMap('/me/');
      expect(ApiClient.verificationRequired.value, 0);
    });

    test('tells a listener once per refused request', () async {
      var heard = 0;
      void listener() => heard++;
      ApiClient.verificationRequired.addListener(listener);
      respond = (_) => json({'detail': 'x', 'code': 'verification_required'}, 403);
      for (var i = 0; i < 3; i++) {
        await expectLater(ApiClient.getMap('/x/'), throwsA(isA<ApiException>()));
      }
      ApiClient.verificationRequired.removeListener(listener);
      expect(heard, 3);
    });
  });
}
