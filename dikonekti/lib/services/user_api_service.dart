import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

class UserApiService {
  static const String _tableName = 'users';

  static Future<Database> _openDatabase([String? databaseName]) async {
    final databasesPath = await getDatabasesPath();
    final path = join(databasesPath, databaseName ?? 'dikonekti_users.db');

    return openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE $_tableName (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            firstName TEXT,
            middleName TEXT,
            lastName TEXT,
            email TEXT,
            area TEXT,
            registeredDoctor TEXT,
            disabilityType TEXT,
            specialization TEXT
          )
        ''');
      },
    );
  }

  static Future<Map<String, dynamic>> registerUser({
    required String username,
    required String password,
    required String role,
    required String firstName,
    required String middleName,
    required String lastName,
    required String email,
    required String area,
    String? databaseName,
    String? registeredDoctor,
    String? disabilityType,
    String? specialization,
  }) async {
    final db = await _openDatabase(databaseName);

    try {
      final existing = await db.query(
        _tableName,
        where: 'username = ?',
        whereArgs: [username],
        limit: 1,
      );

      if (existing.isNotEmpty) {
        throw Exception('Username already exists');
      }

      final id = await db.insert(_tableName, {
        'username': username,
        'password': password,
        'role': role,
        'firstName': firstName,
        'middleName': middleName,
        'lastName': lastName,
        'email': email,
        'area': area,
        'registeredDoctor': registeredDoctor,
        'disabilityType': disabilityType,
        'specialization': specialization,
      });

      return {
        'id': id,
        'username': username,
        'password': password,
        'role': role,
        'firstName': firstName,
        'middleName': middleName,
        'lastName': lastName,
        'email': email,
        'area': area,
        'registeredDoctor': registeredDoctor,
        'disabilityType': disabilityType,
        'specialization': specialization,
      };
    } finally {
      await db.close();
    }
  }

  static Future<Map<String, dynamic>> loginUser({
    required String username,
    required String password,
    String? databaseName,
  }) async {
    final db = await _openDatabase(databaseName);

    try {
      final rows = await db.query(
        _tableName,
        where: 'username = ? AND password = ?',
        whereArgs: [username, password],
        limit: 1,
      );

      if (rows.isEmpty) {
        throw Exception('Invalid username or password');
      }

      final row = rows.first;
      return {
        'id': row['id'],
        'username': row['username'],
        'password': row['password'],
        'role': row['role'],
        'firstName': row['firstName'],
        'middleName': row['middleName'],
        'lastName': row['lastName'],
        'email': row['email'],
        'area': row['area'],
        'registeredDoctor': row['registeredDoctor'],
        'disabilityType': row['disabilityType'],
        'specialization': row['specialization'],
      };
    } finally {
      await db.close();
    }
  }
}
