import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';

import 'package:dikonekti/models/doctor_verification.dart';
import 'package:dikonekti/models/user_account.dart';
import 'package:dikonekti/services/api_client.dart';
import 'package:dikonekti/services/document_picker.dart';
import 'package:dikonekti/services/verification_api_service.dart';
import 'package:dikonekti/services/verification_document.dart';
import 'package:dikonekti/widgets/accessibility_settings.dart';
import 'package:dikonekti/widgets/logout_button.dart';
import 'package:dikonekti/widgets/voice_assistant_service.dart';

/// What a doctor sees until an admin approves their certificate: upload it,
/// wait for the decision, or read why it was refused and send a new one.
///
/// The status, the file picker and the upload are passed in so the screen can
/// be tested without a server or the system file dialog.
class VerificationPage extends StatefulWidget {
  const VerificationPage({
    super.key,
    required this.user,
    required this.onLogout,
    required this.onApproved,
    this.loadStatus = VerificationApiService.getStatus,
    this.pickDocument = pickDocumentWithFilePicker,
    this.uploadDocument = VerificationApiService.upload,
    this.pollInterval = const Duration(seconds: 30),
  });

  final UserAccount user;
  final VoidCallback onLogout;

  /// Called when the doctor is approved, so the app can read the profile again
  /// and open the dashboard.
  final VoidCallback onApproved;

  final Future<DoctorVerification> Function() loadStatus;
  final Future<PickedDocument?> Function() pickDocument;
  final Future<DoctorVerification> Function({
    required String fileName,
    required Uint8List bytes,
  }) uploadDocument;
  final Duration pollInterval;

  @override
  State<VerificationPage> createState() => _VerificationPageState();
}

class _VerificationPageState extends State<VerificationPage> {
  static const _navy = Color(0xFF1D3557);
  static const _ink = Color(0xFF14213D);
  static const _teal = Color(0xFF2A9D8F);
  static const _network =
      'Could not reach the server. Check your connection and try again.';

  DoctorVerification? _record;
  bool _loading = true;
  String? _loadError;
  String? _recheckError;
  bool _uploading = false;
  PickedDocument? _chosen;
  String? _chooseError;
  VerificationStatus? _announced;
  Timer? _timer;

  /// Numbers each status request so only the newest answer is applied.
  int _loadSeq = 0;

  @override
  void initState() {
    super.initState();
    _load();
    // Only a document waiting for review (or one just approved) can change on
    // its own, so only those states are re-checked.
    _timer = Timer.periodic(widget.pollInterval, (_) => _tick());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _tick() {
    if (_uploading) return;
    final lifecycle = WidgetsBinding.instance.lifecycleState;
    if (lifecycle != null && lifecycle != AppLifecycleState.resumed) return;
    final status = _record?.status;
    if (status == VerificationStatus.pending ||
        status == VerificationStatus.approved) {
      _load(silent: true);
    }
  }

  String _messageFor(Object error) =>
      error is ApiException ? error.message : _network;

  Future<void> _load({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = true;
        _loadError = null;
      });
    }
    final seq = ++_loadSeq;
    try {
      final record = await widget.loadStatus();
      if (!mounted || seq != _loadSeq) return;
      setState(() {
        _record = record;
        _loading = false;
        _loadError = null;
        _recheckError = null;
      });
      _afterStatus(record);
    } catch (error) {
      if (!mounted || seq != _loadSeq) return;
      setState(() {
        _loading = false;
        if (_record != null) {
          _recheckError =
              'Could not check your status right now. We will try again.';
        } else {
          _loadError = _messageFor(error);
        }
      });
    }
  }

  void _afterStatus(DoctorVerification record) {
    if (record.status != _announced) {
      _announced = record.status;
      _speak(record);
    }
    if (record.status == VerificationStatus.approved) widget.onApproved();
  }

  void _speak(DoctorVerification record) {
    if (!mounted || !AccessibilitySettings.of(context).voiceAssistantEnabled) {
      return;
    }
    final text = switch (record.status) {
      VerificationStatus.notSubmitted =>
        'Verification needed. Upload your confirmation letter or certificate '
            'to start using the app.',
      VerificationStatus.pending =>
        'Your document is under review. We will unlock your dashboard once it '
            'is approved.',
      VerificationStatus.rejected =>
        'Your document was not accepted. Reason: ${record.rejectionReason}. '
            'You can upload a new file.',
      VerificationStatus.approved => 'Approved. Opening your dashboard.',
      VerificationStatus.unknown => '',
    };
    VoiceAssistantService.speak(text, interrupt: false);
  }

  Future<void> _choose() async {
    final picked = await widget.pickDocument();
    if (!mounted || picked == null) return;
    final length = picked.length;
    final problem = length == null
        ? DocumentRules.unreadableMessage
        : DocumentRules.validate(picked.name, length);
    setState(() {
      if (problem != null) {
        _chosen = null;
        _chooseError = problem;
      } else {
        _chosen = picked;
        _chooseError = null;
      }
    });
  }

  Future<void> _submit() async {
    if (_uploading) return;
    final file = _chosen;
    if (file == null) {
      setState(() => _chooseError = DocumentRules.chooseFileMessage);
      return;
    }
    setState(() {
      _uploading = true;
      _chooseError = null;
    });
    try {
      final bytes = await file.readBytes();
      final updated = await widget.uploadDocument(
        fileName: file.name,
        bytes: bytes,
      );
      if (!mounted) return;
      setState(() {
        _record = updated;
        _chosen = null;
        _recheckError = null;
      });
      _afterStatus(updated);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_messageFor(error)),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  // ---- UI -------------------------------------------------------------

  Widget _card({required Widget child}) {
    return Semantics(
      container: true,
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE7ECEF)),
        ),
        child: child,
      ),
    );
  }

  Widget _banner(String message, {VoidCallback? onRetry}) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF4E5),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Icon(Icons.warning_amber_rounded, color: Colors.orange.shade800),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: TextStyle(fontSize: 13, color: Colors.orange.shade900),
            ),
          ),
          if (onRetry != null)
            TextButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }

  Widget _title(String text, IconData icon, Color color) {
    return Row(
      children: [
        Icon(icon, color: color),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: _ink,
            ),
          ),
        ),
      ],
    );
  }

  Widget _uploadForm(String submitLabel) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 6),
        const Text(
          'PDF, JPG or PNG, up to 5 MB',
          style: TextStyle(fontSize: 13, color: Color(0xFF5B6573)),
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            OutlinedButton.icon(
              onPressed: _uploading ? null : _choose,
              icon: const Icon(Icons.attach_file_rounded),
              label: const Text('Choose file'),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                _chosen?.name ?? 'No file chosen',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 14, color: _ink),
              ),
            ),
          ],
        ),
        if (_chooseError != null) ...[
          const SizedBox(height: 8),
          Semantics(
            liveRegion: true,
            child: Text(
              _chooseError!,
              style: const TextStyle(fontSize: 13, color: Color(0xFFC1121F)),
            ),
          ),
        ],
        const SizedBox(height: 16),
        FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: _navy,
            minimumSize: const Size.fromHeight(48),
          ),
          onPressed: _uploading ? null : _submit,
          child: _uploading
              ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    color: Colors.white,
                  ),
                )
              : Text(submitLabel),
        ),
      ],
    );
  }

  Widget _statusCard(DoctorVerification record) {
    switch (record.status) {
      case VerificationStatus.notSubmitted:
        return _card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _title('Upload your confirmation letter or certificate',
                  Icons.upload_file_rounded, _navy),
              _uploadForm('Submit for review'),
            ],
          ),
        );
      case VerificationStatus.pending:
        final when = record.submittedLabel;
        return _card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _title('Your document is under review',
                  Icons.hourglass_top_rounded, _teal),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFE8F5EE),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '${when != null ? 'Submitted $when. ' : ''}'
                  'We will unlock your dashboard once it is approved.',
                  style: const TextStyle(fontSize: 14, color: _ink),
                ),
              ),
              const SizedBox(height: 10),
              const Text(
                'This page checks every 30 seconds and moves on by itself.',
                style: TextStyle(fontSize: 12, color: Color(0xFF5B6573)),
              ),
            ],
          ),
        );
      case VerificationStatus.rejected:
        return _card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _title('Your document was not accepted',
                  Icons.error_outline_rounded, const Color(0xFFE76F51)),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF4E5),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  'Reason: ${record.rejectionReason}',
                  style: TextStyle(fontSize: 14, color: Colors.orange.shade900),
                ),
              ),
              _uploadForm('Submit again'),
            ],
          ),
        );
      case VerificationStatus.approved:
        return _card(
          child: const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: Center(child: Text('Approved. Opening your dashboard…')),
          ),
        );
      case VerificationStatus.unknown:
        // A status this app does not know must never read as an approval.
        return _banner(
          'We could not read your verification status.',
          onRetry: () => _load(),
        );
    }
  }

  Widget _header() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1D3557), Color(0xFF457B9D)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Signed in as',
            style: TextStyle(fontSize: 14, color: Colors.white70),
          ),
          const SizedBox(height: 2),
          Text(
            widget.user.displayName,
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final record = _record;
    final Widget body;
    if (_loading && record == null) {
      body = const Padding(
        padding: EdgeInsets.symmetric(vertical: 40),
        child: Column(
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 14),
            Text('Checking your document status…'),
          ],
        ),
      );
    } else if (record == null) {
      body = _banner(
        'Could not load your verification status. ${_loadError ?? ''}'.trim(),
        onRetry: () => _load(),
      );
    } else {
      body = _statusCard(record);
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF3F7F6),
      appBar: AppBar(
        title: const Text('Verification'),
        actions: [
          LogoutButton(onLogout: widget.onLogout),
          const AccessibilityButton(),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => _load(silent: true),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _header(),
                if (_recheckError != null) ...[
                  const SizedBox(height: 16),
                  _banner(_recheckError!),
                ],
                const SizedBox(height: 20),
                body,
              ],
            ),
          ),
        ),
      ),
    );
  }
}
