import 'package:flutter/material.dart';

import 'package:dikonekti/models/user_account.dart';

import 'dashboard_components.dart';

class DashboardPage extends StatelessWidget {
  const DashboardPage({
    super.key,
    required this.user,
    required this.onLogout,
  });

  final UserAccount user;
  final VoidCallback onLogout;

  bool get _isDoctor => user.role.toLowerCase() == 'doctor';

  @override
  Widget build(BuildContext context) {
    return _isDoctor
        ? DoctorDashboard(user: user, onLogout: onLogout)
        : DisabledUserDashboard(user: user, onLogout: onLogout);
  }
}