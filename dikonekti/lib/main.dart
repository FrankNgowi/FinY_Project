import 'package:flutter/material.dart';
import 'package:flutter_tts/flutter_tts.dart';

void main() {
  runApp(const MyApp());
}

class VoiceAssistantService {
  static final FlutterTts _tts = FlutterTts();
  static bool _initialized = false;

  static Future<void> initialize() async {
    if (_initialized) return;

    await _tts.setLanguage('en-US');
    await _tts.setSpeechRate(0.5);
    await _tts.setVolume(1.0);
    await _tts.setPitch(1.0);
    _initialized = true;
  }

  static Future<void> speak(String text) async {
    if (text.trim().isEmpty) return;
    await initialize();
    await _tts.speak(text);
  }
}

class AccessibilitySettings extends InheritedWidget {
  const AccessibilitySettings({
    super.key,
    required this.voiceAssistantEnabled,
    required this.textScaleFactor,
    required this.setVoiceAssistantEnabled,
    required this.setTextScaleFactor,
    required super.child,
  });

  final bool voiceAssistantEnabled;
  final double textScaleFactor;
  final ValueChanged<bool> setVoiceAssistantEnabled;
  final ValueChanged<double> setTextScaleFactor;

  static AccessibilitySettings of(BuildContext context) {
    final result = context
        .dependOnInheritedWidgetOfExactType<AccessibilitySettings>();
    assert(result != null, 'No AccessibilitySettings found in context');
    return result!;
  }

  @override
  bool updateShouldNotify(AccessibilitySettings oldWidget) {
    return voiceAssistantEnabled != oldWidget.voiceAssistantEnabled ||
        textScaleFactor != oldWidget.textScaleFactor;
  }
}

class AccessibilityButton extends StatelessWidget {
  const AccessibilityButton({super.key});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: const Icon(Icons.accessibility_new),
      tooltip: 'Accessibility settings',
      onPressed: () {
        final settings = AccessibilitySettings.of(context);
        String selectedMode = 'Default';
        if (settings.voiceAssistantEnabled) {
          selectedMode = 'Vision';
        }

        showDialog<void>(
          context: context,
          builder: (dialogContext) {
            return AlertDialog(
              title: const Text('Accessibility Settings'),
              content: StatefulBuilder(
                builder: (context, setState) {
                  return SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text(
                          'Choose how you want the app to support accessibility.',
                        ),
                        const SizedBox(height: 12),
                        DropdownButtonFormField<String>(
                          value: selectedMode,
                          decoration: const InputDecoration(
                            labelText: 'Accessibility mode',
                            border: OutlineInputBorder(),
                          ),
                          items: const [
                            DropdownMenuItem(
                              value: 'Default',
                              child: Text('Default'),
                            ),
                            DropdownMenuItem(
                              value: 'Vision',
                              child: Text('Vision'),
                            ),
                            DropdownMenuItem(
                              value: 'Hearing',
                              child: Text('Hearing'),
                            ),
                          ],
                          onChanged: (value) {
                            if (value != null) {
                              selectedMode = value;
                              setState(() {});
                              if (value == 'Vision') {
                                settings.setVoiceAssistantEnabled(true);
                                settings.setTextScaleFactor(1.15);
                                VoiceAssistantService.speak(
                                  'Voice assistant enabled for vision support.',
                                );
                              } else if (value == 'Default') {
                                settings.setVoiceAssistantEnabled(false);
                                settings.setTextScaleFactor(1.0);
                                VoiceAssistantService.speak(
                                  'Voice assistant disabled.',
                                );
                              }
                            }
                          },
                        ),
                        const SizedBox(height: 12),
                        SwitchListTile(
                          title: const Text('Voice assistant'),
                          value: settings.voiceAssistantEnabled,
                          onChanged: (value) {
                            settings.setVoiceAssistantEnabled(value);
                            if (value) {
                              selectedMode = 'Vision';
                              VoiceAssistantService.speak(
                                'Voice assistant enabled.',
                              );
                            } else {
                              selectedMode = 'Default';
                              VoiceAssistantService.speak(
                                'Voice assistant disabled.',
                              );
                            }
                            setState(() {});
                          },
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Text size: ${settings.textScaleFactor.toStringAsFixed(2)}x',
                        ),
                        Slider(
                          min: 1.0,
                          max: 1.4,
                          divisions: 8,
                          value: settings.textScaleFactor,
                          onChanged: (value) {
                            settings.setTextScaleFactor(value);
                            setState(() {});
                          },
                        ),
                      ],
                    ),
                  );
                },
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(),
                  child: const Text('Close'),
                ),
              ],
            );
          },
        );
      },
    );
  }
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  bool _voiceAssistantEnabled = false;
  double _textScaleFactor = 1.0;

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
        home: const LoginPage(),
      ),
    );
  }
}

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final TextEditingController _usernameController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _login() {
    final username = _usernameController.text.trim();
    final password = _passwordController.text;

    if (username.isEmpty || password.isEmpty) {
      const message = 'Please enter your username and password.';
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text(message)));
      if (AccessibilitySettings.of(context).voiceAssistantEnabled) {
        VoiceAssistantService.speak(message);
      }
      return;
    }

    final welcomeMessage = 'Welcome, $username!';
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(welcomeMessage)));
    if (AccessibilitySettings.of(context).voiceAssistantEnabled) {
      VoiceAssistantService.speak(welcomeMessage);
    }
  }

  @override
  Widget build(BuildContext context) {
    final accessibility = AccessibilitySettings.of(context);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && accessibility.voiceAssistantEnabled) {
        VoiceAssistantService.speak('Login screen');
      }
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('Login'),
        actions: const [AccessibilityButton()],
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (accessibility.voiceAssistantEnabled)
                Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.deepPurple.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text(
                    'Voice assistant is enabled for accessibility support.',
                  ),
                ),
              Card(
                elevation: 4,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: SizedBox(
                    width: 360,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'Login',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 24),
                        TextField(
                          controller: _usernameController,
                          decoration: const InputDecoration(
                            labelText: 'Username',
                            border: OutlineInputBorder(),
                            prefixIcon: Icon(Icons.person),
                          ),
                        ),
                        const SizedBox(height: 16),
                        TextField(
                          controller: _passwordController,
                          obscureText: _obscurePassword,
                          decoration: InputDecoration(
                            labelText: 'Password',
                            border: const OutlineInputBorder(),
                            prefixIcon: const Icon(Icons.lock),
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscurePassword
                                    ? Icons.visibility
                                    : Icons.visibility_off,
                              ),
                              onPressed: () {
                                setState(() {
                                  _obscurePassword = !_obscurePassword;
                                });
                              },
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton(
                          onPressed: _login,
                          style: ElevatedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          child: const Text('Login'),
                        ),
                        const SizedBox(height: 12),
                        TextButton(
                          onPressed: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => const CreateAccountPage(),
                              ),
                            );
                          },
                          child: const Text(
                            "Don't have an account? Create account",
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

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

  final List<String> _doctorNames = [
    'Dr. Amina Hassan',
    'Dr. Salum Juma',
    'Dr. Fatma Khamis',
    'Dr. Omar Ali',
    'Dr. Shida Yusuf',
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
  String? _selectedArea;
  String? _selectedDoctor;
  String? _selectedDisabilityType;
  String? _selectedSpecialization;

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

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    bool obscureText = false,
    TextInputType? keyboardType,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller: controller,
        keyboardType: keyboardType,
        obscureText: obscureText,
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
        ),
      ),
    );
  }

  Widget _buildDropdown<T>({
    required T? value,
    required List<T> items,
    required String label,
    required ValueChanged<T?> onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: DropdownButtonFormField<T>(
        value: value,
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
        ),
        items: items.map((item) {
          return DropdownMenuItem<T>(value: item, child: Text(item.toString()));
        }).toList(),
        onChanged: onChanged,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDoctor = _isDoctorForm;
    final accessibility = AccessibilitySettings.of(context);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && accessibility.voiceAssistantEnabled) {
        VoiceAssistantService.speak('Create account screen');
      }
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('Create Account'),
        actions: const [AccessibilityButton()],
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (accessibility.voiceAssistantEnabled)
                Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.deepPurple.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text(
                    'Voice assistant is enabled for accessibility support.',
                  ),
                ),
              Card(
                elevation: 4,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: SizedBox(
                    width: 420,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'Create Account',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 16),
                        SegmentedButton<bool>(
                          segments: const [
                            ButtonSegment(
                              value: false,
                              label: Text('Disabled User'),
                            ),
                            ButtonSegment(value: true, label: Text('Doctor')),
                          ],
                          selected: {_isDoctorForm},
                          onSelectionChanged: (Set<bool> selection) {
                            setState(() {
                              _isDoctorForm = selection.first;
                            });
                          },
                        ),
                        const SizedBox(height: 20),
                        if (!isDoctor) ...[
                          _buildTextField(
                            controller: _firstNameController,
                            label: 'First Name',
                          ),
                          _buildTextField(
                            controller: _middleNameController,
                            label: 'Middle Name',
                          ),
                          _buildTextField(
                            controller: _lastNameController,
                            label: 'Last Name',
                          ),
                          _buildTextField(
                            controller: _emailController,
                            label: 'Email',
                            keyboardType: TextInputType.emailAddress,
                          ),
                          _buildTextField(
                            controller: _usernameController,
                            label: 'Username',
                          ),
                          _buildTextField(
                            controller: _passwordController,
                            label: 'Password',
                            obscureText: _obscurePassword,
                          ),
                          _buildDropdown<String>(
                            value: _selectedArea,
                            items: _areas,
                            label: 'Area in Zanzibar',
                            onChanged: (value) {
                              setState(() => _selectedArea = value);
                            },
                          ),
                          _buildDropdown<String>(
                            value: _selectedDoctor,
                            items: _doctorNames,
                            label: 'Registered Doctor',
                            onChanged: (value) {
                              setState(() => _selectedDoctor = value);
                            },
                          ),
                          _buildDropdown<String>(
                            value: _selectedDisabilityType,
                            items: _disabilityTypes,
                            label: 'Disability Type',
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
                            ),
                          const SizedBox(height: 8),
                          ElevatedButton(
                            onPressed: () {
                              if (_validateDisabledForm()) {
                                _showMessage(
                                  'Disabled user account created for ${_firstNameController.text.trim()} ${_lastNameController.text.trim()}.',
                                );
                              }
                            },
                            child: const Text('Create Disabled User Account'),
                          ),
                        ] else ...[
                          _buildTextField(
                            controller: _firstNameController,
                            label: 'First Name',
                          ),
                          _buildTextField(
                            controller: _middleNameController,
                            label: 'Middle Name',
                          ),
                          _buildTextField(
                            controller: _lastNameController,
                            label: 'Last Name',
                          ),
                          _buildTextField(
                            controller: _emailController,
                            label: 'Email',
                            keyboardType: TextInputType.emailAddress,
                          ),
                          _buildTextField(
                            controller: _usernameController,
                            label: 'Username',
                          ),
                          _buildTextField(
                            controller: _passwordController,
                            label: 'Password',
                            obscureText: _obscurePassword,
                          ),
                          _buildDropdown<String>(
                            value: _selectedArea,
                            items: _areas,
                            label: 'Area in Zanzibar',
                            onChanged: (value) {
                              setState(() => _selectedArea = value);
                            },
                          ),
                          _buildDropdown<String>(
                            value: _selectedSpecialization,
                            items: _specializationTypes,
                            label: 'Specialization',
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
                            ),
                          const SizedBox(height: 8),
                          ElevatedButton(
                            onPressed: () {
                              if (_validateDoctorForm()) {
                                _showMessage(
                                  'Doctor account created for ${_firstNameController.text.trim()} ${_lastNameController.text.trim()}.',
                                );
                              }
                            },
                            child: const Text('Create Doctor Account'),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
