# Dikonekti - Project Structure

The codebase is now organized into clear, focused directories for easier maintenance and understanding:

## Directory Structure

```
lib/
├── main.dart                 # Entry point - minimal, just runs the app
├── app/
│   └── app.dart             # App state management and MaterialApp setup
├── models/
│   ├── user_account.dart    # UserAccount model
│   └── emergency_alert.dart # EmergencyAlert model
├── screens/
│   ├── dashboard_page.dart       # Dashboard router (doctor vs disabled user)
│   ├── dashboard_components.dart # Dashboard UI and alert components
│   ├── login_page.dart           # Login screen
│   ├── create_account_page.dart  # Account creation screen
│   └── helpers.dart              # Utility functions (timeGreeting, timeAgo)
├── services/
│   └── user_api_service.dart # SQLite-based user persistence
└── widgets/
    ├── voice_assistant_service.dart   # Text-to-speech service
    └── accessibility_settings.dart    # Accessibility provider & button
```

## Key Features

- **Models**: Data structures for users and emergency alerts
- **Screens**: Complete pages with their components and logic
- **Widgets**: Reusable UI components and services
- **Services**: Data persistence (currently SQLite local storage)
- **App**: Root application state and theme configuration

## File Purposes

| File | Purpose |
|------|---------|
| `app/app.dart` | App root, state management, routing logic |
| `models/*` | Data classes for type safety |
| `screens/dashboard_page.dart` | Routes to doctor or user dashboard |
| `screens/dashboard_components.dart` | All dashboard UI components |
| `screens/login_page.dart` | Authentication entry point |
| `screens/create_account_page.dart` | User registration (doctor & disabled user) |
| `screens/helpers.dart` | Time formatting utilities |
| `services/user_api_service.dart` | SQLite database layer |
| `widgets/accessibility_settings.dart` | Accessibility UI and state management |
| `widgets/voice_assistant_service.dart` | Text-to-speech using flutter_tts |

## Quick Navigation

- **Want to modify login?** → `screens/login_page.dart`
- **Want to change dashboard UI?** → `screens/dashboard_components.dart`
- **Want to modify accessibility?** → `widgets/accessibility_settings.dart`
- **Want to change data persistence?** → `services/user_api_service.dart`
- **Want to adjust app theme?** → `app/app.dart`
