import pg from 'pg';
import sqlite3 from 'sqlite3';

const { Pool } = pg;

function openSqliteDatabase(path) {
  const db = new sqlite3.Database(path);
  const run = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function callback(error) {
      if (error) reject(error);
      else resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
  const get = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => error ? reject(error) : resolve(row));
  });

  const initialize = async () => {
    await run('PRAGMA foreign_keys = ON');
    await run(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    const migrations = [
      [1, [
        `CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS learning_profiles (
          user_id INTEGER PRIMARY KEY,
          profile_json TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`,
      ]],
      [2, [
        'ALTER TABLE users ADD COLUMN email_verified_at DATETIME',
        'UPDATE users SET email_verified_at = CURRENT_TIMESTAMP WHERE email_verified_at IS NULL',
      ]],
      [3, [
        `CREATE TABLE IF NOT EXISTS account_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          purpose TEXT NOT NULL,
          token_hash TEXT NOT NULL UNIQUE,
          expires_at DATETIME NOT NULL,
          used_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`,
        'CREATE INDEX IF NOT EXISTS account_tokens_lookup ON account_tokens(token_hash, purpose)',
      ]],
    ];
    for (const [version, statements] of migrations) {
      if (await get('SELECT version FROM schema_migrations WHERE version = ?', [version])) continue;
      for (const statement of statements) await run(statement);
      await run('INSERT INTO schema_migrations (version) VALUES (?)', [version]);
    }
  };

  const close = () => new Promise((resolve, reject) => {
    db.close((error) => error ? reject(error) : resolve());
  });

  return { provider: 'sqlite', run, get, initialize, close };
}

function postgresPlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${index += 1}`);
}

function openPostgresDatabase(connectionString) {
  const pool = new Pool({ connectionString, max: 5 });
  const query = (sql, params = []) => pool.query(postgresPlaceholders(sql), params);
  const run = async (sql, params = []) => {
    const result = await query(sql, params);
    return { changes: result.rowCount };
  };
  const get = async (sql, params = []) => {
    const result = await query(sql, params);
    return result.rows[0];
  };

  const initialize = async () => {
    await run(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )`);
    const migrations = [
      [1, [
        `CREATE TABLE IF NOT EXISTS users (
          id BIGSERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS learning_profiles (
          user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          profile_json JSONB NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )`,
      ]],
      [2, [
        'ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ',
        'UPDATE users SET email_verified_at = CURRENT_TIMESTAMP WHERE email_verified_at IS NULL',
      ]],
      [3, [
        `CREATE TABLE IF NOT EXISTS account_tokens (
          id BIGSERIAL PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          purpose TEXT NOT NULL,
          token_hash TEXT NOT NULL UNIQUE,
          expires_at TIMESTAMPTZ NOT NULL,
          used_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )`,
        'CREATE INDEX IF NOT EXISTS account_tokens_lookup ON account_tokens(token_hash, purpose)',
      ]],
    ];
    for (const [version, statements] of migrations) {
      if (await get('SELECT version FROM schema_migrations WHERE version = ?', [version])) continue;
      for (const statement of statements) await run(statement);
      await run('INSERT INTO schema_migrations (version) VALUES (?)', [version]);
    }
  };

  return {
    provider: 'postgres', run, get, initialize, close: () => pool.end(),
  };
}

export function openDatabase({ databaseUrl, databasePath }) {
  return databaseUrl
    ? openPostgresDatabase(databaseUrl)
    : openSqliteDatabase(databasePath);
}
