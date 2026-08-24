import 'package:geolocator/geolocator.dart';

/// Small wrapper around `geolocator` used only for one thing: getting a
/// best-effort GPS fix to attach to an emergency alert.
///
/// This deliberately never throws. Location is "nice to have" on an
/// emergency alert, not a precondition for sending one — if the device has
/// no signal, permission was denied, or location services are off, callers
/// get back a [LocationResult] describing why, and should send the alert
/// anyway rather than blocking on it.
class LocationResult {
  const LocationResult.success(this.latitude, this.longitude) : error = null;
  const LocationResult.failure(this.error)
      : latitude = null,
        longitude = null;

  final double? latitude;
  final double? longitude;
  final String? error;

  bool get hasCoordinates => latitude != null && longitude != null;
}

class LocationService {
  static Future<LocationResult> getCurrentLocation() async {
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        return const LocationResult.failure(
          'Location services are turned off on this device.',
        );
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.denied) {
        return const LocationResult.failure(
          'Location permission was denied.',
        );
      }

      if (permission == LocationPermission.deniedForever) {
        return const LocationResult.failure(
          'Location permission is permanently denied. Enable it in system settings.',
        );
      }

      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      ).timeout(const Duration(seconds: 10));

      return LocationResult.success(position.latitude, position.longitude);
    } catch (error) {
      return LocationResult.failure('Could not determine location: $error');
    }
  }
}