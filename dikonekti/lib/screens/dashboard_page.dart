import 'package:flutter/material.dart';

import 'package:dikonekti/models/user_account.dart';

import 'dashboard_components.dart';
import 'verification_page.dart';

/// Which screen a signed-in user belongs on.
enum DashboardKind { verification, doctor, patient }

/// A doctor whose certificate is not approved (including an unknown or missing
/// status) goes to verification; an approved doctor to the dashboard; everyone
/// else to the Disabled User dashboard, as before.
DashboardKind dashboardKindFor(UserAccount user) {
  if (!user.isDoctor) return DashboardKind.patient;
  return user.needsVerification
      ? DashboardKind.verification
      : DashboardKind.doctor;
}

class DashboardPage extends StatelessWidget {
  const DashboardPage({
    super.key,
    required this.user,
    required this.onLogout,
    required this.onProfileChanged,
  });

  final UserAccount user;
  final VoidCallback onLogout;

  /// Asks the app to read the profile again (for example after the doctor is
  /// approved), so this page can show the screen they now belong on.
  final VoidCallback onProfileChanged;

  @override
  Widget build(BuildContext context) {
    switch (dashboardKindFor(user)) {
      case DashboardKind.verification:
        return VerificationPage(
          user: user,
          onLogout: onLogout,
          onApproved: onProfileChanged,
        );
      case DashboardKind.doctor:
        return DoctorDashboard(user: user, onLogout: onLogout);
      case DashboardKind.patient:
        return DisabledUserDashboard(user: user, onLogout: onLogout);
    }
  }
}
