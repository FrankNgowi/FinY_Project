import 'package:flutter/material.dart';

import 'package:dikonekti/widgets/accessibility_settings.dart';
import 'package:dikonekti/widgets/voice_assistant_service.dart';

/// The app bar's log out button, with its confirmation dialog. Shared by the
/// dashboards and the verification screen.
class LogoutButton extends StatelessWidget {
  const LogoutButton({super.key, required this.onLogout});

  final VoidCallback onLogout;

  Future<void> _confirmLogout(BuildContext context) async {
    final accessibility = AccessibilitySettings.of(context);
    if (accessibility.voiceAssistantEnabled) {
      VoiceAssistantService.speak(
        'Log out button. Double tap to log out of your account.',
      );
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          icon: const Icon(
            Icons.logout_rounded,
            color: Color(0xFF6750A4),
            size: 32,
          ),
          title: const Text('Log Out?'),
          content: const Text(
            'You will need to sign in again to access your dashboard.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFC1121F),
              ),
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('Log Out'),
            ),
          ],
        );
      },
    );

    if (confirmed == true) {
      if (accessibility.voiceAssistantEnabled) {
        VoiceAssistantService.speak('Logged out.');
      }
      onLogout();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Log out button',
      button: true,
      hint: 'Double tap to log out',
      child: IconButton(
        icon: const Icon(Icons.logout_rounded),
        tooltip: 'Log out',
        onPressed: () => _confirmLogout(context),
      ),
    );
  }
}
