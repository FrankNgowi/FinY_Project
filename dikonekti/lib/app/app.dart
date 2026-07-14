import 'package:flutter/material.dart';

import 'package:dikonekti/models/emergency_alert.dart';
import 'package:dikonekti/models/user_account.dart';
import 'package:dikonekti/screens/dashboard_page.dart';
import 'package:dikonekti/screens/login_page.dart';
import 'package:dikonekti/services/alert_api_service.dart';
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
  final List<UserAccount> _accounts = [];
  final List<EmergencyAlert> _alerts = [];
  UserAccount? _currentUser;
  bool _isLoadingInitialData = true;

  @override
  void initState() {
    super.initState();
    _loadPersistedData();
  }

  /// Repopulates in-memory state from local storage on app start.
  ///
  /// Without this, `_accounts` and `_alerts` always start empty, which is
  /// exactly why registered doctors disappeared from "Create Account",
  /// why a disabled user's own saved profile went blank after a fresh
  /// login, and why doctors saw no alerts and no patients after reopening
  /// the app — none of that data was ever actually gone, it just was
  /// never being read back from SQLite.
  Future<void> _loadPersistedData() async {
    try {
      final userRows = await UserApiService.getAllUsers();
      final alerts = await AlertApiService.getAllAlerts();

      if (!mounted) return;
      setState(() {
        _accounts
          ..clear()
          ..addAll(userRows.map(_accountFromRow));
        _alerts
          ..clear()
          ..addAll(alerts);
        _isLoadingInitialData = false;
      });
    } catch (_) {
      // If loading fails for any reason, start with empty state rather
      // than leaving the app stuck on a loading screen forever.
      if (mounted) setState(() => _isLoadingInitialData = false);
    }
  }

  UserAccount _accountFromRow(Map<String, dynamic> row) {
    return UserAccount(
      username: row['username'] as String? ?? '',
      password: row['password'] as String? ?? '',
      role: row['role'] as String? ?? 'disabled',
      firstName: row['firstName'] as String? ?? '',
      middleName: row['middleName'] as String? ?? '',
      lastName: row['lastName'] as String? ?? '',
      email: row['email'] as String? ?? '',
      area: row['area'] as String?,
      disabilityType: row['disabilityType'] as String?,
      otherDisabilityDetail: row['otherDisabilityDetail'] as String?,
      registeredDoctorUsername: row['registeredDoctor'] as String?,
      specialization: row['specialization'] as String?,
      otherSpecializationDetail: row['otherSpecializationDetail'] as String?,
    );
  }

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
    // Best-effort persistence, fired after the alert is already live in the
    // UI so a slow write never delays or blocks an emergency alert.
    AlertApiService.saveAlert(alert);
  }

  void _handleAlertAcknowledged(String alertId) {
    setState(() {
      final alert = _alerts.firstWhere((a) => a.id == alertId);
      alert.acknowledged = true;
    });
    AlertApiService.acknowledgeAlert(alertId);
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
        home: _isLoadingInitialData
            ? const Scaffold(
                body: Center(child: CircularProgressIndicator()),
              )
            : _currentUser == null
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
                    allAccounts: _accounts,
                    alerts: _alerts,
                    onAlertSent: _handleAlertSent,
                    onAlertAcknowledged: _handleAlertAcknowledged,
                  ),
      ),
    );
  }
}