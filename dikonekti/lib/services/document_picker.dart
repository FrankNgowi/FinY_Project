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
  /// Null when the picker could not tell the size; such a file is refused
  /// rather than read into memory to find out.
  final int? length;
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
  return PickedDocument(
    name: file.name,
    length: await file.length(),
    readBytes: file.readAsBytes,
  );
}
