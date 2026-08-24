/// Minimal doctor info embedded directly in a disabled user's own profile
/// response, so "My Doctor" never needs a second network call or a local
/// lookup against some other list.
class DoctorSummary {
  DoctorSummary({
    required this.username,
    required this.displayName,
    this.email = '',
    this.area,
    this.specialization,
    this.phoneNumber,
  });

  final String username;
  final String displayName;
  final String email;
  final String? area;
  final String? specialization;
  final String? phoneNumber;

  factory DoctorSummary.fromJson(Map<String, dynamic> json) {
    return DoctorSummary(
      username: json['username'] as String? ?? '',
      displayName:
          json['display_name'] as String? ?? json['username'] as String? ?? '',
      email: json['email'] as String? ?? '',
      area: json['area'] as String?,
      specialization: json['specialization'] as String?,
      phoneNumber: json['phone_number'] as String?,
    );
  }
}

/// A registered user — either a disabled user or a doctor.
///
/// This is now a pure DTO around whatever the Django API returns. There is
/// deliberately no password field: the server never sends one back, and
/// the app authenticates via the JWT in [TokenStorage], not by holding
/// onto credentials.
class UserAccount {
  UserAccount({
    required this.username,
    required this.role,
    this.firstName = '',
    this.middleName = '',
    this.lastName = '',
    this.email = '',
    this.phoneNumber,
    this.area,
    this.disabilityType,
    this.specialization,
    this.registeredDoctor,
  });

  final String username;

  /// 'doctor' or 'disabled'.
  final String role;

  final String firstName;
  final String middleName;
  final String lastName;
  final String email;
  final String? phoneNumber;
  final String? area;

  /// Only meaningful when [role] is a disabled user.
  final String? disabilityType;

  /// Only meaningful when [role] is 'doctor'.
  final String? specialization;

  /// Only meaningful when [role] is a disabled user. Null if they haven't
  /// registered with a doctor yet.
  final DoctorSummary? registeredDoctor;

  bool get isDoctor => role.toLowerCase() == 'doctor';

  String get fullName {
    final parts = [
      firstName,
      middleName,
      lastName,
    ].where((part) => part.trim().isNotEmpty);
    return parts.isEmpty ? username : parts.join(' ');
  }

  String get displayName {
    if (!isDoctor) return fullName;
    return fullName.toLowerCase().startsWith('dr') ? fullName : 'Dr. $fullName';
  }

  String get resolvedDisabilityType => disabilityType ?? 'Not specified';

  String get resolvedSpecialization => specialization ?? 'General Practice';

  factory UserAccount.fromJson(Map<String, dynamic> json) {
    return UserAccount(
      username: json['username'] as String? ?? '',
      role: json['role'] as String? ?? 'disabled',
      firstName: json['first_name'] as String? ?? '',
      middleName: json['middle_name'] as String? ?? '',
      lastName: json['last_name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      phoneNumber: json['phone_number'] as String?,
      area: json['area'] as String?,
      disabilityType: json['disability_type'] as String?,
      specialization: json['specialization'] as String?,
      registeredDoctor: json['registered_doctor'] != null
          ? DoctorSummary.fromJson(json['registered_doctor'] as Map<String, dynamic>)
          : null,
    );
  }
}