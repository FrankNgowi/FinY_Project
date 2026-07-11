import 'package:flutter/material.dart';

import 'package:dikonekti/models/emergency_alert.dart';
import 'package:dikonekti/models/user_account.dart';

import 'dashboard_components.dart';

class DashboardPage extends StatelessWidget {
  const DashboardPage({
    super.key,
    required this.user,
    required this.alerts,
    required this.onAlertSent,
    required this.onAlertAcknowledged,
  });

  final UserAccount user;
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
            onAlertAcknowledged: onAlertAcknowledged,
          )
        : DisabledUserDashboard(user: user, onAlertSent: onAlertSent);
  }
}