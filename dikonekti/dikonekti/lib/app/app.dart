import 'package:flutter/material.dart';

import 'package:dikonekti/models/user_account.dart';
import 'package:dikonekti/screens/dashboard_page.dart';
import 'package:dikonekti/screens/login_page.dart';
import 'package:dikonekti/services/token_storage.dart';
import 'package:dikonekti/services/user_api_service.dart';
import 'package:dikonekti/widgets/accessibility_settings.dart';

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  bool _voiceAssistantEnabled = false;
  double _textScaleFactor = 1.0;
  UserAccount? _currentUser;
  bool _isCheckingSession = true;

  @override
  void initState() {
    super.initState();
    _restoreSession();
  }

  /// If a JWT is already stored from a previous login, re-fetch the
  /// current profile from the server rather than making the person log
  /// in again every time the app is closed and reopened.
  Future<void> _restoreSession() async {
    final token = await TokenStorage.getAccessToken();
    if (token == null) {
      if (mounted) setState(() => _isCheckingSession = false);
      return;
    }

    try {
      final profile = await UserApiService.getCurrentProfile();
      if (!mounted) return;
      setState(() {
        _currentUser = profile;
        _isCheckingSession = false;
      });
    } catch (_) {
      await TokenStorage.clear();
      if (mounted) setState(() => _isCheckingSession = false);
    }
  }

  void _handleLoginSuccess(UserAccount account) {
    setState(() => _currentUser = account);
  }

  /// This is what was missing before: DashboardPage's logout button had
  /// nowhere to actually report back to. Clearing the stored token AND
  /// resetting _currentUser to null is what makes `build()` fall back to
  /// showing LoginPage again.
  Future<void> _handleLogout() async {
    await UserApiService.logout();
    if (mounted) setState(() => _currentUser = null);
  }

  @override
  Widget build(BuildContext context) {
    return AccessibilitySettings(
      voiceAssistantEnabled: _voiceAssistantEnabled,
      textScaleFactor: _textScaleFactor,
      setVoiceAssistantEnabled: (value) {
        setState(() => _voiceAssistantEnabled = value);
      },
      setTextScaleFactor: (value) {
        setState(() => _textScaleFactor = value);
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
        home: _isCheckingSession
            ? const Scaffold(
                backgroundColor: Color(0xFFF5F3FB),
                body: Center(
                  child: CircularProgressIndicator(color: Color(0xFF6750A4)),
                ),
              )
            : _currentUser == null
                ? LoginPage(onLoginSuccess: _handleLoginSuccess)
                : DashboardPage(
                    user: _currentUser!,
                    onLogout: _handleLogout,
                  ),
      ),
    );
  }
}