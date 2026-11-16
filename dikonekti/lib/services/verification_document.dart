/// Rules for the certificate a doctor uploads. The phone checks these first so
/// a wrong choice never costs an upload; the backend checks the real file
/// bytes again and stays the authority. The texts are the same as on the web.
abstract final class DocumentRules {
  static const int maxBytes = 5 * 1024 * 1024;

  static const List<String> allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png'];

  static const String chooseFileMessage = 'Choose a PDF, JPG or PNG file.';
  static const String tooLargeMessage = 'The file is larger than 5 MB.';
  static const String emptyMessage = 'The file is empty.';
  static const String tooManyUploadsMessage =
      'Too many uploads. Please wait a while and try again.';

  /// The lower-case extension of [name], or null when it has none (a name
  /// that ends in a dot, or has no dot at all).
  static String? _extension(String name) {
    final dot = name.lastIndexOf('.');
    if (dot < 0 || dot == name.length - 1) return null;
    return name.substring(dot + 1).toLowerCase();
  }

  /// The message to show for a file that must not be sent, or null when it
  /// may be. One problem at a time, in the order a person would fix them:
  /// type first, then empty, then too large.
  static String? validate(String name, int length) {
    final extension = _extension(name);
    if (extension == null || !allowedExtensions.contains(extension)) {
      return chooseFileMessage;
    }
    if (length == 0) return emptyMessage;
    if (length < 0) return emptyMessage;
    if (length > maxBytes) return tooLargeMessage;
    return null;
  }

  static String contentTypeFor(String name) {
    switch (_extension(name)) {
      case 'pdf':
        return 'application/pdf';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      default:
        return 'application/octet-stream';
    }
  }
}
