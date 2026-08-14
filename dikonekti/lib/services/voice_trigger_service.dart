import 'dart:async';

import 'package:speech_to_text/speech_recognition_result.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;

/// Listens continuously for one of the configured distress words and
/// calls [onTriggerWord] the moment one is heard.
///
/// Important limits, worth understanding before relying on this:
/// - This only listens while the app is open and this screen is active.
///   It is NOT a true always-on wake-word engine like "Hey Siri" — the
///   OS-level speech recognizer used here has to be explicitly started,
///   and Android/iOS both restrict genuine background listening without
///   a dedicated wake-word engine (e.g. Picovoice Porcupine), which is
///   out of scope here.
/// - Recognition quality for Swahili words depends entirely on whether
///   the device's speech engine has a Swahili language pack installed.
///   On a device set to English-only, "nisaidie"/"msaada" may transcribe
///   as nonsense text and never match — this is a device/OS limitation,
///   not something fixable purely in Dart.
/// - Matching is a lenient substring check (not exact-word match) since
///   speech-to-text output is noisy. That trades a few more false
///   positives for fewer missed genuine triggers, which is the right
///   tradeoff for an emergency feature — but a 30 second cooldown after
///   each trigger stops one shouted word from firing repeatedly as the
///   recognizer re-emits overlapping partial results.
class VoiceTriggerService {
  VoiceTriggerService({required this.onTriggerWord, required this.onError});

  final void Function(String matchedWord) onTriggerWord;
  final void Function(String message) onError;

  static const List<String> _triggerWords = ['nisaidie', 'msaada'];
  static const Duration _cooldown = Duration(seconds: 30);

  final stt.SpeechToText _speech = stt.SpeechToText();
  bool _isListening = false;
  bool _shouldKeepListening = false;
  DateTime? _lastTriggerAt;

  bool get isListening => _isListening;

  /// Starts continuous listening. Returns false (and calls [onError]) if
  /// speech recognition isn't available on this device or the microphone
  /// permission was denied.
  Future<bool> start() async {
    if (_shouldKeepListening) return true;

    final available = await _speech.initialize(
      onError: (error) =>
          onError('Speech recognition error: ${error.errorMsg}'),
      onStatus: _handleStatus,
    );

    if (!available) {
      onError(
        'Speech recognition is not available on this device, or '
        'microphone permission was denied.',
      );
      return false;
    }

    _shouldKeepListening = true;
    await _listenOnce();
    return true;
  }

  Future<void> stop() async {
    _shouldKeepListening = false;
    await _speech.stop();
    _isListening = false;
  }

  void _handleStatus(String status) {
    _isListening = status == 'listening';

    // The platform speech session ends on its own after a period of
    // silence or a maximum duration — restart it to keep listening
    // continuously, as long as the user hasn't turned this off.
    if ((status == 'done' || status == 'notListening') &&
        _shouldKeepListening) {
      Future.delayed(const Duration(milliseconds: 500), _listenOnce);
    }
  }

  Future<void> _listenOnce() async {
    if (!_shouldKeepListening) return;
    try {
      await _speech.listen(
        onResult: _handleResult,
        listenFor: const Duration(seconds: 30),
        pauseFor: const Duration(seconds: 5),
        listenOptions: stt.SpeechListenOptions(
          listenMode: stt.ListenMode.confirmation,
          partialResults: true,
          cancelOnError: false,
        ),
      );
    } catch (_) {
      if (_shouldKeepListening) {
        Future.delayed(const Duration(seconds: 2), _listenOnce);
      }
    }
  }

  void _handleResult(SpeechRecognitionResult result) {
    final recognized = result.recognizedWords.toLowerCase();
    for (final trigger in _triggerWords) {
      if (recognized.contains(trigger)) {
        _fireTrigger(trigger);
        break;
      }
    }
  }

  void _fireTrigger(String matchedWord) {
    final now = DateTime.now();
    if (_lastTriggerAt != null && now.difference(_lastTriggerAt!) < _cooldown) {
      return;
    }
    _lastTriggerAt = now;
    onTriggerWord(matchedWord);
  }

  void dispose() {
    _shouldKeepListening = false;
    _speech.stop();
  }
}