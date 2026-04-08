import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isPostgres = !!process.env.DATABASE_URL;

let db;

// ─── Unified interface ───────────────────────────────────────────────
// db.run(sql, params)   → execute INSERT/UPDATE/DELETE, returns { lastID, changes }
// db.all(sql, params)   → SELECT, returns rows array
// db.get(sql, params)   → SELECT one, returns row or undefined
// ────────────────────────────────────────────────────────────────────

if (isPostgres) {
  // ── PostgreSQL mode ───────────────────────────────────────────────
  const pg = await import('pg');
  const pool = new pg.default.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  db = {
    run: async (sql, params = []) => {
      const res = await pool.query(sql, params);
      return { lastID: res.rows?.[0]?.id, changes: res.rowCount };
    },
    all: async (sql, params = []) => {
      const res = await pool.query(sql, params);
      return res.rows;
    },
    get: async (sql, params = []) => {
      const res = await pool.query(sql, params);
      return res.rows[0];
    },
  };

  // Create tables (Postgres syntax)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ingredients (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      in_stock BOOLEAN DEFAULT false
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meals (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      meal_type TEXT DEFAULT 'either' CHECK (meal_type IN ('lunch','dinner','either')),
      is_favorite BOOLEAN DEFAULT false
    )
  `);
  // Safely add column if it doesn't exist
  try {
    await pool.query(`ALTER TABLE meals ADD COLUMN is_favorite BOOLEAN DEFAULT false`);
  } catch (e) { /* Column already exists */ }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meal_ingredients (
      meal_id INTEGER REFERENCES meals(id) ON DELETE CASCADE,
      ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE CASCADE,
      PRIMARY KEY (meal_id, ingredient_id)
    )
  `);

  console.log('✅ Connected to PostgreSQL');

} else {
  // ── SQLite mode ─────────────────────────────────────────────────
  const Database = (await import('better-sqlite3')).default;
  const dbPath = path.join(__dirname, '..', 'meal-planner.db');
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  const sanitize = (params) => params.map(p => (typeof p === 'boolean' ? (p ? 1 : 0) : p));

  db = {
    run: async (sql, params = []) => {
      // Convert $1, $2 placeholders to ? for SQLite
      const converted = sql.replace(/\$\d+/g, '?');
      const stmt = sqlite.prepare(converted);
      const info = stmt.run(...sanitize(params));
      return { lastID: info.lastInsertRowid, changes: info.changes };
    },
    all: async (sql, params = []) => {
      const converted = sql.replace(/\$\d+/g, '?');
      return sqlite.prepare(converted).all(...sanitize(params));
    },
    get: async (sql, params = []) => {
      const converted = sql.replace(/\$\d+/g, '?');
      return sqlite.prepare(converted).get(...sanitize(params));
    },
  };

  // Create tables (SQLite syntax)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      in_stock INTEGER DEFAULT 0
    )
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS meals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      meal_type TEXT DEFAULT 'either' CHECK (meal_type IN ('lunch','dinner','either')),
      is_favorite INTEGER DEFAULT 0
    )
  `);
  // Safely add column if it doesn't exist
  try {
    sqlite.exec(`ALTER TABLE meals ADD COLUMN is_favorite INTEGER DEFAULT 0`);
  } catch (e) { /* Column already exists */ }
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS meal_ingredients (
      meal_id INTEGER REFERENCES meals(id) ON DELETE CASCADE,
      ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE CASCADE,
      PRIMARY KEY (meal_id, ingredient_id)
    )
  `);

  console.log('✅ Using SQLite at', dbPath);
}

export default db;
