import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import db from './db.js';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve built frontend in production
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// ═══════════════════════════════════════════════════════════════════
// INGREDIENTS
// ═══════════════════════════════════════════════════════════════════

// GET all ingredients
app.get('/api/ingredients', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM ingredients ORDER BY name');
    // Normalize in_stock to boolean
    res.json(rows.map(r => ({ ...r, in_stock: !!r.in_stock })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST new ingredient
app.post('/api/ingredients', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    
    const cleanName = name.trim();
    const existing = await db.get('SELECT * FROM ingredients WHERE LOWER(name) = LOWER($1)', [cleanName]);
    if (existing) {
      return res.status(409).json({ error: 'Ingredient already exists', id: existing.id, name: existing.name });
    }

    const result = await db.run(
      'INSERT INTO ingredients (name, in_stock) VALUES ($1, $2)',
      [cleanName, false]
    );
    res.json({ id: result.lastID, name: name.trim(), in_stock: false });
  } catch (e) {
    if (e.message?.includes('UNIQUE') || e.message?.includes('unique'))
      return res.status(409).json({ error: 'Ingredient already exists' });
    res.status(500).json({ error: e.message });
  }
});

// PATCH toggle stock
app.patch('/api/ingredients/:id/stock', async (req, res) => {
  try {
    const { in_stock } = req.body;
    await db.run('UPDATE ingredients SET in_stock = $1 WHERE id = $2', [in_stock, req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE ingredient
app.delete('/api/ingredients/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM meal_ingredients WHERE ingredient_id = $1', [req.params.id]);
    await db.run('DELETE FROM ingredients WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// MEALS
// ═══════════════════════════════════════════════════════════════════

// GET all meals (with their ingredients)
app.get('/api/meals', async (req, res) => {
  try {
    const meals = await db.all('SELECT * FROM meals ORDER BY name');
    const mealsWithIngredients = await Promise.all(
      meals.map(async (meal) => {
        meal.is_favorite = !!meal.is_favorite;
        const ingredients = await db.all(
          `SELECT i.id, i.name, i.in_stock FROM ingredients i
           INNER JOIN meal_ingredients mi ON mi.ingredient_id = i.id
           WHERE mi.meal_id = $1`,
          [meal.id]
        );
        return {
          ...meal,
          ingredients: ingredients.map(i => ({ ...i, in_stock: !!i.in_stock })),
        };
      })
    );
    res.json(mealsWithIngredients);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET single meal
app.get('/api/meals/:id', async (req, res) => {
  try {
    const meal = await db.get('SELECT * FROM meals WHERE id = $1', [req.params.id]);
    if (!meal) return res.status(404).json({ error: 'Meal not found' });
    meal.is_favorite = !!meal.is_favorite;
    
    const ingredients = await db.all(
      `SELECT i.id, i.name, i.in_stock FROM ingredients i
       INNER JOIN meal_ingredients mi ON mi.ingredient_id = i.id
       WHERE mi.meal_id = $1`,
      [meal.id]
    );
    
    res.json({
      ...meal,
      ingredients: ingredients.map(i => ({ ...i, in_stock: !!i.in_stock })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST new meal
app.post('/api/meals', async (req, res) => {
  try {
    const { name, description = '', meal_type = 'either', ingredient_ids = [], is_favorite = false } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });

    const result = await db.run(
      'INSERT INTO meals (name, description, meal_type, is_favorite) VALUES ($1, $2, $3, $4)',
      [name.trim(), description.trim(), meal_type, is_favorite]
    );
    const mealId = result.lastID;

    for (const ingId of ingredient_ids) {
      await db.run(
        'INSERT INTO meal_ingredients (meal_id, ingredient_id) VALUES ($1, $2)',
        [mealId, ingId]
      );
    }

    res.json({ id: mealId, name: name.trim(), description: description.trim(), meal_type, is_favorite, ingredient_ids });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT update meal
app.put('/api/meals/:id', async (req, res) => {
  try {
    const { name, description = '', meal_type = 'either', ingredient_ids = [], is_favorite = false } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });

    await db.run(
      'UPDATE meals SET name = $1, description = $2, meal_type = $3, is_favorite = $4 WHERE id = $5',
      [name.trim(), description.trim(), meal_type, is_favorite, req.params.id]
    );

    await db.run('DELETE FROM meal_ingredients WHERE meal_id = $1', [req.params.id]);
    for (const ingId of ingredient_ids) {
      await db.run(
        'INSERT INTO meal_ingredients (meal_id, ingredient_id) VALUES ($1, $2)',
        [req.params.id, ingId]
      );
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE meal
app.delete('/api/meals/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM meal_ingredients WHERE meal_id = $1', [req.params.id]);
    await db.run('DELETE FROM meals WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH toggle favorite
app.patch('/api/meals/:id/favorite', async (req, res) => {
  try {
    const { is_favorite } = req.body;
    await db.run('UPDATE meals SET is_favorite = $1 WHERE id = $2', [is_favorite, req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// MEAL PLAN GENERATION
// ═══════════════════════════════════════════════════════════════════

// Helper: get all meals with stock info, optionally filtered by meal type.
// Returns each meal annotated with:
//   cookable: boolean           — true when every ingredient is in stock
//   ingredients: [{id, name}]   — full ingredient list
//   missingIngredients: [{id, name}] — subset that are out of stock
async function getAllMealsWithStockInfo(typeFilter = null) {
  const allMeals = await db.all('SELECT * FROM meals');
  const result = [];

  for (const meal of allMeals) {
    if (typeFilter && meal.meal_type !== typeFilter && meal.meal_type !== 'either') continue;

    const ingredients = await db.all(
      `SELECT i.id, i.name, i.in_stock FROM ingredients i
       INNER JOIN meal_ingredients mi ON mi.ingredient_id = i.id
       WHERE mi.meal_id = $1`,
      [meal.id]
    );

    const missingIngredients = ingredients
      .filter(i => !i.in_stock)
      .map(i => ({ id: i.id, name: i.name }));

    result.push({
      ...meal,
      is_favorite: !!meal.is_favorite,
      cookable: missingIngredients.length === 0,
      ingredients: ingredients.map(i => ({ id: i.id, name: i.name })),
      missingIngredients,
    });
  }
  return result;
}

// Shuffle array (Fisher-Yates)
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Persist the current plan as a single shared row (id=1 always)
async function savePlan(plan) {
  const json = JSON.stringify(plan);
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO current_plan (id, plan_json, updated_at)
     VALUES (1, $1, $2)
     ON CONFLICT (id) DO UPDATE SET plan_json = $1, updated_at = $2`,
    [json, now]
  );
}

// GET /api/meal-plan/current — return the shared plan (or null)
app.get('/api/meal-plan/current', async (req, res) => {
  try {
    const row = await db.get('SELECT plan_json FROM current_plan WHERE id = 1');
    if (!row) return res.json(null);
    res.json(JSON.parse(row.plan_json));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/meal-plan/current — save the full plan from the frontend
app.post('/api/meal-plan/current', async (req, res) => {
  try {
    const plan = req.body;
    if (!Array.isArray(plan) || plan.length !== 7) {
      return res.status(400).json({ error: 'Invalid plan format' });
    }
    await savePlan(plan);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/meal-plan/generate
// Mon/Tue/Wed/Sun → cookable meals only
// Thu/Fri/Sat     → PREFER aspirational (missing ingredients), fall back to cookable
app.get('/api/meal-plan/generate', async (req, res) => {
  try {
    const lunchAll = await getAllMealsWithStockInfo('lunch');
    const dinnerAll = await getAllMealsWithStockInfo('dinner');

    const lunchCookable     = shuffle(lunchAll.filter(m =>  m.cookable));
    const dinnerCookable    = shuffle(dinnerAll.filter(m =>  m.cookable));
    const lunchAspirational = shuffle(lunchAll.filter(m => !m.cookable));
    const dinnerAspirational= shuffle(dinnerAll.filter(m => !m.cookable));

    // Favorites bubble to the front within each bucket
    const favFirst = arr => [
      ...arr.filter(m => m.is_favorite),
      ...arr.filter(m => !m.is_favorite),
    ];

    const ASPIRATIONAL_DAYS = new Set([3, 4, 5]); // Thu=3, Fri=4, Sat=5

    // Shared count across both lunch and dinner — max 2 uses per meal per week
    const usedCount = new Map(); // meal.id → number of times placed this week
    const canUse   = (m) => (usedCount.get(m.id) || 0) < 2;
    const markUsed = (m) => { if (m) usedCount.set(m.id, (usedCount.get(m.id) || 0) + 1); };

    // Pick an available meal from pool (respecting the 2-use cap).
    // Fallback: if every meal is at the cap, pick the least-used one.
    const pickFrom = (pool) => {
      const available = pool.filter(canUse);
      if (available.length > 0) return available[Math.floor(Math.random() * available.length)];
      // All at cap — pick least-used to spread repeats as evenly as possible
      if (pool.length === 0) return null;
      const sorted = [...pool].sort((a, b) => (usedCount.get(a.id) || 0) - (usedCount.get(b.id) || 0));
      return sorted[0];
    };

    const plan = [];
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    for (let i = 0; i < 7; i++) {
      const isAspirationalDay = ASPIRATIONAL_DAYS.has(i);
      let lunch, dinner;

      if (isAspirationalDay) {
        // Thu/Fri/Sat: try an aspirational meal first; fall back to cookable
        lunch  = pickFrom(favFirst(lunchAspirational))
              ?? pickFrom(favFirst(lunchCookable));
        dinner = pickFrom(favFirst(dinnerAspirational))
              ?? pickFrom(favFirst(dinnerCookable));
      } else {
        // Mon/Tue/Wed/Sun: cookable only
        lunch  = pickFrom(favFirst(lunchCookable));
        dinner = pickFrom(favFirst(dinnerCookable));
      }

      markUsed(lunch);
      markUsed(dinner);

      plan.push({
        day: days[i],
        isAspirationalDay,
        lunch:  lunch  ? { ...lunch,  slot: 'lunch'  } : null,
        dinner: dinner ? { ...dinner, slot: 'dinner' } : null,
      });
    }

    await savePlan(plan);
    res.json(plan);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/meal-plan/swap?slot=lunch|dinner&exclude=1,2,3&aspirational=0|1
// aspirational=1 → PREFER non-cookable meals, fall back to cookable (for Thu–Sat)
// aspirational=0 → cookable meals only (Mon–Wed, Sun)
app.get('/api/meal-plan/swap', async (req, res) => {
  try {
    const { slot, exclude = '', aspirational = '0' } = req.query;
    const excludeIds = new Set(exclude.split(',').filter(Boolean).map(Number));
    const typeFilter = slot === 'lunch' ? 'lunch' : 'dinner';

    const allMeals = await getAllMealsWithStockInfo(typeFilter);

    if (aspirational === '1') {
      // Prefer aspirational (non-cookable), then fall back to cookable
      const aspirationalPool = allMeals.filter(m => !m.cookable && !excludeIds.has(m.id));
      const cookablePool     = allMeals.filter(m =>  m.cookable && !excludeIds.has(m.id));
      const pool = aspirationalPool.length > 0 ? aspirationalPool : cookablePool;

      // Last resort: ignore exclusions if everything is excluded
      const candidates = pool.length > 0 ? pool : allMeals.filter(m => !excludeIds.has(m.id));
      if (candidates.length === 0) return res.json(null);
      return res.json({ ...candidates[Math.floor(Math.random() * candidates.length)], slot });
    } else {
      // Cookable only, but fall back to aspirational if all cookable are already in the plan
      const cookable = allMeals.filter(m => m.cookable);
      let candidates = cookable.filter(m => !excludeIds.has(m.id));
      if (candidates.length === 0) {
        // All cookable meals are already in the plan — try aspirational
        candidates = allMeals.filter(m => !m.cookable && !excludeIds.has(m.id));
      }
      if (candidates.length === 0) {
        // Last resort: repeat any cookable meal
        candidates = cookable;
      }
      if (candidates.length === 0) return res.json(null);
      return res.json({ ...candidates[Math.floor(Math.random() * candidates.length)], slot });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// SPA fallback — serve index.html for non-API routes in production
app.get('{*path}', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Meal Planner API running on http://localhost:${PORT}`);
});
