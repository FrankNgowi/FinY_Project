import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'package:dikonekti/services/user_api_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  sqfliteFfiInit();
  databaseFactory = databaseFactoryFfi;

  group('UserApiService SQLite persistence', () {
    late String databaseName;

    setUp(() async {
      databaseName = 'test_users_${DateTime.now().microsecondsSinceEpoch}.db';
      await deleteDatabase(join(await getDatabasesPath(), databaseName));
    });

    tearDown(() async {
      await deleteDatabase(join(await getDatabasesPath(), databaseName));
    });

    test('registers and logs in a user from SQLite', () async {
      final registered = await UserApiService.registerUser(
        username: 'alice',
        password: 'secret',
        role: 'disabled',
        firstName: 'Alice',
        middleName: '',
        lastName: 'Ng',
        email: 'alice@example.com',
        area: 'Stone Town',
        databaseName: databaseName,
      );

      expect(registered['username'], 'alice');
      expect(registered['role'], 'disabled');

      final loggedIn = await UserApiService.loginUser(
        username: 'alice',
        password: 'secret',
        databaseName: databaseName,
      );

      expect(loggedIn['username'], 'alice');
      expect(loggedIn['role'], 'disabled');
    });
  });
}
