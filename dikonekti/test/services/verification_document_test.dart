import 'package:dikonekti/services/verification_document.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('limits and messages', () {
    test('match the web app word for word', () {
      expect(DocumentRules.maxBytes, 5 * 1024 * 1024);
      expect(DocumentRules.chooseFileMessage, 'Choose a PDF, JPG or PNG file.');
      expect(DocumentRules.tooLargeMessage, 'The file is larger than 5 MB.');
      expect(DocumentRules.emptyMessage, 'The file is empty.');
      expect(DocumentRules.tooManyUploadsMessage, 'Too many uploads. Please wait a while and try again.');
    });

    test('the picker offers only pdf, jpg, jpeg and png', () {
      expect(DocumentRules.allowedExtensions, ['pdf', 'jpg', 'jpeg', 'png']);
    });
  });

  group('validate', () {
    test('accepts pdf, jpg, jpeg and png in any letter case', () {
      for (final name in ['scan.pdf', 'scan.PDF', 'photo.jpg', 'photo.JPG', 'photo.jpeg', 'photo.Jpeg', 'pic.png', 'pic.PNG', 'my.cert.v2.pdf']) {
        expect(DocumentRules.validate(name, 1024), isNull, reason: name);
      }
    });

    test('refuses every other type with the choose-a-file message', () {
      for (final name in ['letter.docx', 'letter.doc', 'run.exe', 'pic.gif', 'vector.svg', 'notes.txt', 'page.html', 'archive.zip']) {
        expect(DocumentRules.validate(name, 1024), DocumentRules.chooseFileMessage, reason: name);
      }
    });

    test('refuses names with no extension, a trailing dot, or a good extension hidden behind a bad one', () {
      for (final name in ['README', 'cert.', '', ' ', 'cert.pdf.exe', 'cert.png.html', 'pdf', 'cert.pdf ']) {
        expect(DocumentRules.validate(name, 1024), DocumentRules.chooseFileMessage, reason: '"$name"');
      }
    });

    test('accepts exactly 5 MB and refuses one byte more', () {
      expect(DocumentRules.validate('a.pdf', DocumentRules.maxBytes), isNull);
      expect(DocumentRules.validate('a.pdf', DocumentRules.maxBytes + 1), DocumentRules.tooLargeMessage);
      expect(DocumentRules.validate('a.pdf', 6 * 1024 * 1024), DocumentRules.tooLargeMessage);
    });

    test('refuses an empty file', () {
      expect(DocumentRules.validate('a.pdf', 0), DocumentRules.emptyMessage);
    });

    test('refuses a negative length instead of treating it as small', () {
      expect(DocumentRules.validate('a.pdf', -1), isNotNull);
    });

    test('reports the wrong type before the size', () {
      expect(DocumentRules.validate('a.docx', 6 * 1024 * 1024), DocumentRules.chooseFileMessage);
      expect(DocumentRules.validate('a.docx', 0), DocumentRules.chooseFileMessage);
    });
  });

  group('contentTypeFor', () {
    test('gives the type the backend expects for each extension', () {
      expect(DocumentRules.contentTypeFor('a.pdf'), 'application/pdf');
      expect(DocumentRules.contentTypeFor('A.PDF'), 'application/pdf');
      expect(DocumentRules.contentTypeFor('a.jpg'), 'image/jpeg');
      expect(DocumentRules.contentTypeFor('a.JPEG'), 'image/jpeg');
      expect(DocumentRules.contentTypeFor('a.png'), 'image/png');
    });

    test('falls back to a generic type for anything else (validation refuses it first)', () {
      expect(DocumentRules.contentTypeFor('a.docx'), 'application/octet-stream');
      expect(DocumentRules.contentTypeFor('README'), 'application/octet-stream');
    });
  });
}
