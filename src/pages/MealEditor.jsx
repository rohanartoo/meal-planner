import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useToast from '../hooks/useToast.js';

export default function MealEditor() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [ingredients, setIngredients] = useState([]);
  const [form, setForm] = useState({ name: '', description: '', meal_type: 'either', is_favorite: false, ingredient_ids: [] });
  const { toast, isError, showToast } = useToast();

  const [ingInput, setIngInput] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    fetchIngredients();
    if (id) {
      fetchMeal(id);
    }
  }, [id]);

  async function fetchMeal(mealId) {
    try {
      const res = await fetch(`/api/meals/${mealId}`);
      if (!res.ok) {
        showToast('Failed to load recipe from server (ensure backend was restarted)');
        return;
      }
      const data = await res.json();
      setForm({
        name: data.name,
        description: data.description || '',
        meal_type: data.meal_type,
        is_favorite: !!data.is_favorite,
        ingredient_ids: data.ingredients ? data.ingredients.map(i => i.id) : [],
      });
    } catch (err) {
      console.error('Fetch error:', err);
      showToast('Error loading recipe details');
    }
  }

  async function fetchIngredients() {
    const res = await fetch('/api/ingredients');
    setIngredients(await res.json());
  }

  const suggestions = ingredients.filter(ing => 
    ing.name.toLowerCase().includes(ingInput.toLowerCase()) && 
    !form.ingredient_ids.includes(ing.id)
  ).slice(0, 10);

  async function addIngredient(name) {
    if (!name.trim()) return null;
    
    // Check if already exists in main list
    let existing = ingredients.find(i => i.name.toLowerCase() === name.toLowerCase().trim());
    
    if (!existing) {
      // Not found locally — create it on the server (defaults to not in stock)
      try {
        const res = await fetch('/api/ingredients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim() })
        });
        const data = await res.json();
        if (!res.ok && res.status !== 409) {
          showToast(data.error || 'Error creating ingredient');
          return null;
        }
        existing = data;
        // Refresh master list so the new ingredient appears in suggestions
        await fetchIngredients();
      } catch (e) {
        showToast('Error creating ingredient');
        return null;
      }
    }

    if (!form.ingredient_ids.includes(existing.id)) {
      setForm(p => ({ ...p, ingredient_ids: [...p.ingredient_ids, existing.id] }));
    }
    setIngInput('');
    setShowSuggestions(false);
    return existing.id;
  }

  function removeIngredient(ingId) {
    setForm(p => ({ ...p, ingredient_ids: p.ingredient_ids.filter(i => i !== ingId) }));
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(p => Math.min(p + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(p => Math.max(p - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (showSuggestions && suggestions[activeIndex]) {
        addIngredient(suggestions[activeIndex].name);
      } else if (ingInput.trim()) {
        addIngredient(ingInput);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast('Meal name is required');
      return;
    }

    // Auto-add any ingredient text typed but not yet confirmed via Enter
    // addIngredient returns the id so we can check it without relying on stale state
    let pendingIngId = null;
    if (ingInput.trim()) {
      pendingIngId = await addIngredient(ingInput.trim());
    }

    // Use pendingIngId as a fallback because setForm is async and
    // form.ingredient_ids may not have updated yet at this point
    const hasIngredients = form.ingredient_ids.length > 0 || pendingIngId !== null;
    if (!hasIngredients) {
      showToast('At least one ingredient is required');
      return;
    }

    // Build the final ingredient list, including any just-added ingredient
    const finalIngredientIds = pendingIngId && !form.ingredient_ids.includes(pendingIngId)
      ? [...form.ingredient_ids, pendingIngId]
      : form.ingredient_ids;

    const url = id ? `/api/meals/${id}` : '/api/meals';
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, ingredient_ids: finalIngredientIds }),
    });

    if (res.ok) {
      navigate('/meals');
    } else {
      showToast('Error saving recipe');
    }
  }

  const getIngredientName = (ingId) => ingredients.find(i => i.id === ingId)?.name || '';

  return (
    <div className="animate-in">
      <div className="page-header page-header--back">
        <button className="btn btn-secondary btn-icon" onClick={() => navigate('/meals')}>←</button>
        <div>
          <h1>{id ? 'Edit Recipe' : 'New Recipe'}</h1>
        </div>
      </div>

      <div className="form-max-width">
        <form onSubmit={handleSubmit} className="glass-card">
          <div className="form-group">
            <label htmlFor="meal-name">Recipe Name</label>
            <input
              type="text"
              id="meal-name"
              placeholder="e.g. Chicken Stir Fry"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label htmlFor="meal-desc">Description</label>
            <textarea
              id="meal-desc"
              placeholder="Optional description or notes..."
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label htmlFor="meal-type">Meal Type</label>
            <select
              id="meal-type"
              value={form.meal_type}
              onChange={e => setForm(p => ({ ...p, meal_type: e.target.value }))}
            >
              <option value="either">Either (Lunch or Dinner)</option>
              <option value="lunch">Lunch Only</option>
              <option value="dinner">Dinner Only</option>
            </select>
          </div>

          <div className="form-group">
            <label>Required Ingredients</label>
            <div className="ingredient-input-wrapper">
              <input
                type="text"
                placeholder="Type and press Enter to add..."
                value={ingInput}
                onChange={e => {
                  setIngInput(e.target.value);
                  setShowSuggestions(true);
                  setActiveIndex(0);
                }}
                onKeyDown={handleKeyDown}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                id="ingredient-smart-input"
              />
              {showSuggestions && ingInput.trim() && suggestions.length > 0 && (
                <div className="suggestions-list">
                  {suggestions.map((s, idx) => (
                    <div
                      key={s.id}
                      className={`suggestion-item ${idx === activeIndex ? 'active' : ''}`}
                      onClick={() => addIngredient(s.name)}
                    >
                      {s.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="selected-ingredients">
              {form.ingredient_ids.map(ingId => (
                <span key={ingId} className="ingredient-tag">
                  {getIngredientName(ingId)}
                  <button type="button" className="ingredient-tag-remove" onClick={() => removeIngredient(ingId)} title="Remove">×</button>
                </span>
              ))}
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" id="save-meal-btn">
              {id ? 'Update Recipe' : 'Save Recipe'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/meals')}>
              Cancel
            </button>
          </div>
        </form>
      </div>

      {toast && <div className={`toast ${isError ? 'error' : ''}`}>{toast}</div>}
    </div>
  );
}
