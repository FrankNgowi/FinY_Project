import 'package:flutter/material.dart';

import 'package:dikonekti/models/user_account.dart';
import 'package:dikonekti/screens/dashboard_page.dart';
import 'package:dikonekti/services/api_client.dart';
import 'package:dikonekti/services/user_api_service.dart';
import 'package:dikonekti/widgets/accessibility_settings.dart';
import 'package:dikonekti/widgets/voice_assistant_service.dart';

class CreateAccountPage extends StatefulWidget {
  const CreateAccountPage({super.key});

  @override
  State<CreateAccountPage> createState() => _CreateAccountPageState();
}

class _CreateAccountPageState extends State<CreateAccountPage> {
  final List<String> _areas = [
    'Stone Town',
    'Mkokotoni',
    'Bububu',
    'Mwera',
    'Chwaka',
    'Jambiani',
    'Paje',
    'Nungwi',
    'Kizimkazi',
    'Makunduchi',
    'Wete',
    'Koani',
    'Micheweni',
  ];

  final List<String> _disabilityTypes = [
    'Vision',
    'Hearing',
    'Body Impairment',
    'Down Syndrome',
    'Others',
  ];

  final List<String> _specializationTypes = [
    'Vision',
    'Hearing',
    'Body Impairment',
    'Others',
  ];

  final TextEditingController _firstNameController = TextEditingController();
  final TextEditingController _middleNameController = TextEditingController();
  final TextEditingController _lastNameController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _usernameController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _addressController = TextEditingController();
  final TextEditingController _otherDisabilityController =
      TextEditingController();
  final TextEditingController _otherSpecializationController =
      TextEditingController();

  bool _obscurePassword = true;
  bool _isDoctorForm = false;
  bool _isSubmitting = false;
  bool _hasAnnouncedScreen = false;
  bool _isLoadingDoctors = true;
  String? _doctorLoadError;
  List<UserAccount> _availableDoctors = [];
  String? _selectedArea;
  UserAccount? _selectedDoctor;
  String? _selectedDisabilityType;
  String? _selectedSpecialization;

  Color get _accentColor =>
      _isDoctorForm ? const Color(0xFF1D3557) : const Color(0xFF6750A4);

  @override
  void initState() {
    super.initState();
    _loadDoctors();
  }

  /// Fetches the real, currently-registered doctors from the backend —
  /// this replaces the old hardcoded name list and the in-memory account
  /// list this screen used to require as a constructor param.
  Future<void> _loadDoctors() async {
    try {
      final doctors = await UserApiService.getAllDoctors();
      if (!mounted) return;
      setState(() {
        _availableDoctors = doctors;
        _isLoadingDoctors = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _doctorLoadError = e is ApiException
            ? e.message
            : 'Could not load the list of doctors right now.';
        _isLoadingDoctors = false;
      });
    }
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _middleNameController.dispose();
    _lastNameController.dispose();
    _emailController.dispose();
    _usernameController.dispose();
    _passwordController.dispose();
    _addressController.dispose();
    _otherDisabilityController.dispose();
    _otherSpecializationController.dispose();
    super.dispose();
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
    if (AccessibilitySettings.of(context).voiceAssistantEnabled) {
      VoiceAssistantService.speak(message);
    }
  }

  static final RegExp _usernamePattern = RegExp(r'^[a-zA-Z0-9_.]{4,20}$');
  static final RegExp _emailPattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

  /// Returns an error message for the current username/password, or null
  /// if they're valid. Shared between both account types.
  String? _validateCredentials(String username, String password) {
    if (username.isEmpty || password.isEmpty) {
      return 'Please enter a username and password.';
    }
    if (!_usernamePattern.hasMatch(username)) {
      return 'Username must be 4-20 characters and contain only letters, '
          'numbers, underscores, or periods (no spaces).';
    }
    if (password.length < 6) {
      return 'Password must be at least 6 characters long.';
    }
    return null;
  }

  Future<void> _createAccount() async {
    final role = _isDoctorForm ? 'doctor' : 'disabled';
    final username = _usernameController.text.trim();
    final password = _passwordController.text;

    final credentialError = _validateCredentials(username, password);
    if (credentialError != null) {
      _showMessage(credentialError);
      return;
    }

    final email = _emailController.text.trim();
    if (email.isNotEmpty && !_emailPattern.hasMatch(email)) {
      _showMessage('Please enter a valid email address.');
      return;
    }

    if (!_isDoctorForm && !_validateDisabledForm()) {
      return;
    }

    if (_isDoctorForm && !_validateDoctorForm()) {
      return;
    }

    // The API stores disability type / specialization as a single flat
    // field — there's no separate "other" column. So if "Others" was
    // picked, fold the free-text detail directly into the value we send
    // instead of sending the literal word "Others".
    final resolvedDisabilityType = _isDoctorForm
        ? null
        : (_selectedDisabilityType == 'Others'
            ? _otherDisabilityController.text.trim()
            : _selectedDisabilityType);
    final resolvedSpecialization = _isDoctorForm
        ? (_selectedSpecialization == 'Others'
            ? _otherSpecializationController.text.trim()
            : _selectedSpecialization)
        : null;

    setState(() => _isSubmitting = true);

    try {
      final account = await UserApiService.registerUser(
        username: username,
        password: password,
        role: role,
        firstName: _firstNameController.text.trim(),
        middleName: _middleNameController.text.trim(),
        lastName: _lastNameController.text.trim(),
        email: email,
        area: _selectedArea ?? '',
        registeredDoctorUsername:
            _isDoctorForm ? null : _selectedDoctor?.username,
        disabilityType: resolvedDisabilityType,
        specialization: resolvedSpecialization,
      );

      _showMessage('Account created successfully.');
      if (!mounted) return;

      // Registration already returns a token pair — the account is
      // effectively logged in server-side already — so go straight to the
      // dashboard instead of sending the person back to re-type their
      // credentials on the login screen.
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (context) => DashboardPage(user: account)),
        (route) => false,
      );
    } catch (e) {
      final message = e is ApiException
          ? e.message
          : 'Unable to save account. Please check your connection and try again.';
      _showMessage(message);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  bool _validateDisabledForm() {
    if (_firstNameController.text.trim().isEmpty ||
        _middleNameController.text.trim().isEmpty ||
        _lastNameController.text.trim().isEmpty ||
        _emailController.text.trim().isEmpty ||
        _usernameController.text.trim().isEmpty ||
        _passwordController.text.isEmpty ||
        _selectedArea == null ||
        _selectedDisabilityType == null) {
      _showMessage('Please fill all required fields for Disabled User.');
      return false;
    }

    // Only require a doctor selection if there's actually a doctor to pick
    // — otherwise a brand-new deployment with zero doctors would
    // permanently block disabled users from signing up at all.
    if (_availableDoctors.isNotEmpty && _selectedDoctor == null) {
      _showMessage('Please select your registered doctor.');
      return false;
    }

    if (_selectedDisabilityType == 'Others' &&
        _otherDisabilityController.text.trim().isEmpty) {
      _showMessage('Please specify the disability type.');
      return false;
    }

    return true;
  }

  bool _validateDoctorForm() {
    if (_firstNameController.text.trim().isEmpty ||
        _middleNameController.text.trim().isEmpty ||
        _lastNameController.text.trim().isEmpty ||
        _emailController.text.trim().isEmpty ||
        _usernameController.text.trim().isEmpty ||
        _passwordController.text.isEmpty ||
        _selectedArea == null ||
        _selectedSpecialization == null) {
      _showMessage('Please fill all required fields for Doctor.');
      return false;
    }

    if (_selectedSpecialization == 'Others' &&
        _otherSpecializationController.text.trim().isEmpty) {
      _showMessage('Please specify the specialization.');
      return false;
    }

    return true;
  }

  Widget _sectionHeader(String title, IconData icon) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12, top: 4),
      child: Row(
        children: [
          Icon(icon, size: 18, color: _accentColor),
          const SizedBox(width: 8),
          Text(
            title,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: _accentColor,
              letterSpacing: 0.2,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    bool obscureText = false,
    TextInputType? keyboardType,
    Widget? suffixIcon,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Semantics(
        label: '$label field',
        hint: 'Enter $label',
        child: Focus(
          onFocusChange: (hasFocus) {
            if (hasFocus &&
                AccessibilitySettings.of(context).voiceAssistantEnabled) {
              VoiceAssistantService.speak('$label field. Enter $label.');
            }
          },
          child: TextField(
            controller: controller,
            keyboardType: keyboardType,
            obscureText: obscureText,
            onChanged: (value) {
              if (AccessibilitySettings.of(context).voiceAssistantEnabled &&
                  value.isNotEmpty) {
                VoiceAssistantService.speak(value.substring(value.length - 1));
              }
            },
            onTap: () {
              if (AccessibilitySettings.of(context).voiceAssistantEnabled) {
                VoiceAssistantService.speak('$label field. Enter $label.');
              }
            },
            decoration: InputDecoration(
              labelText: label,
              filled: true,
              fillColor: const Color(0xFFF7F7FA),
              prefixIcon: Icon(icon, color: _accentColor),
              suffixIcon: suffixIcon,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide.none,
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide(color: _accentColor, width: 1.6),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDropdown<T>({
    required T? value,
    required List<T> items,
    required String label,
    required IconData icon,
    required ValueChanged<T?> onChanged,
    String Function(T)? itemLabelBuilder,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Semantics(
        label: '$label dropdown',
        child: DropdownButtonFormField<T>(
          initialValue: value,
          isExpanded: true,
          decoration: InputDecoration(
            labelText: label,
            filled: true,
            fillColor: const Color(0xFFF7F7FA),
            prefixIcon: Icon(icon, color: _accentColor),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide(color: _accentColor, width: 1.6),
            ),
          ),
          items: items.map((item) {
            return DropdownMenuItem<T>(
              value: item,
              child: Text(
                itemLabelBuilder?.call(item) ?? item.toString(),
                overflow: TextOverflow.ellipsis,
              ),
            );
          }).toList(),
          onChanged: (selectedValue) {
            if (AccessibilitySettings.of(context).voiceAssistantEnabled &&
                selectedValue != null) {
              VoiceAssistantService.speak(
                '$label selected: ${itemLabelBuilder?.call(selectedValue) ?? selectedValue.toString()}',
              );
            }
            onChanged(selectedValue);
          },
        ),
      ),
    );
  }

  Widget _buildDoctorField() {
    if (_isLoadingDoctors) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: Row(
          children: [
            const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            const SizedBox(width: 10),
            Text(
              'Loading registered doctors…',
              style: TextStyle(fontSize: 12.5, color: Colors.grey.shade600),
            ),
          ],
        ),
      );
    }

    if (_doctorLoadError != null) {
      return Container(
        margin: const EdgeInsets.only(bottom: 14),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFFFFF4E5),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(
              Icons.wifi_off_rounded,
              size: 18,
              color: Colors.orange.shade800,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Could not load doctors ($_doctorLoadError). You can still '
                'create your account and add a doctor later from your '
                'profile.',
                style: TextStyle(fontSize: 12.5, color: Colors.orange.shade900),
              ),
            ),
          ],
        ),
      );
    }

    if (_availableDoctors.isEmpty) {
      return Container(
        margin: const EdgeInsets.only(bottom: 14),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFFFFF4E5),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(
              Icons.info_outline_rounded,
              size: 18,
              color: Colors.orange.shade800,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'No doctors have registered yet. You can still create your '
                'account and add a doctor later from your profile.',
                style: TextStyle(fontSize: 12.5, color: Colors.orange.shade900),
              ),
            ),
          ],
        ),
      );
    }

    return _buildDropdown<UserAccount>(
      value: _selectedDoctor,
      items: _availableDoctors,
      label: 'Registered Doctor',
      icon: Icons.medical_services_outlined,
      itemLabelBuilder: (doctor) =>
          '${doctor.displayName} · ${doctor.resolvedSpecialization}',
      onChanged: (value) {
        setState(() => _selectedDoctor = value);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDoctor = _isDoctorForm;
    final accessibility = AccessibilitySettings.of(context);

    // Announce the screen once, not on every rebuild, and let it queue
    // behind anything already speaking instead of cutting it off.
    if (!_hasAnnouncedScreen && accessibility.voiceAssistantEnabled) {
      _hasAnnouncedScreen = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        VoiceAssistantService.speak(
          'Create account screen. Disabled user option. Doctor option.',
          interrupt: false,
        );
      });
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF5F3FB),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text('Create Account'),
        actions: const [AccessibilityButton()],
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
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
                      child: const Row(
                        children: [
                          Icon(
                            Icons.record_voice_over_rounded,
                            size: 18,
                            color: Color(0xFF6750A4),
                          ),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Voice assistant is enabled for accessibility support.',
                              style: TextStyle(fontSize: 13),
                            ),
                          ),
                        ],
                      ),
                    ),
                  Card(
                    elevation: 0,
                    color: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(22, 26, 22, 22),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Container(
                            width: 56,
                            height: 56,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: _accentColor.withOpacity(0.12),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              Icons.person_add_alt_1_rounded,
                              color: _accentColor,
                              size: 26,
                            ),
                          ),
                          const SizedBox(height: 14),
                          const Text(
                            'Create Your Account',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF2D2150),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Tell us a bit about yourself to get started.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 14,
                              color: Colors.grey.shade600,
                            ),
                          ),
                          const SizedBox(height: 22),
                          Semantics(
                            label: 'Account type selection',
                            child: Container(
                              padding: const EdgeInsets.all(4),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF0EEF8),
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: SegmentedButton<bool>(
                                style: SegmentedButton.styleFrom(
                                  backgroundColor: Colors.transparent,
                                  selectedBackgroundColor: _accentColor,
                                  selectedForegroundColor: Colors.white,
                                  side: BorderSide.none,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                ),
                                segments: const [
                                  ButtonSegment(
                                    value: false,
                                    label: Text('Disabled User'),
                                    icon: Icon(Icons.accessibility_new_rounded),
                                  ),
                                  ButtonSegment(
                                    value: true,
                                    label: Text('Doctor'),
                                    icon: Icon(Icons.medical_services_rounded),
                                  ),
                                ],
                                selected: {_isDoctorForm},
                                onSelectionChanged: (Set<bool> selection) {
                                  setState(() {
                                    _isDoctorForm = selection.first;
                                  });
                                  if (accessibility.voiceAssistantEnabled) {
                                    VoiceAssistantService.speak(
                                      selection.first
                                          ? 'Doctor form selected.'
                                          : 'Disabled user form selected.',
                                    );
                                  }
                                },
                              ),
                            ),
                          ),
                          const SizedBox(height: 22),
                          _sectionHeader(
                            'Personal Information',
                            Icons.badge_outlined,
                          ),
                          _buildTextField(
                            controller: _firstNameController,
                            label: 'First Name',
                            icon: Icons.person_outline_rounded,
                          ),
                          _buildTextField(
                            controller: _middleNameController,
                            label: 'Middle Name',
                            icon: Icons.person_outline_rounded,
                          ),
                          _buildTextField(
                            controller: _lastNameController,
                            label: 'Last Name',
                            icon: Icons.person_outline_rounded,
                          ),
                          _buildTextField(
                            controller: _emailController,
                            label: 'Email',
                            icon: Icons.email_outlined,
                            keyboardType: TextInputType.emailAddress,
                          ),
                          _sectionHeader(
                            'Account Security',
                            Icons.lock_outline_rounded,
                          ),
                          _buildTextField(
                            controller: _usernameController,
                            label: 'Username',
                            icon: Icons.alternate_email_rounded,
                          ),
                          _buildTextField(
                            controller: _passwordController,
                            label: 'Password',
                            icon: Icons.lock_outline_rounded,
                            obscureText: _obscurePassword,
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
                              },
                            ),
                          ),
                          if (!isDoctor) ...[
                            _sectionHeader(
                              'Location & Care',
                              Icons.location_on_outlined,
                            ),
                            _buildDropdown<String>(
                              value: _selectedArea,
                              items: _areas,
                              label: 'Area in Zanzibar',
                              icon: Icons.map_outlined,
                              onChanged: (value) {
                                setState(() => _selectedArea = value);
                              },
                            ),
                            _buildDoctorField(),
                            _buildDropdown<String>(
                              value: _selectedDisabilityType,
                              items: _disabilityTypes,
                              label: 'Disability Type',
                              icon: Icons.accessibility_new_rounded,
                              onChanged: (value) {
                                setState(() {
                                  _selectedDisabilityType = value;
                                });
                              },
                            ),
                            if (_selectedDisabilityType == 'Others')
                              _buildTextField(
                                controller: _otherDisabilityController,
                                label: 'Specify Disability Type',
                                icon: Icons.edit_outlined,
                              ),
                            const SizedBox(height: 10),
                            _buildSubmitButton(
                              accessibility,
                              'Create Disabled User Account',
                              Icons.accessibility_new_rounded,
                            ),
                          ] else ...[
                            _sectionHeader(
                              'Practice Details',
                              Icons.local_hospital_outlined,
                            ),
                            _buildDropdown<String>(
                              value: _selectedArea,
                              items: _areas,
                              label: 'Area in Zanzibar',
                              icon: Icons.map_outlined,
                              onChanged: (value) {
                                setState(() => _selectedArea = value);
                              },
                            ),
                            _buildDropdown<String>(
                              value: _selectedSpecialization,
                              items: _specializationTypes,
                              label: 'Specialization',
                              icon: Icons.medical_information_outlined,
                              onChanged: (value) {
                                setState(() {
                                  _selectedSpecialization = value;
                                });
                              },
                            ),
                            if (_selectedSpecialization == 'Others')
                              _buildTextField(
                                controller: _otherSpecializationController,
                                label: 'Specify Specialization',
                                icon: Icons.edit_outlined,
                              ),
                            const SizedBox(height: 10),
                            _buildSubmitButton(
                              accessibility,
                              'Create Doctor Account',
                              Icons.medical_services_rounded,
                            ),
                          ],
                        ],
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
    );
  }

  Widget _buildSubmitButton(
    AccessibilitySettings accessibility,
    String label,
    IconData icon,
  ) {
    return Semantics(
      label: '$label button',
      button: true,
      child: Focus(
        onFocusChange: (hasFocus) {
          if (hasFocus && accessibility.voiceAssistantEnabled) {
            VoiceAssistantService.speak('$label button');
          }
        },
        child: SizedBox(
          height: 52,
          child: ElevatedButton.icon(
            onPressed: _isSubmitting
                ? null
                : () {
                    if (accessibility.voiceAssistantEnabled) {
                      VoiceAssistantService.speak('$label button pressed.');
                    }
                    _createAccount();
                  },
            style: ElevatedButton.styleFrom(
              backgroundColor: _accentColor,
              foregroundColor: Colors.white,
              elevation: 2,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            icon: _isSubmitting
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.2,
                      valueColor: AlwaysStoppedAnimation(Colors.white),
                    ),
                  )
                : Icon(icon, size: 20),
            label: Text(
              label,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
            ),
          ),
        ),
      ),
    );
  }
}