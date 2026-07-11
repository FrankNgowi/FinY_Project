import 'package:flutter/material.dart';

import 'package:dikonekti/models/emergency_alert.dart';
import 'package:dikonekti/models/user_account.dart';
import 'package:dikonekti/screens/dashboard_page.dart';
import 'package:dikonekti/screens/login_page.dart';
import 'package:dikonekti/widgets/accessibility_settings.dart';

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  bool _voiceAssistantEnabled = false;
  double _textScaleFactor = 1.0;
  final List<UserAccount> _accounts = [];
  final List<EmergencyAlert> _alerts = [];
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

  void _handleAlertSent(EmergencyAlert alert) {
    setState(() {
      _alerts.insert(0, alert);
    });
  }

  void _handleAlertAcknowledged(String alertId) {
    setState(() {
      final alert = _alerts.firstWhere((a) => a.id == alertId);
      alert.acknowledged = true;
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
                alerts: _alerts,
                onLoginSuccess: _handleLoginSuccess,
                onAccountCreated: _handleAccountCreated,
                onAlertSent: _handleAlertSent,
                onAlertAcknowledged: _handleAlertAcknowledged,
              )
            : DashboardPage(
                user: _currentUser!,
                alerts: _alerts,
                onAlertSent: _handleAlertSent,
                onAlertAcknowledged: _handleAlertAcknowledged,
              ),
      ),
    );
  }
}
