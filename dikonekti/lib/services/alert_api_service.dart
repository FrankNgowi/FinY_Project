import 'dart:convert';

import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

import 'package:dikonekti/models/emergency_alert.dart';

/// Persists [EmergencyAlert]s to a local SQLite table.
///
/// Alerts are stored as a JSON blob (via [EmergencyAlert.toJson]) alongside
/// a few indexed columns used for filtering. This mirrors [UserApiService]
/// so a doctor's alert feed and a patient's alert history survive the app
/// being closed and reopened, instead of only existing in memory for the
/// current session.
class AlertApiService {
  static const String _tableName = 'alerts';

  static Future<Database> _openDatabase([String? databaseName]) async {
    final databasesPath = await getDatabasesPath();
    final path = join(databasesPath, databaseName ?? 'dikonekti_alerts.db');

    return openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE $_tableName (
            id TEXT PRIMARY KEY,
            doctorUsername TEXT,
            patientUsername TEXT,
            acknowledged INTEGER NOT NULL DEFAULT 0,
            timestamp TEXT NOT NULL,
            data TEXT NOT NULL
          )
        ''');
      },
    );
  }

  /// Saves a newly sent alert. Called right after the alert is added to the
  /// in-memory feed — the UI never waits on this, so a slow or failed write
  /// never blocks or drops an emergency alert.
  static Future<void> saveAlert(
    EmergencyAlert alert, {
    String? databaseName,
  }) async {
    final db = await _openDatabase(databaseName);
    try {
      await db.insert(
        _tableName,
        {
          'id': alert.id,
          'doctorUsername': alert.doctorUsername,
          'patientUsername': alert.patientUsername,
          'acknowledged': alert.acknowledged ? 1 : 0,
          'timestamp': alert.timestamp.toIso8601String(),
          'data': jsonEncode(alert.toJson()),
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    } finally {
      await db.close();
    }
  }

  /// Marks a stored alert as acknowledged.
  static Future<void> acknowledgeAlert(
    String id, {
    String? databaseName,
  }) async {
    final db = await _openDatabase(databaseName);
    try {
      final rows = await db.query(
        _tableName,
        where: 'id = ?',
        whereArgs: [id],
        limit: 1,
      );
      if (rows.isEmpty) return;

      final data =
          jsonDecode(rows.first['data'] as String) as Map<String, dynamic>;
      data['acknowledged'] = true;

      await db.update(
        _tableName,
        {'acknowledged': 1, 'data': jsonEncode(data)},
        where: 'id = ?',
        whereArgs: [id],
      );
    } finally {
      await db.close();
    }
  }

  /// Loads every stored alert, most recent first. Called on app startup to
  /// repopulate the alert feed for both doctors and disabled users.
  static Future<List<EmergencyAlert>> getAllAlerts({
    String? databaseName,
  }) async {
    final db = await _openDatabase(databaseName);
    try {
      final rows = await db.query(_tableName, orderBy: 'timestamp DESC');
      return rows
          .map(
            (row) => EmergencyAlert.fromJson(
              jsonDecode(row['data'] as String) as Map<String, dynamic>,
            ),
          )
          .toList();
    } finally {
      await db.close();
    }
  }
}