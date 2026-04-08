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

// Helper: get all cookable meals (every ingredient in stock), optionally filtered by type
async function getCookableMeals(typeFilter = null) {
  // Get meals where ALL required ingredients are in stock
  // A meal with 0 ingredients is always cookable
  const allMeals = await db.all('SELECT * FROM meals');
  const cookable = [];

  for (const meal of allMeals) {
    if (typeFilter && meal.meal_type !== typeFilter && meal.meal_type !== 'either') continue;

    const ingredients = await db.all(
      `SELECT i.in_stock FROM ingredients i
       INNER JOIN meal_ingredients mi ON mi.ingredient_id = i.id
       WHERE mi.meal_id = $1`,
      [meal.id]
    );

    // All ingredients must be in stock (or meal has no ingredients)
    const allInStock = ingredients.every(i => !!i.in_stock);
    if (allInStock) {
      const fullIngredients = await db.all(
        `SELECT i.id, i.name FROM ingredients i
         INNER JOIN meal_ingredients mi ON mi.ingredient_id = i.id
         WHERE mi.meal_id = $1`,
        [meal.id]
      );
      cookable.push({ ...meal, ingredients: fullIngredients });
    }
  }
  return cookable;
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

// GET /api/meal-plan/generate
app.get('/api/meal-plan/generate', async (req, res) => {
  try {
    const lunchMeals = await getCookableMeals('lunch');
    const dinnerMeals = await getCookableMeals('dinner');

    const usedIds = new Set();
    const plan = [];
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    // Helper: shuffle favorites first, then non-favorites
    const sortAndShuffle = (meals) => {
      const favs = shuffle(meals.filter(m => !!m.is_favorite));
      const nonFavs = shuffle(meals.filter(m => !m.is_favorite));
      return [...favs, ...nonFavs];
    };

    const prioritizedLunch = sortAndShuffle(lunchMeals);
    const prioritizedDinner = sortAndShuffle(dinnerMeals);

    for (let i = 0; i < 7; i++) {
      // Pick lunch: try unused first, fallback to random cookable if none unused left
      let lunch = prioritizedLunch.find(m => !usedIds.has(m.id));
      if (!lunch && prioritizedLunch.length > 0) {
        lunch = prioritizedLunch[Math.floor(Math.random() * prioritizedLunch.length)];
      }
      if (lunch) usedIds.add(lunch.id);

      // Pick dinner: try unused first, fallback to random cookable if none unused left
      let dinner = prioritizedDinner.find(m => !usedIds.has(m.id));
      if (!dinner && prioritizedDinner.length > 0) {
        dinner = prioritizedDinner[Math.floor(Math.random() * prioritizedDinner.length)];
      }
      if (dinner) usedIds.add(dinner.id);

      plan.push({
        day: days[i],
        lunch: lunch ? { ...lunch, slot: 'lunch' } : null,
        dinner: dinner ? { ...dinner, slot: 'dinner' } : null,
      });
    }

    res.json(plan);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/meal-plan/swap?slot=lunch|dinner&exclude=1,2,3
app.get('/api/meal-plan/swap', async (req, res) => {
  try {
    const { slot, exclude = '' } = req.query;
    const excludeIds = new Set(exclude.split(',').filter(Boolean).map(Number));
    const typeFilter = slot === 'lunch' ? 'lunch' : 'dinner';

    const cookable = await getCookableMeals(typeFilter);
    if (cookable.length === 0) return res.json(null);

    let candidates = cookable.filter(m => !excludeIds.has(m.id));
    if (candidates.length === 0) {
      // Fallback: all cookable meals are excluded, so just pick any cookable meal
      candidates = cookable;
    }

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    res.json({ ...pick, slot });
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
