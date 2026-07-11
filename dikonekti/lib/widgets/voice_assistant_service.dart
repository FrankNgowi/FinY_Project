import 'package:flutter/foundation.dart';
import 'package:flutter_tts/flutter_tts.dart';

/// Wraps flutter_tts with the setup this app actually needs:
/// - "flush" queue mode, so a new announcement interrupts whatever is still
///   being read instead of queuing up behind it. Without this, anything that
///   speaks on every keystroke (see the login/create-account fields) piles up
///   a huge backlog and the assistant appears to "stop working" because it's
///   minutes behind what's on screen.
/// - iOS audio session configured for playback, so speech isn't silently
///   dropped when the device's silent switch is on.
/// - Defensive error handling, so a failed init doesn't just go silent
///   forever with no signal of what happened.
class VoiceAssistantService {
  static final FlutterTts _tts = FlutterTts();
  static bool _initialized = false;
  static bool _initializing = false;

  static Future<void> initialize() async {
    if (_initialized || _initializing) return;
    _initializing = true;

    try {
      // iOS/macOS only — lets speech play even if the silent switch is on.
      // Harmless no-op on platforms that don't support it.
      try {
        await _tts.setSharedInstance(true);
        await _tts.setIosAudioCategory(
          IosTextToSpeechAudioCategory.playback,
          [
            IosTextToSpeechAudioCategoryOptions.duckOthers,
            IosTextToSpeechAudioCategoryOptions.mixWithOthers,
          ],
          IosTextToSpeechAudioMode.voicePrompt,
        );
      } catch (_) {
        // Not available on this platform (e.g. Android) — safe to ignore.
      }

      // Make speak() resolve only once the utterance actually finishes,
      // and make each new speak() flush/interrupt anything still playing
      // instead of queuing behind it.
      await _tts.awaitSpeakCompletion(true);

      await _tts.setLanguage('en-US');
      await _tts.setSpeechRate(0.5);
      await _tts.setVolume(1.0);
      await _tts.setPitch(1.0);

      _tts.setErrorHandler((message) {
        debugPrint('VoiceAssistantService error: $message');
      });

      _initialized = true;
    } catch (error, stackTrace) {
      // Leave _initialized false so the next speak() call retries setup
      // instead of staying silently broken for the rest of the session.
      debugPrint('VoiceAssistantService failed to initialize: $error');
      debugPrintStack(stackTrace: stackTrace);
    } finally {
      _initializing = false;
    }
  }

  /// Speaks [text].
  ///
  /// [interrupt] controls how this announcement behaves relative to
  /// whatever is currently playing:
  /// - `true` (default): stop whatever is being said right now and speak
  ///   this instead. Use this for frequent, low-stakes feedback — typed
  ///   characters, field-focus hints, button-press confirmations — so it
  ///   never piles up into a backlog while the user keeps moving around
  ///   the screen.
  /// - `false`: queue behind whatever is currently playing, so this
  ///   announcement is heard in full instead of cutting the previous one
  ///   off. Use this for one-off, sequential announcements — e.g. a
  ///   "voice assistant enabled" confirmation immediately followed by a
  ///   screen description — where trimming the first message short would
  ///   be confusing.
  static Future<void> speak(String text, {bool interrupt = true}) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty) return;

    await initialize();
    if (!_initialized) return;

    try {
      if (interrupt) {
        await _tts.stop();
      }
      await _tts.speak(trimmed);
    } catch (error) {
      debugPrint('VoiceAssistantService failed to speak "$trimmed": $error');
    }
  }

  /// Immediately stops any in-progress speech (e.g. when navigating away).
  static Future<void> stop() async {
    try {
      await _tts.stop();
    } catch (error) {
      debugPrint('VoiceAssistantService failed to stop: $error');
    }
  }
}