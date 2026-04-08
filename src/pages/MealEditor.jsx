import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export default function MealEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [ingredients, setIngredients] = useState([]);
  const [form, setForm] = useState({ name: '', description: '', meal_type: 'either', is_favorite: false, ingredient_ids: [] });
  const [toast, setToast] = useState(null);

  const [ingInput, setIngInput] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    fetchIngredients();
    if (id) {
      fetchMeal(id);
    }
  }, [id]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  async function fetchMeal(mealId) {
    try {
      const res = await fetch(`/api/meals/${mealId}`);
      if (!res.ok) {
        setToast('Failed to load recipe from server (ensure backend was restarted)');
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
      setToast('Error loading recipe details');
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
    if (!name.trim()) return;
    
    // Check if already exists in main list
    let existing = ingredients.find(i => i.name.toLowerCase() === name.toLowerCase().trim());
    
    if (!existing) {
      // Create it!
      try {
        const res = await fetch('/api/ingredients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim() })
        });
        existing = await res.json();
        // Refresh master list
        await fetchIngredients();
      } catch (e) {
        setToast('Error creating ingredient');
        return;
      }
    }

    if (!form.ingredient_ids.includes(existing.id)) {
      setForm(p => ({ ...p, ingredient_ids: [...p.ingredient_ids, existing.id] }));
    }
    setIngInput('');
    setShowSuggestions(false);
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
      setToast('Meal name is required');
      return;
    }
    if (form.ingredient_ids.length === 0) {
      setToast('At least one ingredient is required');
      return;
    }

    const url = id ? `/api/meals/${id}` : '/api/meals';
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      navigate('/meals');
    } else {
      setToast('Error saving recipe');
    }
  }

  const getIngredientName = (ingId) => ingredients.find(i => i.id === ingId)?.name || '';

  return (
    <div className="animate-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button className="btn btn-secondary btn-icon" onClick={() => navigate('/meals')}>←</button>
        <div>
          <h1 style={{ marginBottom: 0 }}>{id ? 'Edit Recipe' : 'New Recipe'}</h1>
        </div>
      </div>

      <div style={{ maxWidth: 800 }}>
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

          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button type="submit" className="btn btn-primary" id="save-meal-btn">
              {id ? 'Update Recipe' : 'Save Recipe'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/meals')}>
              Cancel
            </button>
          </div>
        </form>
      </div>

      {toast && (
        <div className={`toast ${toast.toLowerCase().includes('required') || toast.toLowerCase().includes('failed') || toast.toLowerCase().includes('error') ? 'error' : ''}`}>
          {toast}
        </div>
      )}
    </div>
  );
}
