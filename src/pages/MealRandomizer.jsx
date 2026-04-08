import React, { useState, useCallback, useEffect } from 'react';
import MealTile from '../components/MealTile.jsx';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function MealRandomizer() {
  const [plan, setPlan] = useState(() => {
    try {
      const saved = localStorage.getItem('mealPlanner_currentPlan');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (plan) {
      localStorage.setItem('mealPlanner_currentPlan', JSON.stringify(plan));
    }
  }, [plan]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  async function generatePlan() {
    setLoading(true);
    try {
      const res = await fetch('/api/meal-plan/generate');
      const data = await res.json();
      setPlan(data);
    } catch (e) {
      showToast('Failed to generate plan');
    }
    setLoading(false);
  }

  // Collect all currently used meal IDs (for exclusion during swap)
  function getUsedIds() {
    if (!plan) return [];
    const ids = [];
    for (const day of plan) {
      if (day.lunch) ids.push(day.lunch.id);
      if (day.dinner) ids.push(day.dinner.id);
    }
    return ids;
  }

  async function handleSwap(dayIndex, slot) {
    const usedIds = getUsedIds();
    const exclude = usedIds.join(',');
    try {
      const res = await fetch(`/api/meal-plan/swap?slot=${slot}&exclude=${exclude}`);
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

  return (
    <div className="randomizer-container animate-in">
      <div className="page-header" style={{ textAlign: 'center', width: '100%' }}>
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
            Only meals with all ingredients in stock will be suggested
          </span>
        )}
      </div>

      {plan && (
        <div className="meal-grid" key={Date.now()}>
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
              />
            ))}
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
