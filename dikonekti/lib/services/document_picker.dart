import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';

import 'verification_document.dart';

/// A file the doctor chose, reduced to what the screen needs. The bytes are
/// read only when the upload starts, and the path is never used (on Android and
/// iOS the picker may hand back a content address or a temporary copy).
class PickedDocument {
  const PickedDocument({
    required this.name,
    required this.length,
    required this.readBytes,
  });

  final String name;
  final int length;
  final Future<Uint8List> Function() readBytes;
}

/// Opens the system file dialog, limited to PDF, JPG and PNG. Returns null
/// when the doctor cancels.
Future<PickedDocument?> pickDocumentWithFilePicker() async {
  final file = await FilePicker.pickFile(
    type: FileType.custom,
    allowedExtensions: DocumentRules.allowedExtensions,
  );
  if (file == null) return null;

  // Most pickers report the size without reading the file. When one does not,
  // read the bytes once to measure them and reuse them for the upload.
  final reported = await file.length();
  final Uint8List? measured = reported == null ? await file.readAsBytes() : null;
  return PickedDocument(
    name: file.name,
    length: reported ?? measured!.length,
    readBytes: () async => measured ?? await file.readAsBytes(),
  );
}
