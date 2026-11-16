import 'dart:async';
import 'dart:typed_data';

import 'package:dikonekti/models/doctor_verification.dart';
import 'package:dikonekti/models/user_account.dart';
import 'package:dikonekti/screens/verification_page.dart';
import 'package:dikonekti/services/document_picker.dart';
import 'package:dikonekti/services/api_client.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;

import '../support/harness.dart';

DoctorVerification record(VerificationStatus status, {String reason = '', DateTime? submitted}) =>
    DoctorVerification(status: status, submittedAt: submitted?.toUtc(), rejectionReason: reason);

final submittedAt = DateTime(2026, 11, 13, 10, 42);
final doctor = UserAccount(username: 'jane', role: 'doctor', firstName: 'Jane', lastName: 'Doe');

PickedDocument picked(String name, int length) =>
    PickedDocument(name: name, length: length, readBytes: () async => Uint8List(length));

/// Collects what the screen asks of its collaborators.
class Fakes {
  Fakes({List<Object>? statuses}) : statuses = statuses ?? [record(VerificationStatus.notSubmitted)];

  /// Answers in order; the last one repeats. An [Object] that is not a record is thrown.
  final List<Object> statuses;
  int loads = 0;
  int approvals = 0;
  final List<({String name, Uint8List bytes})> uploads = [];
  PickedDocument? next;
  Future<DoctorVerification> Function(String name, Uint8List bytes)? onUpload;

  Future<DoctorVerification> load() async {
    final answer = statuses[loads < statuses.length ? loads : statuses.length - 1];
    loads++;
    if (answer is DoctorVerification) return answer;
    throw answer;
  }

  Future<PickedDocument?> pick() async => next;

  Future<DoctorVerification> upload({required String fileName, required Uint8List bytes}) {
    uploads.add((name: fileName, bytes: bytes));
    return onUpload?.call(fileName, bytes) ?? Future.value(record(VerificationStatus.pending, submitted: submittedAt));
  }

  Widget page({Duration poll = const Duration(seconds: 30)}) => appAround(
        VerificationPage(
          user: doctor,
          onLogout: () {},
          onApproved: () => approvals++,
          loadStatus: load,
          pickDocument: pick,
          uploadDocument: upload,
          pollInterval: poll,
        ),
      );
}

Future<void> show(WidgetTester tester, Fakes fakes) async {
  await tester.pumpWidget(fakes.page());
  addTearDown(() async => tester.pumpWidget(const SizedBox()));
  await tester.pump();
}

Future<void> choose(WidgetTester tester, Fakes fakes, String name, int length) async {
  fakes.next = picked(name, length);
  await tester.tap(find.text('Choose file'));
  await tester.pump();
}

void main() {
  group('what each status shows', () {
    testWidgets('shows a loading state before the status arrives', (tester) async {
      final fakes = Fakes();
      await tester.pumpWidget(fakes.page());
      addTearDown(() async => tester.pumpWidget(const SizedBox()));
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('Checking your document status…'), findsOneWidget);
      await tester.pump();
      expect(find.text('Checking your document status…'), findsNothing);
    });

    testWidgets('asks a doctor who has not submitted to upload', (tester) async {
      await show(tester, Fakes());
      expect(find.text('Upload your confirmation letter or certificate'), findsOneWidget);
      expect(find.text('PDF, JPG or PNG, up to 5 MB'), findsOneWidget);
      expect(find.text('Choose file'), findsOneWidget);
      expect(find.text('Submit for review'), findsOneWidget);
      expect(find.text('No file chosen'), findsOneWidget);
    });

    testWidgets('shows the submitted date and no upload while pending', (tester) async {
      await show(tester, Fakes(statuses: [record(VerificationStatus.pending, submitted: submittedAt)]));
      expect(find.text('Your document is under review'), findsOneWidget);
      expect(find.textContaining('Submitted 13 Nov 2026, 10:42'), findsOneWidget);
      expect(find.textContaining('We will unlock your dashboard once it is approved'), findsOneWidget);
      expect(find.text('Choose file'), findsNothing);
      expect(find.textContaining('Submit'), findsOneWidget); // only the "Submitted ..." sentence
      expect(find.byType(FilledButton), findsNothing);
    });

    testWidgets('shows the reviewer reason and a way to try again after a rejection', (tester) async {
      await show(tester, Fakes(statuses: [record(VerificationStatus.rejected, reason: 'The scan is blurry.', submitted: submittedAt)]));
      expect(find.text('Your document was not accepted'), findsOneWidget);
      expect(find.text('Reason: The scan is blurry.'), findsOneWidget);
      expect(find.text('Choose file'), findsOneWidget);
      expect(find.text('Submit again'), findsOneWidget);
    });

    testWidgets('shows a reason with markup as plain text', (tester) async {
      await show(tester, Fakes(statuses: [record(VerificationStatus.rejected, reason: '<b>No</b> licence')]));
      expect(find.text('Reason: <b>No</b> licence'), findsOneWidget);
    });

    testWidgets('tells an approved doctor the dashboard is opening and asks the app to open it', (tester) async {
      final fakes = Fakes(statuses: [record(VerificationStatus.approved, submitted: submittedAt)]);
      await show(tester, fakes);
      expect(find.text('Approved. Opening your dashboard…'), findsOneWidget);
      expect(fakes.approvals, 1);
      expect(find.text('Choose file'), findsNothing);
    });

    testWidgets('never calls an unknown status approved', (tester) async {
      final fakes = Fakes(statuses: [record(VerificationStatus.unknown), record(VerificationStatus.notSubmitted)]);
      await show(tester, fakes);
      expect(find.text('We could not read your verification status.'), findsOneWidget);
      expect(find.text('Approved. Opening your dashboard…'), findsNothing);
      expect(fakes.approvals, 0);
      await tester.tap(find.text('Retry'));
      await tester.pump();
      expect(find.text('Upload your confirmation letter or certificate'), findsOneWidget);
    });

    testWidgets('shows who is signed in and has the shared log out button', (tester) async {
      await show(tester, Fakes());
      expect(find.text('Verification'), findsOneWidget);
      expect(find.text('Dr. Jane Doe'), findsOneWidget);
      expect(find.byTooltip('Log out'), findsOneWidget);
    });
  });

  group('loading problems', () {
    testWidgets('shows the failure with a retry when the first load fails', (tester) async {
      final fakes = Fakes(statuses: [ApiException(500, 'Something went wrong. Please try again.'), record(VerificationStatus.notSubmitted)]);
      await show(tester, fakes);
      expect(find.text('Could not load your verification status. Something went wrong. Please try again.'), findsOneWidget);
      expect(find.text('Upload your confirmation letter or certificate'), findsNothing);
      await tester.tap(find.text('Retry'));
      await tester.pump();
      expect(find.text('Upload your confirmation letter or certificate'), findsOneWidget);
      expect(find.textContaining('Could not load'), findsNothing);
    });

    testWidgets('words a network failure plainly', (tester) async {
      await show(tester, Fakes(statuses: [http.ClientException('refused'), record(VerificationStatus.notSubmitted)]));
      expect(find.textContaining('Could not reach the server. Check your connection and try again.'), findsOneWidget);
    });

    testWidgets('pull to refresh asks for the status again', (tester) async {
      final fakes = Fakes(statuses: [record(VerificationStatus.rejected, reason: 'Blurry'), record(VerificationStatus.pending, submitted: submittedAt)]);
      await show(tester, fakes);
      await tester.fling(find.byType(SingleChildScrollView), const Offset(0, 400), 1000);
      await tester.pumpAndSettle();
      expect(fakes.loads, 2);
      expect(find.text('Your document is under review'), findsOneWidget);
    });
  });

  group('choosing a file', () {
    testWidgets('refuses a wrong type on the phone and offers no upload', (tester) async {
      final fakes = Fakes();
      await show(tester, fakes);
      await choose(tester, fakes, 'letter.docx', 1024);
      expect(find.text('Choose a PDF, JPG or PNG file.'), findsOneWidget);
      expect(find.text('No file chosen'), findsOneWidget);
      await tester.tap(find.text('Submit for review'));
      await tester.pump();
      expect(fakes.uploads, isEmpty);
    });

    testWidgets('refuses a 6 MB PDF with the size message and sends nothing', (tester) async {
      final fakes = Fakes();
      await show(tester, fakes);
      await choose(tester, fakes, 'big.pdf', 6 * 1024 * 1024);
      expect(find.text('The file is larger than 5 MB.'), findsOneWidget);
      await tester.tap(find.text('Submit for review'));
      await tester.pump();
      expect(fakes.uploads, isEmpty);
    });

    testWidgets('accepts exactly 5 MB and shows the file name', (tester) async {
      final fakes = Fakes();
      await show(tester, fakes);
      await choose(tester, fakes, 'cert.pdf', 5 * 1024 * 1024);
      expect(find.text('cert.pdf'), findsOneWidget);
      expect(find.textContaining('larger than 5 MB'), findsNothing);
    });

    testWidgets('asks for a file when Submit is pressed with none chosen', (tester) async {
      final fakes = Fakes();
      await show(tester, fakes);
      await tester.tap(find.text('Submit for review'));
      await tester.pump();
      expect(find.text('Choose a PDF, JPG or PNG file.'), findsOneWidget);
      expect(fakes.uploads, isEmpty);
    });

    testWidgets('keeps the earlier choice when the picker is cancelled', (tester) async {
      final fakes = Fakes();
      await show(tester, fakes);
      await choose(tester, fakes, 'cert.pdf', 100);
      fakes.next = null;
      await tester.tap(find.text('Choose file'));
      await tester.pump();
      expect(find.text('cert.pdf'), findsOneWidget);
    });

    testWidgets('clears an old problem when a good file is chosen', (tester) async {
      final fakes = Fakes();
      await show(tester, fakes);
      await choose(tester, fakes, 'letter.docx', 100);
      await choose(tester, fakes, 'cert.pdf', 100);
      expect(find.text('Choose a PDF, JPG or PNG file.'), findsNothing);
      expect(find.text('cert.pdf'), findsOneWidget);
    });
  });

  group('uploading', () {
    testWidgets('sends the chosen file once and moves to under review', (tester) async {
      final fakes = Fakes();
      await show(tester, fakes);
      await choose(tester, fakes, 'cert.pdf', 1234);
      await tester.tap(find.text('Submit for review'));
      await tester.pumpAndSettle();
      expect(fakes.uploads, hasLength(1));
      expect(fakes.uploads.single.name, 'cert.pdf');
      expect(fakes.uploads.single.bytes.length, 1234);
      expect(find.text('Your document is under review'), findsOneWidget);
      expect(find.textContaining('Submitted 13 Nov 2026, 10:42'), findsOneWidget);
    });

    testWidgets('a second tap while uploading sends nothing more and the button shows progress', (tester) async {
      final fakes = Fakes();
      final gate = Completer<DoctorVerification>();
      fakes.onUpload = (_, _) => gate.future;
      await show(tester, fakes);
      await choose(tester, fakes, 'cert.pdf', 100);
      await tester.tap(find.text('Submit for review'));
      await tester.pump();
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      await tester.tap(find.byType(FilledButton), warnIfMissed: false);
      await tester.pump();
      expect(fakes.uploads, hasLength(1));
      gate.complete(record(VerificationStatus.pending, submitted: submittedAt));
      await tester.pumpAndSettle();
      expect(fakes.uploads, hasLength(1));
      expect(find.text('Your document is under review'), findsOneWidget);
    });

    testWidgets('shows the server message in a snackbar, stays usable and keeps the file', (tester) async {
      final fakes = Fakes();
      fakes.onUpload = (_, _) async => throw ApiException(400, 'Only PDF, JPEG or PNG files are accepted.');
      await show(tester, fakes);
      await choose(tester, fakes, 'fake.pdf', 100);
      await tester.tap(find.text('Submit for review'));
      await tester.pumpAndSettle();
      expect(find.text('Only PDF, JPEG or PNG files are accepted.'), findsOneWidget);
      expect(find.byType(SnackBar), findsOneWidget);
      expect(find.text('fake.pdf'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      // and a second try goes through
      fakes.onUpload = null;
      await tester.pump(const Duration(seconds: 5));
      await tester.tap(find.text('Submit for review'));
      await tester.pumpAndSettle();
      expect(fakes.uploads, hasLength(2));
      expect(find.text('Your document is under review'), findsOneWidget);
    });

    testWidgets('shows the plain 429 and 413 messages exactly as the service words them', (tester) async {
      for (final message in ['Too many uploads. Please wait a while and try again.', 'The file is larger than 5 MB.']) {
        final fakes = Fakes();
        fakes.onUpload = (_, _) async => throw ApiException(429, message);
        await show(tester, fakes);
        await choose(tester, fakes, 'cert.pdf', 100);
        await tester.tap(find.text('Submit for review'));
        await tester.pumpAndSettle();
        expect(find.text(message), findsOneWidget);
        await tester.pumpWidget(const SizedBox());
      }
    });

    testWidgets('words a network failure while uploading', (tester) async {
      final fakes = Fakes();
      fakes.onUpload = (_, _) async => throw http.ClientException('refused');
      await show(tester, fakes);
      await choose(tester, fakes, 'cert.pdf', 100);
      await tester.tap(find.text('Submit for review'));
      await tester.pumpAndSettle();
      expect(find.text('Could not reach the server. Check your connection and try again.'), findsOneWidget);
      expect(find.text('Submit for review'), findsOneWidget);
    });

    testWidgets('uses the label Submit again after a rejection', (tester) async {
      final fakes = Fakes(statuses: [record(VerificationStatus.rejected, reason: 'No')]);
      await show(tester, fakes);
      await choose(tester, fakes, 'cert.png', 100);
      await tester.tap(find.text('Submit again'));
      await tester.pumpAndSettle();
      expect(fakes.uploads.single.name, 'cert.png');
      expect(find.text('Your document is under review'), findsOneWidget);
    });
  });

  group('checking again on its own', () {
    testWidgets('while pending it re-checks every 30 seconds and opens the dashboard once approved', (tester) async {
      final fakes = Fakes(statuses: [record(VerificationStatus.pending, submitted: submittedAt), record(VerificationStatus.approved)]);
      await show(tester, fakes);
      expect(fakes.loads, 1);
      await tester.pump(const Duration(seconds: 29));
      expect(fakes.loads, 1);
      await tester.pump(const Duration(seconds: 2));
      expect(fakes.loads, 2);
      expect(fakes.approvals, 1);
    });

    testWidgets('keeps checking every 30 seconds while still pending', (tester) async {
      final fakes = Fakes(statuses: [record(VerificationStatus.pending, submitted: submittedAt)]);
      await show(tester, fakes);
      await tester.pump(const Duration(seconds: 95));
      expect(fakes.loads, greaterThanOrEqualTo(4));
      expect(fakes.approvals, 0);
    });

    testWidgets('starts checking after the doctor submits in this same visit', (tester) async {
      final fakes = Fakes(statuses: [record(VerificationStatus.notSubmitted), record(VerificationStatus.approved)]);
      await show(tester, fakes);
      await choose(tester, fakes, 'cert.pdf', 100);
      await tester.tap(find.text('Submit for review'));
      await tester.pumpAndSettle();
      expect(fakes.loads, 1);
      await tester.pump(const Duration(seconds: 31));
      expect(fakes.loads, 2);
      expect(fakes.approvals, 1);
    });

    for (final status in [VerificationStatus.notSubmitted, VerificationStatus.rejected, VerificationStatus.unknown]) {
      testWidgets('does not check on its own while the status is ${status.name}', (tester) async {
        final fakes = Fakes(statuses: [record(status, reason: 'No')]);
        await show(tester, fakes);
        await tester.pump(const Duration(seconds: 120));
        expect(fakes.loads, 1);
      });
    }

    testWidgets('keeps the card and shows a notice when a re-check fails, then clears it', (tester) async {
      final fakes = Fakes(statuses: [
        record(VerificationStatus.pending, submitted: submittedAt),
        ApiException(500, 'Something went wrong. Please try again.'),
        record(VerificationStatus.pending, submitted: submittedAt),
      ]);
      await show(tester, fakes);
      await tester.pump(const Duration(seconds: 31));
      expect(find.text('Your document is under review'), findsOneWidget);
      expect(find.textContaining('Could not check your status'), findsOneWidget);
      await tester.pump(const Duration(seconds: 31));
      expect(find.textContaining('Could not check your status'), findsNothing);
    });

    testWidgets('stops when the screen is closed', (tester) async {
      final fakes = Fakes(statuses: [record(VerificationStatus.pending, submitted: submittedAt)]);
      await show(tester, fakes);
      await tester.pumpWidget(const SizedBox());
      final before = fakes.loads;
      await tester.pump(const Duration(seconds: 120));
      expect(fakes.loads, before);
    });
  });
}
