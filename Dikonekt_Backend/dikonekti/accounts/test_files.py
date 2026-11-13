from django.test import SimpleTestCase

from accounts import files
from accounts.test_helpers import JPEG, PDF, PNG, upload


class SniffTests(SimpleTestCase):
    def test_recognises_pdf_png_and_jpeg_from_first_bytes(self):
        self.assertEqual(files.sniff(PDF[:8]), 'pdf')
        self.assertEqual(files.sniff(PNG[:8]), 'png')
        self.assertEqual(files.sniff(JPEG[:8]), 'jpeg')

    def test_executable_is_not_recognised(self):
        self.assertIsNone(files.sniff(b'MZ\x90\x00\x03\x00\x00\x00'))

    def test_html_is_not_recognised(self):
        self.assertIsNone(files.sniff(b'<html><script>alert(1)</script>'))

    def test_empty_and_short_input_is_not_recognised(self):
        self.assertIsNone(files.sniff(b''))
        self.assertIsNone(files.sniff(b'%PD'))

    def test_png_signature_must_be_complete(self):
        self.assertIsNone(files.sniff(b'\x89PNG'))


class ValidateDocumentTests(SimpleTestCase):
    def test_valid_files_return_their_kind(self):
        self.assertEqual(files.validate_document(upload(PDF)), 'pdf')
        self.assertEqual(files.validate_document(upload(PNG, 'a.png', 'image/png')), 'png')
        self.assertEqual(files.validate_document(upload(JPEG, 'a.jpg', 'image/jpeg')), 'jpeg')

    def test_exe_renamed_to_pdf_is_refused(self):
        with self.assertRaises(files.InvalidDocument) as caught:
            files.validate_document(upload(b'MZ\x90\x00' + b'0' * 100, 'cert.pdf', 'application/pdf'))
        self.assertIn('PDF, JPEG or PNG', caught.exception.message)

    def test_html_declared_as_png_is_refused(self):
        with self.assertRaises(files.InvalidDocument):
            files.validate_document(upload(b'<html></html>', 'a.png', 'image/png'))

    def test_empty_file_is_refused(self):
        with self.assertRaises(files.InvalidDocument) as caught:
            files.validate_document(upload(b''))
        self.assertEqual(caught.exception.message, 'The file is empty.')

    def test_exactly_five_megabytes_is_accepted(self):
        data = PDF + b'0' * (files.MAX_FILE_BYTES - len(PDF))
        self.assertEqual(len(data), 5 * 1024 * 1024)
        self.assertEqual(files.validate_document(upload(data)), 'pdf')

    def test_one_byte_over_five_megabytes_is_refused(self):
        data = PDF + b'0' * (files.MAX_FILE_BYTES - len(PDF) + 1)
        with self.assertRaises(files.InvalidDocument) as caught:
            files.validate_document(upload(data))
        self.assertEqual(caught.exception.message, 'The file is larger than 5 MB.')

    def test_validation_leaves_the_file_readable_from_the_start(self):
        document = upload(PDF)
        files.validate_document(document)
        self.assertEqual(document.read(5), b'%PDF-')

    def test_content_type_comes_from_the_checked_kind(self):
        self.assertEqual(files.content_type_for('pdf'), 'application/pdf')
        self.assertEqual(files.content_type_for('png'), 'image/png')
        self.assertEqual(files.content_type_for('jpeg'), 'image/jpeg')
