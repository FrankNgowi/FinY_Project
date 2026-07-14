import 'package:flutter/material.dart';

import 'package:dikonekti/models/emergency_alert.dart';
import 'package:dikonekti/models/user_account.dart';

import 'dashboard_components.dart';

class DashboardPage extends StatelessWidget {
  const DashboardPage({
    super.key,
    required this.user,
    required this.allAccounts,
    required this.alerts,
    required this.onAlertSent,
    required this.onAlertAcknowledged,
  });

  final UserAccount user;

  /// Every registered account (both doctors and disabled users), so each
  /// dashboard can resolve the doctor <-> patient relationship.
  final List<UserAccount> allAccounts;
  final List<EmergencyAlert> alerts;
  final ValueChanged<EmergencyAlert> onAlertSent;
  final ValueChanged<String> onAlertAcknowledged;

  bool get _isDoctor => user.role.toLowerCase() == 'doctor';

  @override
  Widget build(BuildContext context) {
    return _isDoctor
        ? DoctorDashboard(
            user: user,
            alerts: alerts,
            allAccounts: allAccounts,
            onAlertAcknowledged: onAlertAcknowledged,
          )
        : DisabledUserDashboard(
            user: user,
            allAccounts: allAccounts,
            onAlertSent: onAlertSent,
          );
  }
}