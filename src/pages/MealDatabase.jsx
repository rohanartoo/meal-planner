import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function MealDatabase() {
  const navigate = useNavigate();
  const [meals, setMeals] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchMeals();
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  async function fetchMeals() {
    const res = await fetch('/api/meals');
    setMeals(await res.json());
  }

  async function deleteMeal(id) {
    if (window.confirm('Are you sure you want to delete this recipe?')) {
      await fetch(`/api/meals/${id}`, { method: 'DELETE' });
      fetchMeals();
      setToast('Recipe deleted');
    }
  }

  async function toggleFavorite(meal) {
    const newStatus = !meal.is_favorite;
    await fetch(`/api/meals/${meal.id}/favorite`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_favorite: newStatus })
    });
    setMeals(prev => prev.map(m => m.id === meal.id ? { ...m, is_favorite: newStatus } : m));
    setToast(newStatus ? 'Added to favorites' : 'Removed from favorites');
  }

  const typeLabel = (t) => {
    if (t === 'lunch') return <span className="badge badge-lunch">Lunch</span>;
    if (t === 'dinner') return <span className="badge badge-dinner">Dinner</span>;
    return <span className="badge badge-either">Either</span>;
  };

  // Fuzzy search filter
  const filteredMeals = meals.filter(meal => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = meal.name.toLowerCase().includes(q);
    const typeMatch = meal.meal_type.toLowerCase().includes(q);
    const ingredientMatch = meal.ingredients.some(ing => ing.name.toLowerCase().includes(q));
    
    return nameMatch || typeMatch || ingredientMatch;
  });

  return (
    <div className="animate-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Recipe Library</h1>
          <p>{meals.length} recipes in your collection</p>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={() => navigate('/meals/new')}
        >
          + New Recipe
        </button>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <input 
          type="text" 
          placeholder="Search recipes or ingredients..." 
          style={{ width: '100%', padding: '12px 16px', fontSize: '1.05rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', background: 'var(--bg-glass)' }}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        {meals.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🍽</div>
            <div className="empty-state-text">No recipes yet. Add your first recipe!</div>
          </div>
        ) : filteredMeals.length === 0 ? (
          <div className="empty-state" style={{ padding: '60px 20px' }}>
            <div className="empty-state-icon" style={{ opacity: 0.5 }}>🔍</div>
            <div className="empty-state-text">No recipes matched "{searchQuery}"</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="meals-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Ingredients</th>
                  <th style={{ width: 100 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMeals.map(meal => (
                  <tr key={meal.id} id={`meal-row-${meal.id}`}>
                    <td style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button 
                        className={`favorite-btn ${meal.is_favorite ? 'active' : ''}`} 
                        onClick={() => toggleFavorite(meal)}
                        title={meal.is_favorite ? "Unfavorite" : "Favorite"}
                      >
                        {meal.is_favorite ? '★' : '☆'}
                      </button>
                      <div>
                        <strong>{meal.name}</strong>
                        {meal.description && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            {meal.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>{typeLabel(meal.meal_type)}</td>
                    <td>
                      <div className="meal-ingredients-list">
                        {meal.ingredients.map(ing => (
                          <span key={ing.id} className="meal-ingredient-tag">{ing.name}</span>
                        ))}
                        {meal.ingredients.length === 0 && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No ingredients</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="meal-actions">
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => navigate(`/meals/${meal.id}/edit`)}
                          title="Edit"
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => deleteMeal(meal.id)}
                          title="Delete"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && (
        <div className={`toast ${toast.toLowerCase().includes('error') ? 'error' : ''}`}>
          {toast}
        </div>
      )}
    </div>
  );
}
