import 'package:dikonekti/models/chat_message.dart';

import 'api_client.dart';

/// Talks to the Django backend's /api/messages/ endpoint.
///
/// A disabled user's thread is implicit — there's only ever one, with
/// their own registered doctor, so no patient/recipient needs to be
/// specified when reading. A doctor must specify which patient's thread
/// they want, since they may have several.
class MessageApiService {
  /// Disabled user: call with no arguments — the server resolves the
  /// thread to their own registered doctor.
  /// Doctor: must pass [patientUsername] to select which patient's
  /// thread to view.
  static Future<List<ChatMessage>> getMessages({String? patientUsername}) async {
    final path = patientUsername != null
        ? '/messages/?patient=$patientUsername'
        : '/messages/';
    final response = await ApiClient.getList(path);
    return response
        .cast<Map<String, dynamic>>()
        .map(ChatMessage.fromJson)
        .toList();
  }

  /// Disabled user: pass only [body] — the recipient is always their own
  /// registered doctor, resolved server-side.
  /// Doctor: must also pass [recipientUsername], and it must actually be
  /// one of their own patients.
  static Future<ChatMessage> sendMessage({
    required String body,
    String? recipientUsername,
  }) async {
    final response = await ApiClient.postMap('/messages/', {
      'body': body,
      if (recipientUsername != null) 'recipient_username': recipientUsername,
    });
    return ChatMessage.fromJson(response);
  }
}