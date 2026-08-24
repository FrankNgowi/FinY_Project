class ChatMessage {
  ChatMessage({
    required this.id,
    required this.senderUsername,
    required this.recipientUsername,
    required this.body,
    required this.timestamp,
  });

  final String id;
  final String senderUsername;
  final String recipientUsername;
  final String body;
  final DateTime timestamp;

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['id'].toString(),
      senderUsername: json['sender_username'] as String? ?? '',
      recipientUsername: json['recipient_username'] as String? ?? '',
      body: json['body'] as String? ?? '',
      timestamp: DateTime.tryParse(json['timestamp'] as String? ?? '') ??
          DateTime.now(),
    );
  }
}