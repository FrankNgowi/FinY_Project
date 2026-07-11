import 'package:flutter/material.dart';

import 'package:dikonekti/widgets/voice_assistant_service.dart';

class AccessibilitySettings extends InheritedWidget {
  const AccessibilitySettings({
    super.key,
    required this.voiceAssistantEnabled,
    required this.textScaleFactor,
    required this.setVoiceAssistantEnabled,
    required this.setTextScaleFactor,
    required super.child,
  });

  final bool voiceAssistantEnabled;
  final double textScaleFactor;
  final ValueChanged<bool> setVoiceAssistantEnabled;
  final ValueChanged<double> setTextScaleFactor;

  static AccessibilitySettings of(BuildContext context) {
    final result = context
        .dependOnInheritedWidgetOfExactType<AccessibilitySettings>();
    assert(result != null, 'No AccessibilitySettings found in context');
    return result!;
  }

  @override
  bool updateShouldNotify(AccessibilitySettings oldWidget) {
    return voiceAssistantEnabled != oldWidget.voiceAssistantEnabled ||
        textScaleFactor != oldWidget.textScaleFactor;
  }
}

class AccessibilityButton extends StatelessWidget {
  const AccessibilityButton({super.key});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: const Icon(Icons.accessibility_new),
      tooltip: 'Accessibility settings',
      onPressed: () {
        final settings = AccessibilitySettings.of(context);
        String selectedMode = 'Default';
        if (settings.voiceAssistantEnabled) {
          selectedMode = 'Vision';
        }

        showDialog<void>(
          context: context,
          builder: (dialogContext) {
            return AlertDialog(
              title: const Text('Accessibility Settings'),
              content: StatefulBuilder(
                builder: (context, setState) {
                  return SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text(
                          'Choose how you want the app to support accessibility.',
                        ),
                        const SizedBox(height: 12),
                        DropdownButtonFormField<String>(
                          value: selectedMode,
                          decoration: const InputDecoration(
                            labelText: 'Accessibility mode',
                            border: OutlineInputBorder(),
                          ),
                          items: const [
                            DropdownMenuItem(
                              value: 'Default',
                              child: Text('Default'),
                            ),
                            DropdownMenuItem(
                              value: 'Vision',
                              child: Text('Vision'),
                            ),
                            DropdownMenuItem(
                              value: 'Hearing',
                              child: Text('Hearing'),
                            ),
                          ],
                          onChanged: (value) {
                            if (value != null) {
                              selectedMode = value;
                              setState(() {});
                              if (value == 'Vision') {
                                settings.setVoiceAssistantEnabled(true);
                                settings.setTextScaleFactor(1.15);
                                VoiceAssistantService.speak(
                                  'Voice assistant enabled for vision support.',
                                );
                              } else if (value == 'Default') {
                                settings.setVoiceAssistantEnabled(false);
                                settings.setTextScaleFactor(1.0);
                                VoiceAssistantService.speak(
                                  'Voice assistant disabled.',
                                );
                              }
                            }
                          },
                        ),
                        const SizedBox(height: 12),
                        SwitchListTile(
                          title: const Text('Voice assistant'),
                          value: settings.voiceAssistantEnabled,
                          onChanged: (value) {
                            settings.setVoiceAssistantEnabled(value);
                            if (value) {
                              selectedMode = 'Vision';
                              VoiceAssistantService.speak(
                                'Voice assistant enabled.',
                              );
                            } else {
                              selectedMode = 'Default';
                              VoiceAssistantService.speak(
                                'Voice assistant disabled.',
                              );
                            }
                            setState(() {});
                          },
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Text size: ${settings.textScaleFactor.toStringAsFixed(2)}x',
                        ),
                        Slider(
                          min: 1.0,
                          max: 1.4,
                          divisions: 8,
                          value: settings.textScaleFactor,
                          onChanged: (value) {
                            settings.setTextScaleFactor(value);
                            setState(() {});
                          },
                        ),
                      ],
                    ),
                  );
                },
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(),
                  child: const Text('Close'),
                ),
              ],
            );
          },
        );
      },
    );
  }
}