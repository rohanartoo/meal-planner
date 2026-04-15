/**
 * One-time migration: copies data from local SQLite → Postgres (DATABASE_URL).
 *
 * Usage (from the project root):
 *   DATABASE_URL=<your-railway-postgres-url> node server/migrate.js
 *
 * Safe to re-run — uses INSERT OR IGNORE / ON CONFLICT DO NOTHING.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import pg from 'pg';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'meal-planner.db');

if (!process.env.DATABASE_URL) {
  console.error('❌  DATABASE_URL is not set. Run as:');
  console.error('   DATABASE_URL=<url> node server/migrate.js');
  process.exit(1);
}

console.log('📂 Opening SQLite at', dbPath);
const sqlite = new Database(dbPath, { readonly: true });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Ensure tables exist ──────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS ingredients (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        in_stock BOOLEAN DEFAULT false
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS meals (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        meal_type TEXT DEFAULT 'either' CHECK (meal_type IN ('lunch','dinner','either')),
        is_favorite BOOLEAN DEFAULT false
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS meal_ingredients (
        meal_id INTEGER REFERENCES meals(id) ON DELETE CASCADE,
        ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE CASCADE,
        PRIMARY KEY (meal_id, ingredient_id)
      )
    `);

    // ── Migrate ingredients ──────────────────────────────────────────
    const ingredients = sqlite.prepare('SELECT * FROM ingredients').all();
    console.log(`\n🥕 Migrating ${ingredients.length} ingredients...`);
    for (const ing of ingredients) {
      await client.query(
        `INSERT INTO ingredients (id, name, in_stock)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [ing.id, ing.name, !!ing.in_stock]
      );
    }
    // Sync the sequence so future inserts don't collide with migrated IDs
    await client.query(`SELECT setval('ingredients_id_seq', (SELECT MAX(id) FROM ingredients))`);

    // ── Migrate meals ────────────────────────────────────────────────
    const meals = sqlite.prepare('SELECT * FROM meals').all();
    console.log(`🍽️  Migrating ${meals.length} meals...`);
    for (const meal of meals) {
      await client.query(
        `INSERT INTO meals (id, name, description, meal_type, is_favorite)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [meal.id, meal.name, meal.description || '', meal.meal_type, !!meal.is_favorite]
      );
    }
    await client.query(`SELECT setval('meals_id_seq', (SELECT MAX(id) FROM meals))`);

    // ── Migrate meal_ingredients ─────────────────────────────────────
    const links = sqlite.prepare('SELECT * FROM meal_ingredients').all();
    console.log(`🔗 Migrating ${links.length} ingredient links...`);
    for (const link of links) {
      await client.query(
        `INSERT INTO meal_ingredients (meal_id, ingredient_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [link.meal_id, link.ingredient_id]
      );
    }

    await client.query('COMMIT');
    console.log('\n✅ Migration complete!');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed — rolled back.', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    sqlite.close();
  }
}

migrate();
