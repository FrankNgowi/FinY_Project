import 'package:flutter/material.dart';

import 'package:dikonekti/models/emergency_alert.dart';
import 'package:dikonekti/models/user_account.dart';
import 'package:dikonekti/services/location_service.dart';
import 'package:dikonekti/widgets/accessibility_settings.dart';
import 'package:dikonekti/widgets/voice_assistant_service.dart';

import 'helpers.dart';

class DisabledUserDashboard extends StatefulWidget {
  const DisabledUserDashboard({
    super.key,
    required this.user,
    required this.onAlertSent,
  });

  final UserAccount user;
  final ValueChanged<EmergencyAlert> onAlertSent;

  @override
  State<DisabledUserDashboard> createState() => _DisabledUserDashboardState();
}

class _DisabledUserDashboardState extends State<DisabledUserDashboard> {
  bool _hasAnnouncedWelcome = false;

  @override
  Widget build(BuildContext context) {
    final accessibility = AccessibilitySettings.of(context);
    final greeting = _timeOfDayGreeting();
    final welcomeMessage =
        '$greeting, ${widget.user.username}! Welcome back to your dashboard.';

    if (!_hasAnnouncedWelcome && accessibility.voiceAssistantEnabled) {
      _hasAnnouncedWelcome = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        VoiceAssistantService.speak(
          '$welcomeMessage You have quick access to your doctor, your '
          'profile, and an emergency alert button at the bottom of the screen.',
        );
      });
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF5F3FB),
      appBar: AppBar(
        title: const Text('My Dashboard'),
        actions: const [AccessibilityButton()],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _WelcomeHeader(
                      greeting: greeting,
                      username: widget.user.username,
                    ),
                    const SizedBox(height: 24),
                    const Text(
                      'Quick Actions',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF2D2150),
                      ),
                    ),
                    const SizedBox(height: 12),
                    _QuickActionsGrid(
                      actions: [
                        _QuickAction(
                          icon: Icons.medical_services_rounded,
                          label: 'My Doctor',
                          color: const Color(0xFF6750A4),
                          onTap: () => _showInfoSnack(
                            context,
                            'Opening your registered doctor\'s contact details.',
                          ),
                        ),
                        _QuickAction(
                          icon: Icons.person_rounded,
                          label: 'My Profile',
                          color: const Color(0xFF386641),
                          onTap: () =>
                              _showInfoSnack(context, 'Opening your profile.'),
                        ),
                        _QuickAction(
                          icon: Icons.tips_and_updates_rounded,
                          label: 'Health Tips',
                          color: const Color(0xFFBC6C25),
                          onTap: () => _showInfoSnack(
                            context,
                            'Showing helpful health tips.',
                          ),
                        ),
                        _QuickAction(
                          icon: Icons.settings_accessibility_rounded,
                          label: 'Accessibility',
                          color: const Color(0xFF1D3557),
                          onTap: () {
                            final button = const AccessibilityButton();
                            showDialog<void>(
                              context: context,
                              builder: (_) => button,
                            );
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE6E1F5)),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.info_outline_rounded,
                            color: Color(0xFF6750A4),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              'Hope you are doing well! Tap the red button '
                              'below at any time if you need urgent help.',
                              style: TextStyle(
                                fontSize: 14,
                                color: Colors.grey.shade700,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
                ),
              ),
            ),
            _EmergencyAlertBar(
              user: widget.user,
              onAlertSent: widget.onAlertSent,
            ),
          ],
        ),
      ),
    );
  }

  void _showInfoSnack(BuildContext context, String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
    if (AccessibilitySettings.of(context).voiceAssistantEnabled) {
      VoiceAssistantService.speak(message);
    }
  }

  String _timeOfDayGreeting() {
    final hour = DateTime.now().hour;

    if (hour < 12) {
      return 'Good morning';
    } else if (hour < 18) {
      return 'Good afternoon';
    } else {
      return 'Good evening';
    }
  }
}

class DoctorDashboard extends StatefulWidget {
  const DoctorDashboard({
    super.key,
    required this.user,
    required this.alerts,
    required this.onAlertAcknowledged,
  });

  final UserAccount user;
  final List<EmergencyAlert> alerts;
  final ValueChanged<String> onAlertAcknowledged;

  @override
  State<DoctorDashboard> createState() => _DoctorDashboardState();
}

class _DoctorDashboardState extends State<DoctorDashboard> {
  bool _hasAnnouncedWelcome = false;
  int _lastKnownAlertCount = 0;

  @override
  void initState() {
    super.initState();
    _lastKnownAlertCount = widget.alerts.length;
  }

  @override
  void didUpdateWidget(DoctorDashboard oldWidget) {
    super.didUpdateWidget(oldWidget);
    final accessibility = AccessibilitySettings.of(context);
    if (widget.alerts.length > _lastKnownAlertCount &&
        accessibility.voiceAssistantEnabled) {
      final newest = widget.alerts.first;
      VoiceAssistantService.speak(
        'New emergency alert from ${newest.patientName}. Please check the '
        'alerts list.',
      );
    }
    _lastKnownAlertCount = widget.alerts.length;
  }

  @override
  Widget build(BuildContext context) {
    final accessibility = AccessibilitySettings.of(context);
    final greeting = _timeOfDayGreeting();
    final displayName = widget.user.username.toLowerCase().startsWith('dr')
        ? widget.user.username
        : 'Dr. ${widget.user.username}';
    final welcomeMessage =
        '$greeting, $displayName! Welcome to your dashboard.';

    final activeAlerts = widget.alerts
        .where((a) => !a.acknowledged)
        .toList(growable: false);
    final pastAlerts = widget.alerts
        .where((a) => a.acknowledged)
        .toList(growable: false);

    if (!_hasAnnouncedWelcome && accessibility.voiceAssistantEnabled) {
      _hasAnnouncedWelcome = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final alertNote = activeAlerts.isEmpty
            ? 'You have no active emergency alerts right now.'
            : 'You have ${activeAlerts.length} active emergency '
                  '${activeAlerts.length == 1 ? 'alert' : 'alerts'} that need attention.';
        VoiceAssistantService.speak('$welcomeMessage $alertNote');
      });
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF3F7F6),
      appBar: AppBar(
        title: const Text('Doctor Dashboard'),
        actions: const [AccessibilityButton()],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _DoctorWelcomeHeader(
                greeting: greeting,
                displayName: displayName,
                activeAlertCount: activeAlerts.length,
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  const Icon(Icons.sos_rounded, color: Color(0xFFC1121F)),
                  const SizedBox(width: 8),
                  const Text(
                    'Emergency Alerts',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF14213D),
                    ),
                  ),
                  const Spacer(),
                  if (activeAlerts.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFC1121F),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        '${activeAlerts.length} active',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              if (widget.alerts.isEmpty)
                const _NoAlertsCard()
              else ...[
                for (final alert in activeAlerts)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _EmergencyAlertCard(
                      alert: alert,
                      onAcknowledge: () => widget.onAlertAcknowledged(alert.id),
                    ),
                  ),
                if (pastAlerts.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Resolved',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Colors.grey.shade600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  for (final alert in pastAlerts)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: _EmergencyAlertCard(
                        alert: alert,
                        onAcknowledge: () =>
                            widget.onAlertAcknowledged(alert.id),
                      ),
                    ),
                ],
              ],
              const SizedBox(height: 24),
              const Text(
                'Quick Actions',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF14213D),
                ),
              ),
              const SizedBox(height: 12),
              _QuickActionsGrid(
                actions: [
                  _QuickAction(
                    icon: Icons.groups_rounded,
                    label: 'My Patients',
                    color: const Color(0xFF1D3557),
                    onTap: () => _showInfoSnack(
                      context,
                      'Opening your list of registered patients.',
                    ),
                  ),
                  _QuickAction(
                    icon: Icons.calendar_month_rounded,
                    label: 'Schedule',
                    color: const Color(0xFF457B9D),
                    onTap: () => _showInfoSnack(
                      context,
                      'Opening your appointment schedule.',
                    ),
                  ),
                  _QuickAction(
                    icon: Icons.chat_bubble_rounded,
                    label: 'Messages',
                    color: const Color(0xFF2A9D8F),
                    onTap: () =>
                        _showInfoSnack(context, 'Opening your messages.'),
                  ),
                  _QuickAction(
                    icon: Icons.settings_accessibility_rounded,
                    label: 'Accessibility',
                    color: const Color(0xFF6D6875),
                    onTap: () {
                      final button = const AccessibilityButton();
                      showDialog<void>(
                        context: context,
                        builder: (_) => button,
                      );
                    },
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showInfoSnack(BuildContext context, String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
    if (AccessibilitySettings.of(context).voiceAssistantEnabled) {
      VoiceAssistantService.speak(message);
    }
  }

  String _timeOfDayGreeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) {
      return 'Good morning';
    } else if (hour < 18) {
      return 'Good afternoon';
    }
    return 'Good evening';
  }
}

class _WelcomeHeader extends StatelessWidget {
  const _WelcomeHeader({required this.greeting, required this.username});

  final String greeting;
  final String username;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '$greeting, $username. Welcome to your dashboard.',
      child: Container(
        padding: const EdgeInsets.all(22),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF6750A4), Color(0xFF9B7FE8)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF6750A4).withOpacity(0.25),
              blurRadius: 16,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          children: [
            CircleAvatar(
              radius: 30,
              backgroundColor: Colors.white.withOpacity(0.2),
              child: Text(
                username.isNotEmpty ? username[0].toUpperCase() : '?',
                style: const TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$greeting,',
                    style: TextStyle(
                      fontSize: 15,
                      color: Colors.white.withOpacity(0.85),
                    ),
                  ),
                  Text(
                    username,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.18),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Text(
                      'We\'re here to support you',
                      style: TextStyle(fontSize: 12, color: Colors.white),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DoctorWelcomeHeader extends StatelessWidget {
  const _DoctorWelcomeHeader({
    required this.greeting,
    required this.displayName,
    required this.activeAlertCount,
  });

  final String greeting;
  final String displayName;
  final int activeAlertCount;

  @override
  Widget build(BuildContext context) {
    final hasActive = activeAlertCount > 0;
    return Semantics(
      label:
          '$greeting, $displayName. Welcome to your dashboard. '
          '${hasActive ? '$activeAlertCount active emergency alerts.' : 'No active emergency alerts.'}',
      child: Container(
        padding: const EdgeInsets.all(22),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF1D3557), Color(0xFF457B9D)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF1D3557).withOpacity(0.25),
              blurRadius: 16,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          children: [
            CircleAvatar(
              radius: 30,
              backgroundColor: Colors.white.withOpacity(0.2),
              child: const Icon(
                Icons.medical_services_rounded,
                color: Colors.white,
                size: 28,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$greeting,',
                    style: TextStyle(
                      fontSize: 15,
                      color: Colors.white.withOpacity(0.85),
                    ),
                  ),
                  Text(
                    displayName,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: hasActive
                          ? Colors.red.shade400
                          : Colors.white.withOpacity(0.18),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      hasActive
                          ? '$activeAlertCount active alert${activeAlertCount == 1 ? '' : 's'}'
                          : 'All patients are stable',
                      style: const TextStyle(fontSize: 12, color: Colors.white),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NoAlertsCard extends StatelessWidget {
  const _NoAlertsCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE1EDEA)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFF2A9D8F).withOpacity(0.12),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.check_circle_rounded,
              color: Color(0xFF2A9D8F),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              'No emergency alerts right now. You will be notified '
              'immediately if a patient needs urgent help.',
              style: TextStyle(fontSize: 14, color: Colors.grey.shade700),
            ),
          ),
        ],
      ),
    );
  }
}

class _EmergencyAlertCard extends StatelessWidget {
  const _EmergencyAlertCard({required this.alert, required this.onAcknowledge});

  final EmergencyAlert alert;
  final VoidCallback onAcknowledge;

  @override
  Widget build(BuildContext context) {
    final accessibility = AccessibilitySettings.of(context);
    final isActive = !alert.acknowledged;
    final statusText = isActive
        ? 'Active emergency alert from ${alert.patientName}, ${_timeAgo(alert.timestamp)}.'
        : 'Resolved alert from ${alert.patientName}.';

    return Semantics(
      label: statusText,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border(
            left: BorderSide(
              color: isActive
                  ? const Color(0xFFC1121F)
                  : const Color(0xFF2A9D8F),
              width: 5,
            ),
            top: const BorderSide(color: Color(0xFFEFEFEF)),
            right: const BorderSide(color: Color(0xFFEFEFEF)),
            bottom: const BorderSide(color: Color(0xFFEFEFEF)),
          ),
          boxShadow: isActive
              ? [
                  BoxShadow(
                    color: const Color(0xFFC1121F).withOpacity(0.12),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ]
              : null,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              isActive ? Icons.sos_rounded : Icons.check_circle_rounded,
              color: isActive
                  ? const Color(0xFFC1121F)
                  : const Color(0xFF2A9D8F),
              size: 26,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    alert.patientName,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF14213D),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    isActive
                        ? 'Needs urgent help · ${_timeAgo(alert.timestamp)}'
                        : 'Marked resolved · ${_timeAgo(alert.timestamp)}',
                    style: TextStyle(
                      fontSize: 13,
                      color: isActive
                          ? const Color(0xFFC1121F)
                          : Colors.grey.shade600,
                      fontWeight: isActive
                          ? FontWeight.w600
                          : FontWeight.normal,
                    ),
                  ),
                  if (alert.latitude != null && alert.longitude != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      'Location: ${alert.latitude!.toStringAsFixed(4)}, ${alert.longitude!.toStringAsFixed(4)}',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF4C4C4C),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (isActive)
              Semantics(
                label: 'Acknowledge alert from ${alert.patientName}',
                button: true,
                child: Focus(
                  onFocusChange: (hasFocus) {
                    if (hasFocus && accessibility.voiceAssistantEnabled) {
                      VoiceAssistantService.speak(
                        'Acknowledge alert from ${alert.patientName}',
                      );
                    }
                  },
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF14213D),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 10,
                      ),
                    ),
                    onPressed: () {
                      onAcknowledge();
                      if (accessibility.voiceAssistantEnabled) {
                        VoiceAssistantService.speak(
                          'Alert from ${alert.patientName} acknowledged.',
                        );
                      }
                    },
                    child: const Text('Acknowledge'),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  String _timeAgo(DateTime timestamp) {
    final diff = DateTime.now().difference(timestamp);
    if (diff.inSeconds < 60) {
      return 'Just now';
    } else if (diff.inMinutes < 60) {
      return '${diff.inMinutes}m ago';
    } else if (diff.inHours < 24) {
      return '${diff.inHours}h ago';
    }
    return '${diff.inDays}d ago';
  }
}

class _QuickAction {
  const _QuickAction({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
}

class _QuickActionsGrid extends StatelessWidget {
  const _QuickActionsGrid({required this.actions});

  final List<_QuickAction> actions;

  @override
  Widget build(BuildContext context) {
    final accessibility = AccessibilitySettings.of(context);

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: actions.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 14,
        crossAxisSpacing: 14,
        childAspectRatio: 1.25,
      ),
      itemBuilder: (context, index) {
        final action = actions[index];
        return Semantics(
          label: '${action.label} button',
          button: true,
          hint: 'Double tap to open ${action.label}',
          child: Focus(
            onFocusChange: (hasFocus) {
              if (hasFocus && accessibility.voiceAssistantEnabled) {
                VoiceAssistantService.speak(action.label);
              }
            },
            child: Material(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              child: InkWell(
                borderRadius: BorderRadius.circular(18),
                onTap: () {
                  if (accessibility.voiceAssistantEnabled) {
                    VoiceAssistantService.speak('${action.label} opened.');
                  }
                  action.onTap();
                },
                child: Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: const Color(0xFFEDE9F8)),
                  ),
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: action.color.withOpacity(0.12),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(action.icon, color: action.color, size: 28),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        action.label,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF2D2150),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _EmergencyAlertBar extends StatefulWidget {
  const _EmergencyAlertBar({required this.user, required this.onAlertSent});

  final UserAccount user;
  final ValueChanged<EmergencyAlert> onAlertSent;

  @override
  State<_EmergencyAlertBar> createState() => _EmergencyAlertBarState();
}

class _EmergencyAlertBarState extends State<_EmergencyAlertBar>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseController;
  late final Animation<double> _pulse;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 1, milliseconds: 200),
    )..repeat(reverse: true);
    _pulse = Tween<double>(begin: 0.96, end: 1.0).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  Future<void> _confirmAndSendAlert(BuildContext context) async {
    final accessibility = AccessibilitySettings.of(context);
    if (accessibility.voiceAssistantEnabled) {
      VoiceAssistantService.speak(
        'Emergency alert. Are you sure you want to send an alert to your '
        'doctor and emergency contacts?',
      );
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          icon: const Icon(Icons.warning_rounded, color: Colors.red, size: 36),
          title: const Text('Send Emergency Alert?'),
          content: const Text(
            'This will immediately notify your registered doctor and '
            'emergency contacts with your name and location.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: Colors.red),
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('Send Alert'),
            ),
          ],
        );
      },
    );

    if (confirmed != true || !context.mounted) return;

    final position = await LocationService.getCurrentPosition();

    if (!context.mounted) return;

    widget.onAlertSent(
      EmergencyAlert(
        id: DateTime.now().microsecondsSinceEpoch.toString(),
        patientName: widget.user.username,
        latitude: position?.latitude,
        longitude: position?.longitude,
      ),
    );

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Emergency alert sent. Help is on the way.'),
        backgroundColor: Colors.red,
      ),
    );
    if (accessibility.voiceAssistantEnabled) {
      VoiceAssistantService.speak('Emergency alert sent. Help is on the way.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final accessibility = AccessibilitySettings.of(context);

    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 10, 20, 16),
        decoration: BoxDecoration(
          color: const Color(0xFFF5F3FB),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.06),
              blurRadius: 12,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: Semantics(
          label: 'Emergency alert button',
          button: true,
          hint:
              'Double tap to send an emergency alert to your doctor and contacts',
          child: Focus(
            onFocusChange: (hasFocus) {
              if (hasFocus && accessibility.voiceAssistantEnabled) {
                VoiceAssistantService.speak(
                  'Emergency alert button. Double tap to get urgent help.',
                );
              }
            },
            child: AnimatedBuilder(
              animation: _pulse,
              builder: (context, child) {
                return Transform.scale(scale: _pulse.value, child: child);
              },
              child: SizedBox(
                width: double.infinity,
                height: 58,
                child: ElevatedButton.icon(
                  onPressed: () => _confirmAndSendAlert(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red.shade600,
                    foregroundColor: Colors.white,
                    elevation: 6,
                    shadowColor: Colors.red.withOpacity(0.4),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  icon: const Icon(Icons.sos_rounded, size: 26),
                  label: const Text(
                    'EMERGENCY ALERT',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
