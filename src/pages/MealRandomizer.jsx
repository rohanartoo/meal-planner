import React, { useState, useEffect } from 'react';
import MealTile from '../components/MealTile.jsx';
import useToast from '../hooks/useToast.js';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Thu=3, Fri=4, Sat=5 draw from the full pool (including aspirational meals)
const ASPIRATIONAL_DAY_INDICES = new Set([3, 4, 5]);

export default function MealRandomizer() {
  const [plan, setPlan] = useState(() => {
    try {
      const saved = localStorage.getItem('mealPlanner_currentPlan');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [lockedSlots, setLockedSlots] = useState(() => {
    try {
      const saved = localStorage.getItem('mealPlanner_lockedSlots');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch (e) {
      return new Set();
    }
  });
  const [loading, setLoading] = useState(false);
  const [showGrocery, setShowGrocery] = useState(false);
  const { toast, isError, showToast } = useToast();

  useEffect(() => {
    if (plan) {
      localStorage.setItem('mealPlanner_currentPlan', JSON.stringify(plan));
    }
  }, [plan]);

  useEffect(() => {
    localStorage.setItem('mealPlanner_lockedSlots', JSON.stringify([...lockedSlots]));
  }, [lockedSlots]);

  function handleToggleLock(dayIndex, slot) {
    const key = `${dayIndex}-${slot}`;
    setLockedSlots(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  async function generatePlan() {
    setLoading(true);
    try {
      const res = await fetch('/api/meal-plan/generate');
      const data = await res.json();
      // Preserve locked meals from the previous plan
      setPlan(prev => {
        if (!prev) return data;
        return data.map((day, i) => ({
          lunch: lockedSlots.has(`${i}-lunch`) && prev[i]?.lunch ? prev[i].lunch : day.lunch,
          dinner: lockedSlots.has(`${i}-dinner`) && prev[i]?.dinner ? prev[i].dinner : day.dinner,
        }));
      });
    } catch (e) {
      showToast('Failed to generate plan');
    }
    setLoading(false);
  }

  // Keep a ref to the latest plan so handleSwap always reads current IDs,
  // avoiding the stale closure bug where plan is captured at render time.
  const planRef = React.useRef(plan);
  React.useEffect(() => { planRef.current = plan; }, [plan]);

  function getUsedIds() {
    const currentPlan = planRef.current;
    if (!currentPlan) return [];
    const ids = [];
    for (const day of currentPlan) {
      if (day.lunch) ids.push(day.lunch.id);
      if (day.dinner) ids.push(day.dinner.id);
    }
    return ids;
  }

  async function handleSwap(dayIndex, slot) {
    const usedIds = getUsedIds();
    const exclude = usedIds.join(',');
    // Thu–Sat swaps draw from the full pool (aspirational=1)
    const aspirational = ASPIRATIONAL_DAY_INDICES.has(dayIndex) ? '1' : '0';
    try {
      const res = await fetch(
        `/api/meal-plan/swap?slot=${slot}&exclude=${exclude}&aspirational=${aspirational}`
      );
      const newMeal = await res.json();
      if (!newMeal) {
        showToast('No more available meals to swap!');
        return;
      }

      setPlan(prev => {
        const updated = [...prev];
        updated[dayIndex] = { ...updated[dayIndex], [slot]: newMeal };
        return updated;
      });
    } catch (e) {
      showToast('Swap failed');
    }
  }

  // Grocery list: deduplicated missing ingredients across all meals in the plan
  const groceryList = React.useMemo(() => {
    if (!plan) return [];
    const seen = new Map();
    for (const day of plan) {
      for (const slot of [day.lunch, day.dinner]) {
        if (!slot?.missingIngredients) continue;
        for (const ing of slot.missingIngredients) {
          if (!seen.has(ing.id)) {
            seen.set(ing.id, ing.name);
          }
        }
      }
    }
    return Array.from(seen.values()).sort();
  }, [plan]);

  return (
    <div className="randomizer-container animate-in">
      <div className="page-header page-header--center">
        <h1>Weekly Menu</h1>
        <p>Curate your randomized meal plan based on pantry availability</p>
      </div>

      <div className="generate-section">
        <button
          className="generate-btn"
          onClick={generatePlan}
          disabled={loading}
          id="generate-btn"
        >
          {loading ? 'Generating...' : plan ? 'Regenerate Plan' : 'Generate Meal Plan'}
        </button>
        {!plan && (
          <span className="generate-subtitle">
            Mon–Wed uses your pantry. Thu–Sat suggests meals worth shopping for.
          </span>
        )}
      </div>

      {plan && (
        <>
          <div className="meal-grid">
            {/* Day headers */}
            <div className="grid-header">
              <div /> {/* spacer for row label column */}
              {DAYS.map(day => (
                <div key={day} className="grid-day-label">{day}</div>
              ))}
            </div>

            {/* Lunch row */}
            <div className="grid-row">
              <div className="grid-row-label">Lunch</div>
              {plan.map((day, i) => (
                <MealTile
                  key={`lunch-${i}-${day.lunch?.id || 'empty'}`}
                  meal={day.lunch}
                  slot="lunch"
                  onSwap={() => handleSwap(i, 'lunch')}
                  isLocked={lockedSlots.has(`${i}-lunch`)}
                  onToggleLock={() => handleToggleLock(i, 'lunch')}
                />
              ))}
            </div>

            {/* Dinner row */}
            <div className="grid-row">
              <div className="grid-row-label">Dinner</div>
              {plan.map((day, i) => (
                <MealTile
                  key={`dinner-${i}-${day.dinner?.id || 'empty'}`}
                  meal={day.dinner}
                  slot="dinner"
                  onSwap={() => handleSwap(i, 'dinner')}
                  isLocked={lockedSlots.has(`${i}-dinner`)}
                  onToggleLock={() => handleToggleLock(i, 'dinner')}
                />
              ))}
            </div>
          </div>

          {/* Grocery list — only items missing from pantry */}
          <div className="grocery-section">
            <button
              className={`btn ${groceryList.length > 0 ? 'btn-secondary' : 'btn-secondary'} grocery-toggle-btn`}
              onClick={() => setShowGrocery(g => !g)}
              disabled={groceryList.length === 0}
              id="grocery-toggle-btn"
            >
              {groceryList.length === 0
                ? '✓ All ingredients in stock'
                : `${showGrocery ? 'Hide' : 'Show'} Grocery List (${groceryList.length})`}
            </button>

            {showGrocery && groceryList.length > 0 && (
              <div className="grocery-list glass-card">
                <h3>🛒 Grocery List</h3>
                <p className="grocery-subtitle">
                  These ingredients are missing from your pantry and needed for meals in your plan.
                </p>
                <ul>
                  {groceryList.map(name => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}

      {toast && <div className={`toast ${isError ? 'error' : ''}`}>{toast}</div>}
    </div>
  );
}
