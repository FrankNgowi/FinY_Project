/// A registered user — either a disabled user or a doctor.
///
/// Both roles share this model so the app can keep a single in-memory list
/// of accounts and look people up across roles (e.g. a disabled user's
/// registered doctor, or a doctor's list of patients).
class UserAccount {
  UserAccount({
    required this.username,
    required this.password,
    required this.role,
    this.firstName = '',
    this.middleName = '',
    this.lastName = '',
    this.email = '',
    this.area,
    this.disabilityType,
    this.otherDisabilityDetail,
    this.registeredDoctorUsername,
    this.specialization,
    this.otherSpecializationDetail,
  });

  final String username;
  final String password;

  /// 'doctor' or 'disabled'.
  final String role;

  final String firstName;
  final String middleName;
  final String lastName;
  final String email;
  final String? area;

  /// Only meaningful when [role] is a disabled user.
  final String? disabilityType;
  final String? otherDisabilityDetail;

  /// The `username` of the doctor this disabled user registered with.
  /// Only meaningful when [role] is a disabled user. This is what links a
  /// patient to a specific doctor's dashboard and alert feed.
  final String? registeredDoctorUsername;

  /// Only meaningful when [role] is 'doctor'.
  final String? specialization;
  final String? otherSpecializationDetail;

  bool get isDoctor => role.toLowerCase() == 'doctor';

  String get fullName {
    final parts = [
      firstName,
      middleName,
      lastName,
    ].where((part) => part.trim().isNotEmpty);
    return parts.isEmpty ? username : parts.join(' ');
  }

  /// Name for display, prefixed with "Dr." for doctors if not already
  /// present (registration data may or may not include the title).
  String get displayName {
    if (!isDoctor) return fullName;
    return fullName.toLowerCase().startsWith('dr') ? fullName : 'Dr. $fullName';
  }

  /// Human-readable disability description, resolving "Others" to the
  /// free-text detail the user entered at registration.
  String get resolvedDisabilityType {
    if (disabilityType == null) return 'Not specified';
    if (disabilityType == 'Others' &&
        (otherDisabilityDetail?.trim().isNotEmpty ?? false)) {
      return otherDisabilityDetail!.trim();
    }
    return disabilityType!;
  }

  /// Human-readable specialization, resolving "Others" the same way.
  String get resolvedSpecialization {
    if (specialization == null) return 'General Practice';
    if (specialization == 'Others' &&
        (otherSpecializationDetail?.trim().isNotEmpty ?? false)) {
      return otherSpecializationDetail!.trim();
    }
    return specialization!;
  }

  UserAccount copyWith({
    String? username,
    String? password,
    String? role,
    String? firstName,
    String? middleName,
    String? lastName,
    String? email,
    String? area,
    String? disabilityType,
    String? otherDisabilityDetail,
    String? registeredDoctorUsername,
    String? specialization,
    String? otherSpecializationDetail,
  }) {
    return UserAccount(
      username: username ?? this.username,
      password: password ?? this.password,
      role: role ?? this.role,
      firstName: firstName ?? this.firstName,
      middleName: middleName ?? this.middleName,
      lastName: lastName ?? this.lastName,
      email: email ?? this.email,
      area: area ?? this.area,
      disabilityType: disabilityType ?? this.disabilityType,
      otherDisabilityDetail: otherDisabilityDetail ?? this.otherDisabilityDetail,
      registeredDoctorUsername:
          registeredDoctorUsername ?? this.registeredDoctorUsername,
      specialization: specialization ?? this.specialization,
      otherSpecializationDetail:
          otherSpecializationDetail ?? this.otherSpecializationDetail,
    );
  }

  /// Serializes this account for local storage.
  ///
  /// NOTE: this stores the password in plain text, which is fine for this
  /// offline demo but is not something to ship in a real app — a real
  /// backend should hash passwords server-side and this local cache
  /// shouldn't need to hold one at all.
  Map<String, dynamic> toJson() {
    return {
      'username': username,
      'password': password,
      'role': role,
      'firstName': firstName,
      'middleName': middleName,
      'lastName': lastName,
      'email': email,
      'area': area,
      'disabilityType': disabilityType,
      'otherDisabilityDetail': otherDisabilityDetail,
      'registeredDoctorUsername': registeredDoctorUsername,
      'specialization': specialization,
      'otherSpecializationDetail': otherSpecializationDetail,
    };
  }

  factory UserAccount.fromJson(Map<String, dynamic> json) {
    return UserAccount(
      username: json['username'] as String? ?? '',
      password: json['password'] as String? ?? '',
      role: json['role'] as String? ?? 'disabled',
      firstName: json['firstName'] as String? ?? '',
      middleName: json['middleName'] as String? ?? '',
      lastName: json['lastName'] as String? ?? '',
      email: json['email'] as String? ?? '',
      area: json['area'] as String?,
      disabilityType: json['disabilityType'] as String?,
      otherDisabilityDetail: json['otherDisabilityDetail'] as String?,
      registeredDoctorUsername: json['registeredDoctorUsername'] as String?,
      specialization: json['specialization'] as String?,
      otherSpecializationDetail: json['otherSpecializationDetail'] as String?,
    );
  }
}