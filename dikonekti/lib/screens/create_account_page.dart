import 'package:flutter/material.dart';

import 'package:dikonekti/models/user_account.dart';
import 'package:dikonekti/services/api_client.dart';
import 'package:dikonekti/services/user_api_service.dart';
import 'package:dikonekti/widgets/accessibility_settings.dart';
import 'package:dikonekti/widgets/voice_assistant_service.dart';

class CreateAccountPage extends StatefulWidget {
  const CreateAccountPage({super.key, required this.onLoginSuccess});

  /// Called after a successful registration — the account is already
  /// logged in server-side (registration returns a token pair), so this
  /// is the same callback LoginPage uses. MyApp's reactive home: swap
  /// then takes care of showing the dashboard; this page just pops
  /// itself off the stack to reveal it.
  final ValueChanged<UserAccount> onLoginSuccess;

  @override
  State<CreateAccountPage> createState() => _CreateAccountPageState();
}

class _CreateAccountPageState extends State<CreateAccountPage> {
  final _formKey = GlobalKey<FormState>();

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
    'Chukwani',
    'Kibweni',
    'Airport',
    'Buyu',
    'Fumba',
    'Kibweni',
    'Mtoni',
    'Mtoni Kijichi',
    'Tunguu',
    'jumbi',
    'Kiwengwa',
    'Others',

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
  final TextEditingController _phoneController = TextEditingController();
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

  static final RegExp _usernamePattern = RegExp(r'^[a-zA-Z0-9_.]{4,20}$');
  static final RegExp _emailPattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');
  static final RegExp _phonePattern = RegExp(r'^[0-9+\-\s]{7,15}$');

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
    _phoneController.dispose();
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

  Future<void> _createAccount() async {
    // Runs every field's validator at once — every invalid field shows
    // its own inline error simultaneously, instead of one snackbar at a
    // time only ever mentioning the first problem found.
    if (!_formKey.currentState!.validate()) {
      _showMessage('Please fix the highlighted fields.');
      return;
    }

    // Only require a doctor selection if there's actually a doctor to
    // pick — otherwise a brand-new deployment with zero doctors would
    // permanently block disabled users from signing up at all. This one
    // check doesn't map cleanly onto a single field's validator since
    // "required" depends on data loaded asynchronously from the server.
    if (!_isDoctorForm &&
        _availableDoctors.isNotEmpty &&
        _selectedDoctor == null) {
      _showMessage('Please select your registered doctor.');
      return;
    }

    final role = _isDoctorForm ? 'doctor' : 'disabled';
    final username = _usernameController.text.trim();
    final password = _passwordController.text;
    final email = _emailController.text.trim();
    final phone = _phoneController.text.trim();

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
        phoneNumber: phone,
        area: _selectedArea ?? '',
        registeredDoctorUsername:
            _isDoctorForm ? null : _selectedDoctor?.username,
        disabilityType: resolvedDisabilityType,
        specialization: resolvedSpecialization,
      );

      _showMessage('Account created successfully.');
      if (!mounted) return;

      // Registration already returns a token pair — the account is
      // already logged in server-side. Report that up via the same
      // callback LoginPage uses (which updates MyApp's _currentUser and
      // reactively swaps home: to DashboardPage), then just pop this
      // page off the stack to reveal it underneath. Deliberately NOT
      // doing our own Navigator.push here: an explicit push would create
      // a second, disconnected DashboardPage instance that never
      // reflects later state changes — which is exactly what previously
      // made the logout button stop working after registering a new
      // account.
      widget.onLoginSuccess(account);
      Navigator.of(context).pop();
    } catch (e) {
      final message = e is ApiException
          ? e.message
          : 'Unable to save account. Please check your connection and try again.';
      _showMessage(message);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
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
    String? Function(String?)? validator,
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
          child: TextFormField(
            controller: controller,
            keyboardType: keyboardType,
            obscureText: obscureText,
            validator: validator,
            autovalidateMode: AutovalidateMode.onUserInteraction,
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
              errorBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: Colors.redAccent, width: 1.4),
              ),
              focusedErrorBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: Colors.redAccent, width: 1.6),
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
    String? Function(T?)? validator,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Semantics(
        label: '$label dropdown',
        child: DropdownButtonFormField<T>(
          value: value,
          isExpanded: true,
          validator: validator,
          autovalidateMode: AutovalidateMode.onUserInteraction,
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
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Colors.redAccent, width: 1.4),
            ),
            focusedErrorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Colors.redAccent, width: 1.6),
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
                      child: Form(
                        key: _formKey,
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
                                      icon:
                                          Icon(Icons.accessibility_new_rounded),
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
                              validator: (value) =>
                                  (value == null || value.trim().isEmpty)
                                      ? 'Please enter your first name.'
                                      : null,
                            ),
                            _buildTextField(
                              controller: _middleNameController,
                              label: 'Middle Name',
                              icon: Icons.person_outline_rounded,
                              validator: (value) =>
                                  (value == null || value.trim().isEmpty)
                                      ? 'Please enter your middle name.'
                                      : null,
                            ),
                            _buildTextField(
                              controller: _lastNameController,
                              label: 'Last Name',
                              icon: Icons.person_outline_rounded,
                              validator: (value) =>
                                  (value == null || value.trim().isEmpty)
                                      ? 'Please enter your last name.'
                                      : null,
                            ),
                            _buildTextField(
                              controller: _emailController,
                              label: 'Email',
                              icon: Icons.email_outlined,
                              keyboardType: TextInputType.emailAddress,
                              validator: (value) {
                                final v = value?.trim() ?? '';
                                if (v.isEmpty) {
                                  return 'Please enter your email address.';
                                }
                                if (!_emailPattern.hasMatch(v)) {
                                  return 'Please enter a valid email address.';
                                }
                                return null;
                              },
                            ),
                            _buildTextField(
                              controller: _phoneController,
                              label: 'Phone Number',
                              icon: Icons.phone_outlined,
                              keyboardType: TextInputType.phone,
                              validator: (value) {
                                final v = value?.trim() ?? '';
                                if (v.isEmpty) {
                                  return 'Please enter a phone number.';
                                }
                                if (!_phonePattern.hasMatch(v)) {
                                  return 'Please enter a valid phone number.';
                                }
                                return null;
                              },
                            ),
                            _sectionHeader(
                              'Account Security',
                              Icons.lock_outline_rounded,
                            ),
                            _buildTextField(
                              controller: _usernameController,
                              label: 'Username',
                              icon: Icons.alternate_email_rounded,
                              validator: (value) {
                                final v = value?.trim() ?? '';
                                if (v.isEmpty) {
                                  return 'Please enter a username.';
                                }
                                if (!_usernamePattern.hasMatch(v)) {
                                  return '4-20 characters: letters, numbers, '
                                      'underscore, or period only (no spaces).';
                                }
                                return null;
                              },
                            ),
                            _buildTextField(
                              controller: _passwordController,
                              label: 'Password',
                              icon: Icons.lock_outline_rounded,
                              obscureText: _obscurePassword,
                              validator: (value) {
                                if (value == null || value.isEmpty) {
                                  return 'Please enter a password.';
                                }
                                if (value.length < 6) {
                                  return 'At least 6 characters.';
                                }
                                return null;
                              },
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
                                validator: (value) => value == null
                                    ? 'Please select an area.'
                                    : null,
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
                                validator: (value) => value == null
                                    ? 'Please select a disability type.'
                                    : null,
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
                                  validator: (value) =>
                                      (value == null || value.trim().isEmpty)
                                          ? 'Please specify the disability '
                                              'type.'
                                          : null,
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
                                validator: (value) => value == null
                                    ? 'Please select an area.'
                                    : null,
                                onChanged: (value) {
                                  setState(() => _selectedArea = value);
                                },
                              ),
                              _buildDropdown<String>(
                                value: _selectedSpecialization,
                                items: _specializationTypes,
                                label: 'Specialization',
                                icon: Icons.medical_information_outlined,
                                validator: (value) => value == null
                                    ? 'Please select a specialization.'
                                    : null,
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
                                  validator: (value) =>
                                      (value == null || value.trim().isEmpty)
                                          ? 'Please specify the '
                                              'specialization.'
                                          : null,
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