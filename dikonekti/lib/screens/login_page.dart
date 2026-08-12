import 'package:flutter/material.dart';

import 'package:dikonekti/models/user_account.dart';
import 'package:dikonekti/screens/create_account_page.dart';
import 'package:dikonekti/screens/dashboard_page.dart';
import 'package:dikonekti/services/api_client.dart';
import 'package:dikonekti/services/user_api_service.dart';
import 'package:dikonekti/widgets/accessibility_settings.dart';
import 'package:dikonekti/widgets/voice_assistant_service.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key, required this.onLoginSuccess});

  final ValueChanged<UserAccount> onLoginSuccess;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final TextEditingController _usernameController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _obscurePassword = true;
  bool _isLoggingIn = false;
  bool _hasAnnouncedScreen = false;
  DateTime? _lastBackPressAt;

  // Login is the app's root screen, so a single system back press here
  // exits the app — that's normal Android behavior, not a bug. This just
  // adds a friendlier "press back again to exit" confirmation instead of
  // exiting immediately on the first press.
  Future<bool> _handleBackPress() async {
    final now = DateTime.now();
    if (_lastBackPressAt == null ||
        now.difference(_lastBackPressAt!) > const Duration(seconds: 2)) {
      _lastBackPressAt = now;
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Press back again to exit.'),
            duration: Duration(seconds: 2),
          ),
        );
        if (AccessibilitySettings.of(context).voiceAssistantEnabled) {
          VoiceAssistantService.speak('Press back again to exit.');
        }
      }
      return false;
    }
    return true;
  }

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

    setState(() => _isLoggingIn = true);

    try {
      // loginUser now hits the Django backend, stores the JWT pair, and
      // returns the full profile in one call — no more merging in a
      // locally-cached record to recover fields the API didn't send back.
      final account = await UserApiService.loginUser(
        username: username,
        password: password,
      );

      widget.onLoginSuccess(account);

      final welcomeMessage = 'Welcome, ${account.displayName}!';
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(welcomeMessage)));
      if (AccessibilitySettings.of(context).voiceAssistantEnabled) {
        VoiceAssistantService.speak(welcomeMessage);
      }

      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(
          builder: (context) => DashboardPage(user: account, onLogout: () {  },),
        ),
        (route) => false,
      );
    } catch (e) {
      // ApiException.toString() is already the server's own message (e.g.
      // "No active account found with the given credentials") — no need
      // to wrap it in a generic prefix.
      final message = e is ApiException
          ? e.message
          : 'Unable to login. Please check your connection and try again.';
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
      if (AccessibilitySettings.of(context).voiceAssistantEnabled) {
        VoiceAssistantService.speak(message);
      }
    } finally {
      if (mounted) setState(() => _isLoggingIn = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final accessibility = AccessibilitySettings.of(context);

    // Announce the screen layout once — not on every rebuild — and let it
    // queue behind any other announcement already in flight (e.g. the
    // accessibility dialog's own "voice assistant enabled" confirmation)
    // instead of cutting it off.
    if (!_hasAnnouncedScreen && accessibility.voiceAssistantEnabled) {
      _hasAnnouncedScreen = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        VoiceAssistantService.speak(
          'Login screen. Username field. Password field. Login button.',
          interrupt: false,
        );
      });
    }

    return WillPopScope(
      onWillPop: _handleBackPress,
      child: Scaffold(
        backgroundColor: const Color(0xFFF5F3FB),
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          actions: const [AccessibilityButton()],
        ),
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (accessibility.voiceAssistantEnabled)
                      Container(
                        width: double.infinity,
                        margin: const EdgeInsets.only(bottom: 16),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 10,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.deepPurple.shade50,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.record_voice_over_rounded,
                              size: 18,
                              color: Colors.deepPurple.shade400,
                            ),
                            const SizedBox(width: 8),
                            const Expanded(
                              child: Text(
                                'Voice assistant is enabled for accessibility support.',
                                style: TextStyle(fontSize: 13),
                              ),
                            ),
                          ],
                        ),
                      ),
                    const _BrandHeader(),
                    const SizedBox(height: 28),
                    Card(
                      elevation: 0,
                      color: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
                        child: Form(
                          key: _formKey,
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              const Text(
                                'Welcome back',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 24,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF2D2150),
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                'Sign in to continue to your dashboard.',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 14,
                                  color: Colors.grey.shade600,
                                ),
                              ),
                              const SizedBox(height: 26),
                              _buildTextField(
                                controller: _usernameController,
                                label: 'Username',
                                icon: Icons.person_outline_rounded,
                                accessibility: accessibility,
                              ),
                              const SizedBox(height: 16),
                              _buildPasswordField(accessibility),
                              const SizedBox(height: 24),
                              _buildLoginButton(accessibility),
                              const SizedBox(height: 20),
                              _buildDivider(),
                              const SizedBox(height: 16),
                              _buildCreateAccountLink(accessibility),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    required AccessibilitySettings accessibility,
  }) {
    return Semantics(
      label: '$label field',
      hint: 'Enter your $label',
      child: Focus(
        onFocusChange: (hasFocus) {
          if (hasFocus && accessibility.voiceAssistantEnabled) {
            VoiceAssistantService.speak('$label field. Enter your $label.');
          }
        },
        child: TextField(
          controller: controller,
          onChanged: (value) {
            if (accessibility.voiceAssistantEnabled && value.isNotEmpty) {
              VoiceAssistantService.speak(value.substring(value.length - 1));
            }
          },
          onTap: () {
            if (accessibility.voiceAssistantEnabled) {
              VoiceAssistantService.speak('$label field. Enter your $label.');
            }
          },
          decoration: InputDecoration(
            labelText: label,
            filled: true,
            fillColor: const Color(0xFFF7F6FB),
            prefixIcon: Icon(icon, color: const Color(0xFF6750A4)),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(
                color: Color(0xFF6750A4),
                width: 1.6,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPasswordField(AccessibilitySettings accessibility) {
    return Semantics(
      label: 'Password field',
      hint: 'Enter your password',
      child: Focus(
        onFocusChange: (hasFocus) {
          if (hasFocus && accessibility.voiceAssistantEnabled) {
            VoiceAssistantService.speak('Password field. Enter your password.');
          }
        },
        child: TextField(
          controller: _passwordController,
          obscureText: _obscurePassword,
          onChanged: (value) {
            if (accessibility.voiceAssistantEnabled && value.isNotEmpty) {
              VoiceAssistantService.speak(value.substring(value.length - 1));
            }
          },
          onTap: () {
            if (accessibility.voiceAssistantEnabled) {
              VoiceAssistantService.speak(
                'Password field. Enter your password.',
              );
            }
          },
          onSubmitted: (_) => _login(),
          decoration: InputDecoration(
            labelText: 'Password',
            filled: true,
            fillColor: const Color(0xFFF7F6FB),
            prefixIcon: const Icon(
              Icons.lock_outline_rounded,
              color: Color(0xFF6750A4),
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(
                color: Color(0xFF6750A4),
                width: 1.6,
              ),
            ),
            suffixIcon: IconButton(
              icon: Icon(
                _obscurePassword
                    ? Icons.visibility_outlined
                    : Icons.visibility_off_outlined,
                color: Colors.grey.shade600,
              ),
              onPressed: () {
                setState(() {
                  _obscurePassword = !_obscurePassword;
                });
                if (accessibility.voiceAssistantEnabled) {
                  VoiceAssistantService.speak(
                    _obscurePassword ? 'Password hidden.' : 'Password visible.',
                  );
                }
              },
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLoginButton(AccessibilitySettings accessibility) {
    return Semantics(
      label: 'Login button',
      button: true,
      hint: 'Double tap to login',
      child: Focus(
        onFocusChange: (hasFocus) {
          if (hasFocus && accessibility.voiceAssistantEnabled) {
            VoiceAssistantService.speak('Login button');
          }
        },
        child: SizedBox(
          height: 52,
          child: ElevatedButton(
            onPressed: _isLoggingIn
                ? null
                : () {
                    if (accessibility.voiceAssistantEnabled) {
                      VoiceAssistantService.speak('Login button pressed.');
                    }
                    _login();
                  },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF6750A4),
              foregroundColor: Colors.white,
              elevation: 2,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            child: _isLoggingIn
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.4,
                      valueColor: AlwaysStoppedAnimation(Colors.white),
                    ),
                  )
                : const Text(
                    'Login',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                  ),
          ),
        ),
      ),
    );
  }

  Widget _buildDivider() {
    return Row(
      children: [
        Expanded(child: Divider(color: Colors.grey.shade300)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          child: Text(
            'New here?',
            style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
          ),
        ),
        Expanded(child: Divider(color: Colors.grey.shade300)),
      ],
    );
  }

  Widget _buildCreateAccountLink(AccessibilitySettings accessibility) {
    return Semantics(
      label: 'Create account button',
      button: true,
      hint: 'Double tap to create an account',
      child: Focus(
        onFocusChange: (hasFocus) {
          if (hasFocus && accessibility.voiceAssistantEnabled) {
            VoiceAssistantService.speak('Create account button');
          }
        },
        child: SizedBox(
          height: 50,
          child: OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFF6750A4),
              side: const BorderSide(color: Color(0xFF6750A4)),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            onPressed: () {
              if (accessibility.voiceAssistantEnabled) {
                VoiceAssistantService.speak('Create account button pressed.');
              }
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => const CreateAccountPage(),
                ),
              );
            },
            icon: const Icon(Icons.person_add_alt_1_rounded),
            label: const Text(
              'Create an account',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
        ),
      ),
    );
  }
}

class _BrandHeader extends StatelessWidget {
  const _BrandHeader();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF6750A4), Color(0xFF9B7FE8)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF6750A4).withOpacity(0.3),
                blurRadius: 18,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: const Icon(
            Icons.volunteer_activism_rounded,
            color: Colors.white,
            size: 34,
          ),
        ),
        const SizedBox(height: 14),
        const Text(
          'Dikonekti',
          style: TextStyle(
            fontSize: 26,
            fontWeight: FontWeight.bold,
            color: Color(0xFF2D2150),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Care, connected.',
          style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
        ),
      ],
    );
  }
}