import 'package:flutter/material.dart';
import 'package:flutter_tts/flutter_tts.dart';

import 'services/user_api_service.dart';

void main() {
  runApp(const MyApp());
}

class VoiceAssistantService {
  static final FlutterTts _tts = FlutterTts();
  static bool _initialized = false;

  static Future<void> initialize() async {
    if (_initialized) return;

    await _tts.setLanguage('en-US');
    await _tts.setSpeechRate(0.5);
    await _tts.setVolume(1.0);
    await _tts.setPitch(1.0);
    _initialized = true;
  }

  static Future<void> speak(String text) async {
    if (text.trim().isEmpty) return;
    await initialize();
    await _tts.speak(text);
  }
}

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

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  bool _voiceAssistantEnabled = false;
  double _textScaleFactor = 1.0;
  final List<UserAccount> _accounts = [];
  UserAccount? _currentUser;

  void _handleLoginSuccess(UserAccount account) {
    setState(() {
      _currentUser = account;
    });
  }

  void _handleAccountCreated(UserAccount account) {
    setState(() {
      _accounts.add(account);
    });
  }

  @override
  Widget build(BuildContext context) {
    return AccessibilitySettings(
      voiceAssistantEnabled: _voiceAssistantEnabled,
      textScaleFactor: _textScaleFactor,
      setVoiceAssistantEnabled: (value) {
        setState(() {
          _voiceAssistantEnabled = value;
        });
      },
      setTextScaleFactor: (value) {
        setState(() {
          _textScaleFactor = value;
        });
      },
      child: MaterialApp(
        title: 'Dikonekti',
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
          useMaterial3: true,
        ),
        builder: (context, child) {
          final mediaQuery = MediaQuery.of(context);
          return MediaQuery(
            data: mediaQuery.copyWith(
              textScaler: TextScaler.linear(_textScaleFactor),
            ),
            child: child!,
          );
        },
        home: _currentUser == null
            ? LoginPage(
                accounts: _accounts,
                onLoginSuccess: _handleLoginSuccess,
                onAccountCreated: _handleAccountCreated,
              )
            : DashboardPage(user: _currentUser!),
      ),
    );
  }
}

class UserAccount {
  UserAccount({
    required this.username,
    required this.password,
    required this.role,
  });

  final String username;
  final String password;
  final String role;
}

/// Returns a friendly, time-of-day aware greeting.
String _timeOfDayGreeting() {
  final hour = DateTime.now().hour;
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

class DashboardPage extends StatelessWidget {
  const DashboardPage({super.key, required this.user});

  final UserAccount user;

  bool get _isDoctor => user.role.toLowerCase() == 'doctor';

  @override
  Widget build(BuildContext context) {
    return _isDoctor
        ? _DoctorDashboard(user: user)
        : _DisabledUserDashboard(user: user);
  }
}

/// ---------------------------------------------------------------------
/// Disabled User Dashboard
/// ---------------------------------------------------------------------
class _DisabledUserDashboard extends StatefulWidget {
  const _DisabledUserDashboard({required this.user});

  final UserAccount user;

  @override
  State<_DisabledUserDashboard> createState() => _DisabledUserDashboardState();
}

class _DisabledUserDashboardState extends State<_DisabledUserDashboard> {
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
      // The emergency button lives outside the scrollable area so it is
      // always reachable, regardless of scroll position or text scale.
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
                            // Reuses the existing accessibility dialog.
                            final button = AccessibilityButton();
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
            const _EmergencyAlertBar(),
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

/// Persistent emergency alert bar pinned to the bottom of the dashboard.
/// Gently pulses to draw attention and requires a confirmation step before
/// sending an alert, so it can't be triggered by an accidental tap.
class _EmergencyAlertBar extends StatefulWidget {
  const _EmergencyAlertBar();

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

    // TODO: hook this up to a real alert/SMS/call service.
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

/// ---------------------------------------------------------------------
/// Doctor Dashboard (kept simple, unchanged in spirit)
/// ---------------------------------------------------------------------
class _DoctorDashboard extends StatelessWidget {
  const _DoctorDashboard({required this.user});

  final UserAccount user;

  @override
  Widget build(BuildContext context) {
    final accessibility = AccessibilitySettings.of(context);
    final greeting = _timeOfDayGreeting();
    final welcomeMessage =
        '$greeting, Dr. ${user.username}! Welcome to your dashboard.';

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (accessibility.voiceAssistantEnabled) {
        VoiceAssistantService.speak(welcomeMessage);
      }
    });

    return Scaffold(
      backgroundColor: const Color(0xFFF5F3FB),
      appBar: AppBar(
        title: const Text('Doctor Dashboard'),
        actions: const [AccessibilityButton()],
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'Doctor Dashboard',
                    style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    welcomeMessage,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 18),
                  ),
                  const SizedBox(height: 24),
                  const Text('Your dashboard is ready.'),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class LoginPage extends StatefulWidget {
  const LoginPage({
    super.key,
    required this.accounts,
    required this.onLoginSuccess,
    required this.onAccountCreated,
  });

  final List<UserAccount> accounts;
  final ValueChanged<UserAccount> onLoginSuccess;
  final ValueChanged<UserAccount> onAccountCreated;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final TextEditingController _usernameController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    final username = _usernameController.text.trim();
    final password = _passwordController.text;

    if (username.isEmpty || password.isEmpty) {
      const message = 'Please enter your username and password.';
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text(message)));
      if (AccessibilitySettings.of(context).voiceAssistantEnabled) {
        VoiceAssistantService.speak(message);
      }
      return;
    }

    try {
      final response = await UserApiService.loginUser(
        username: username,
        password: password,
      );

      final matchedAccount = UserAccount(
        username: response['username']?.toString() ?? username,
        password: password,
        role: response['role']?.toString() ?? 'disabled',
      );

      widget.onLoginSuccess(matchedAccount);

      final welcomeMessage = 'Welcome, ${matchedAccount.username}!';
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(welcomeMessage)));
      if (AccessibilitySettings.of(context).voiceAssistantEnabled) {
        VoiceAssistantService.speak(welcomeMessage);
      }

      if (!mounted) return;
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(
          builder: (context) => DashboardPage(user: matchedAccount),
        ),
        (route) => false,
      );
    } catch (e) {
      final message = 'Unable to login. ${e.toString()}';
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
      if (AccessibilitySettings.of(context).voiceAssistantEnabled) {
        VoiceAssistantService.speak(message);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final accessibility = AccessibilitySettings.of(context);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && accessibility.voiceAssistantEnabled) {
        VoiceAssistantService.speak(
          'Login screen. Username field. Password field. Login button.',
        );
      }
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('Login'),
        actions: const [AccessibilityButton()],
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (accessibility.voiceAssistantEnabled)
                Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.deepPurple.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text(
                    'Voice assistant is enabled for accessibility support.',
                  ),
                ),
              Card(
                elevation: 4,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: SizedBox(
                    width: 360,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'Login',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 24),
                        Semantics(
                          label: 'Username field',
                          hint: 'Enter your username',
                          child: Focus(
                            onFocusChange: (hasFocus) {
                              if (hasFocus &&
                                  accessibility.voiceAssistantEnabled) {
                                VoiceAssistantService.speak(
                                  'Username field. Enter your username.',
                                );
                              }
                            },
                            child: TextField(
                              controller: _usernameController,
                              onChanged: (value) {
                                if (accessibility.voiceAssistantEnabled &&
                                    value.isNotEmpty) {
                                  VoiceAssistantService.speak(
                                    value.substring(value.length - 1),
                                  );
                                }
                              },
                              onTap: () {
                                if (accessibility.voiceAssistantEnabled) {
                                  VoiceAssistantService.speak(
                                    'Username field. Enter your username.',
                                  );
                                }
                              },
                              decoration: const InputDecoration(
                                labelText: 'Username',
                                border: OutlineInputBorder(),
                                prefixIcon: Icon(Icons.person),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                        Semantics(
                          label: 'Password field',
                          hint: 'Enter your password',
                          child: Focus(
                            onFocusChange: (hasFocus) {
                              if (hasFocus &&
                                  accessibility.voiceAssistantEnabled) {
                                VoiceAssistantService.speak(
                                  'Password field. Enter your password.',
                                );
                              }
                            },
                            child: TextField(
                              controller: _passwordController,
                              obscureText: _obscurePassword,
                              onChanged: (value) {
                                if (accessibility.voiceAssistantEnabled &&
                                    value.isNotEmpty) {
                                  VoiceAssistantService.speak(
                                    value.substring(value.length - 1),
                                  );
                                }
                              },
                              onTap: () {
                                if (accessibility.voiceAssistantEnabled) {
                                  VoiceAssistantService.speak(
                                    'Password field. Enter your password.',
                                  );
                                }
                              },
                              decoration: InputDecoration(
                                labelText: 'Password',
                                border: const OutlineInputBorder(),
                                prefixIcon: const Icon(Icons.lock),
                                suffixIcon: IconButton(
                                  icon: Icon(
                                    _obscurePassword
                                        ? Icons.visibility
                                        : Icons.visibility_off,
                                  ),
                                  onPressed: () {
                                    setState(() {
                                      _obscurePassword = !_obscurePassword;
                                    });
                                    if (accessibility.voiceAssistantEnabled) {
                                      VoiceAssistantService.speak(
                                        _obscurePassword
                                            ? 'Password hidden.'
                                            : 'Password visible.',
                                      );
                                    }
                                  },
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                        Semantics(
                          label: 'Login button',
                          button: true,
                          hint: 'Double tap to login',
                          child: Focus(
                            onFocusChange: (hasFocus) {
                              if (hasFocus &&
                                  accessibility.voiceAssistantEnabled) {
                                VoiceAssistantService.speak('Login button');
                              }
                            },
                            child: ElevatedButton(
                              onPressed: () {
                                if (accessibility.voiceAssistantEnabled) {
                                  VoiceAssistantService.speak(
                                    'Login button pressed.',
                                  );
                                }
                                _login();
                              },
                              style: ElevatedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 14,
                                ),
                              ),
                              child: const Text('Login'),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Semantics(
                          label: 'Create account link',
                          button: true,
                          hint: 'Double tap to create an account',
                          child: Focus(
                            onFocusChange: (hasFocus) {
                              if (hasFocus &&
                                  accessibility.voiceAssistantEnabled) {
                                VoiceAssistantService.speak(
                                  'Create account link',
                                );
                              }
                            },
                            child: TextButton(
                              onPressed: () {
                                if (accessibility.voiceAssistantEnabled) {
                                  VoiceAssistantService.speak(
                                    'Create account link pressed.',
                                  );
                                }
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (context) => CreateAccountPage(
                                      onAccountCreated: widget.onAccountCreated,
                                    ),
                                  ),
                                );
                              },
                              child: const Text(
                                "Don't have an account? Create account",
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class CreateAccountPage extends StatefulWidget {
  const CreateAccountPage({super.key, required this.onAccountCreated});

  final ValueChanged<UserAccount> onAccountCreated;

  @override
  State<CreateAccountPage> createState() => _CreateAccountPageState();
}

class _CreateAccountPageState extends State<CreateAccountPage> {
  final List<String> _areas = [
    'Stone Town',
    'Mkokotoni',
    'Bububu',
    'Mwera',
    'Chwaka',
    'Jambiani',
    'Paje',
    'Nungwi',
    'Kizimkazi',
    'Makunduchi',
    'Wete',
    'Koani',
    'Micheweni',
  ];

  final List<String> _doctorNames = [
    'Dr. Amina Hassan',
    'Dr. Salum Juma',
    'Dr. Fatma Khamis',
    'Dr. Omar Ali',
    'Dr. Shida Yusuf',
  ];

  final List<String> _disabilityTypes = [
    'Vision',
    'Hearing',
    'Body Impairment',
    'Down Syndrome',
    'Others',
  ];

  final List<String> _specializationTypes = [
    'Vision',
    'Hearing',
    'Body Impairment',
    'Others',
  ];

  final TextEditingController _firstNameController = TextEditingController();
  final TextEditingController _middleNameController = TextEditingController();
  final TextEditingController _lastNameController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _usernameController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _addressController = TextEditingController();
  final TextEditingController _otherDisabilityController =
      TextEditingController();
  final TextEditingController _otherSpecializationController =
      TextEditingController();

  bool _obscurePassword = true;
  bool _isDoctorForm = false;
  String? _selectedArea;
  String? _selectedDoctor;
  String? _selectedDisabilityType;
  String? _selectedSpecialization;

  @override
  void dispose() {
    _firstNameController.dispose();
    _middleNameController.dispose();
    _lastNameController.dispose();
    _emailController.dispose();
    _usernameController.dispose();
    _passwordController.dispose();
    _addressController.dispose();
    _otherDisabilityController.dispose();
    _otherSpecializationController.dispose();
    super.dispose();
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
    if (AccessibilitySettings.of(context).voiceAssistantEnabled) {
      VoiceAssistantService.speak(message);
    }
  }

  Future<void> _createAccount() async {
    final role = _isDoctorForm ? 'doctor' : 'disabled';
    final username = _usernameController.text.trim();
    final password = _passwordController.text;

    if (username.isEmpty || password.isEmpty) {
      _showMessage('Please enter a username and password.');
      return;
    }

    if (!_isDoctorForm && !_validateDisabledForm()) {
      return;
    }

    if (_isDoctorForm && !_validateDoctorForm()) {
      return;
    }

    try {
      final response = await UserApiService.registerUser(
        username: username,
        password: password,
        role: role,
        firstName: _firstNameController.text.trim(),
        middleName: _middleNameController.text.trim(),
        lastName: _lastNameController.text.trim(),
        email: _emailController.text.trim(),
        area: _selectedArea ?? '',
        registeredDoctor: _selectedDoctor,
        disabilityType: _selectedDisabilityType,
        specialization: _selectedSpecialization,
      );

      final account = UserAccount(
        username: response['username']?.toString() ?? username,
        password: password,
        role: response['role']?.toString() ?? role,
      );

      widget.onAccountCreated(account);
      _showMessage('Account created successfully.');
      if (!mounted) return;
      Navigator.of(context).pop();
    } catch (e) {
      _showMessage('Unable to save account: ${e.toString()}');
    }
  }

  bool _validateDisabledForm() {
    if (_firstNameController.text.trim().isEmpty ||
        _middleNameController.text.trim().isEmpty ||
        _lastNameController.text.trim().isEmpty ||
        _emailController.text.trim().isEmpty ||
        _usernameController.text.trim().isEmpty ||
        _passwordController.text.isEmpty ||
        _selectedArea == null ||
        _selectedDisabilityType == null) {
      _showMessage('Please fill all required fields for Disabled User.');
      return false;
    }

    if (_selectedDisabilityType == 'Others' &&
        _otherDisabilityController.text.trim().isEmpty) {
      _showMessage('Please specify the disability type.');
      return false;
    }

    return true;
  }

  bool _validateDoctorForm() {
    if (_firstNameController.text.trim().isEmpty ||
        _middleNameController.text.trim().isEmpty ||
        _lastNameController.text.trim().isEmpty ||
        _emailController.text.trim().isEmpty ||
        _usernameController.text.trim().isEmpty ||
        _passwordController.text.isEmpty ||
        _selectedArea == null ||
        _selectedSpecialization == null) {
      _showMessage('Please fill all required fields for Doctor.');
      return false;
    }

    if (_selectedSpecialization == 'Others' &&
        _otherSpecializationController.text.trim().isEmpty) {
      _showMessage('Please specify the specialization.');
      return false;
    }

    return true;
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    bool obscureText = false,
    TextInputType? keyboardType,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Semantics(
        label: '$label field',
        hint: 'Enter $label',
        child: Focus(
          onFocusChange: (hasFocus) {
            if (hasFocus &&
                AccessibilitySettings.of(context).voiceAssistantEnabled) {
              VoiceAssistantService.speak('$label field. Enter $label.');
            }
          },
          child: TextField(
            controller: controller,
            keyboardType: keyboardType,
            obscureText: obscureText,
            onChanged: (value) {
              if (AccessibilitySettings.of(context).voiceAssistantEnabled &&
                  value.isNotEmpty) {
                VoiceAssistantService.speak(value.substring(value.length - 1));
              }
            },
            onTap: () {
              if (AccessibilitySettings.of(context).voiceAssistantEnabled) {
                VoiceAssistantService.speak('$label field. Enter $label.');
              }
            },
            decoration: InputDecoration(
              labelText: label,
              border: const OutlineInputBorder(),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDropdown<T>({
    required T? value,
    required List<T> items,
    required String label,
    required ValueChanged<T?> onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Semantics(
        label: '$label dropdown',
        child: DropdownButtonFormField<T>(
          value: value,
          decoration: InputDecoration(
            labelText: label,
            border: const OutlineInputBorder(),
          ),
          items: items.map((item) {
            return DropdownMenuItem<T>(
              value: item,
              child: Text(item.toString()),
            );
          }).toList(),
          onChanged: (selectedValue) {
            if (AccessibilitySettings.of(context).voiceAssistantEnabled) {
              VoiceAssistantService.speak(
                '$label selected: ${selectedValue.toString()}',
              );
            }
            onChanged(selectedValue);
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDoctor = _isDoctorForm;
    final accessibility = AccessibilitySettings.of(context);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && accessibility.voiceAssistantEnabled) {
        VoiceAssistantService.speak(
          'Create account screen. Disabled user option. Doctor option.',
        );
      }
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('Create Account'),
        actions: const [AccessibilityButton()],
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (accessibility.voiceAssistantEnabled)
                Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.deepPurple.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text(
                    'Voice assistant is enabled for accessibility support.',
                  ),
                ),
              Card(
                elevation: 4,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: SizedBox(
                    width: 420,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'Create Account',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 16),
                        Semantics(
                          label: 'Account type selection',
                          child: SegmentedButton<bool>(
                            segments: const [
                              ButtonSegment(
                                value: false,
                                label: Text('Disabled User'),
                              ),
                              ButtonSegment(value: true, label: Text('Doctor')),
                            ],
                            selected: {_isDoctorForm},
                            onSelectionChanged: (Set<bool> selection) {
                              setState(() {
                                _isDoctorForm = selection.first;
                              });
                              if (accessibility.voiceAssistantEnabled) {
                                VoiceAssistantService.speak(
                                  selection.first
                                      ? 'Doctor form selected.'
                                      : 'Disabled user form selected.',
                                );
                              }
                            },
                          ),
                        ),
                        const SizedBox(height: 20),
                        if (!isDoctor) ...[
                          _buildTextField(
                            controller: _firstNameController,
                            label: 'First Name',
                          ),
                          _buildTextField(
                            controller: _middleNameController,
                            label: 'Middle Name',
                          ),
                          _buildTextField(
                            controller: _lastNameController,
                            label: 'Last Name',
                          ),
                          _buildTextField(
                            controller: _emailController,
                            label: 'Email',
                            keyboardType: TextInputType.emailAddress,
                          ),
                          _buildTextField(
                            controller: _usernameController,
                            label: 'Username',
                          ),
                          _buildTextField(
                            controller: _passwordController,
                            label: 'Password',
                            obscureText: _obscurePassword,
                          ),
                          _buildDropdown<String>(
                            value: _selectedArea,
                            items: _areas,
                            label: 'Area in Zanzibar',
                            onChanged: (value) {
                              setState(() => _selectedArea = value);
                            },
                          ),
                          _buildDropdown<String>(
                            value: _selectedDoctor,
                            items: _doctorNames,
                            label: 'Registered Doctor',
                            onChanged: (value) {
                              setState(() => _selectedDoctor = value);
                            },
                          ),
                          _buildDropdown<String>(
                            value: _selectedDisabilityType,
                            items: _disabilityTypes,
                            label: 'Disability Type',
                            onChanged: (value) {
                              setState(() {
                                _selectedDisabilityType = value;
                              });
                            },
                          ),
                          if (_selectedDisabilityType == 'Others')
                            _buildTextField(
                              controller: _otherDisabilityController,
                              label: 'Specify Disability Type',
                            ),
                          const SizedBox(height: 8),
                          Focus(
                            onFocusChange: (hasFocus) {
                              if (hasFocus &&
                                  accessibility.voiceAssistantEnabled) {
                                VoiceAssistantService.speak(
                                  'Create Disabled User Account button',
                                );
                              }
                            },
                            child: ElevatedButton(
                              onPressed: _createAccount,
                              child: const Text('Create Disabled User Account'),
                            ),
                          ),
                        ] else ...[
                          _buildTextField(
                            controller: _firstNameController,
                            label: 'First Name',
                          ),
                          _buildTextField(
                            controller: _middleNameController,
                            label: 'Middle Name',
                          ),
                          _buildTextField(
                            controller: _lastNameController,
                            label: 'Last Name',
                          ),
                          _buildTextField(
                            controller: _emailController,
                            label: 'Email',
                            keyboardType: TextInputType.emailAddress,
                          ),
                          _buildTextField(
                            controller: _usernameController,
                            label: 'Username',
                          ),
                          _buildTextField(
                            controller: _passwordController,
                            label: 'Password',
                            obscureText: _obscurePassword,
                          ),
                          _buildDropdown<String>(
                            value: _selectedArea,
                            items: _areas,
                            label: 'Area in Zanzibar',
                            onChanged: (value) {
                              setState(() => _selectedArea = value);
                            },
                          ),
                          _buildDropdown<String>(
                            value: _selectedSpecialization,
                            items: _specializationTypes,
                            label: 'Specialization',
                            onChanged: (value) {
                              setState(() {
                                _selectedSpecialization = value;
                              });
                            },
                          ),
                          if (_selectedSpecialization == 'Others')
                            _buildTextField(
                              controller: _otherSpecializationController,
                              label: 'Specify Specialization',
                            ),
                          const SizedBox(height: 8),
                          Focus(
                            onFocusChange: (hasFocus) {
                              if (hasFocus &&
                                  accessibility.voiceAssistantEnabled) {
                                VoiceAssistantService.speak(
                                  'Create Doctor Account button',
                                );
                              }
                            },
                            child: ElevatedButton(
                              onPressed: _createAccount,
                              child: const Text('Create Doctor Account'),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
