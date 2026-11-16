import 'package:dikonekti/widgets/accessibility_settings.dart';
import 'package:flutter/material.dart';

/// Wraps a screen the way the real app does (MaterialApp plus the accessibility
/// settings every screen reads), with the voice assistant off.
Widget appAround(Widget child, {bool voice = false}) {
  return AccessibilitySettings(
    voiceAssistantEnabled: voice,
    textScaleFactor: 1.0,
    setVoiceAssistantEnabled: (_) {},
    setTextScaleFactor: (_) {},
    child: MaterialApp(home: child),
  );
}
