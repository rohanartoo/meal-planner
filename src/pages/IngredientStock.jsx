import React, { useState, useEffect } from 'react';
import useToast from '../hooks/useToast.js';

export default function IngredientStock() {
  const [ingredients, setIngredients] = useState([]);
  const [newName, setNewName] = useState('');
  const [search, setSearch] = useState('');
  const { toast, isError, showToast } = useToast();

  const [activeIndex, setActiveIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    fetchIngredients();
  }, []);

  async function fetchIngredients() {
    try {
      const res = await fetch('/api/ingredients');
      setIngredients(await res.json());
    } catch {
      showToast('Failed to load ingredients — is the server running?');
    }
  }

  async function addIngredient(e, nameOverride) {
    if (e) e.preventDefault();
    const cleanName = (nameOverride ?? newName).trim();
    if (!cleanName) return;

    if (ingredients.some(i => i.name.toLowerCase() === cleanName.toLowerCase())) {
      showToast('This ingredient already exists in your pantry!');
      setShowSuggestions(false);
      return;
    }

    const res = await fetch('/api/ingredients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: cleanName }),
    });
    if (res.ok) {
      setNewName('');
      setShowSuggestions(false);
      fetchIngredients();
      showToast('Ingredient added!');
    } else {
      const data = await res.json();
      showToast(data.error || 'Error');
    }
  }

  async function toggleStock(ing) {
    await fetch(`/api/ingredients/${ing.id}/stock`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ in_stock: !ing.in_stock }),
    });
    setIngredients(prev =>
      prev.map(i => (i.id === ing.id ? { ...i, in_stock: !i.in_stock } : i))
    );
  }

  async function deleteIngredient(id) {
    if (!window.confirm('Remove this ingredient? It will also be removed from any recipes using it.')) return;
    await fetch(`/api/ingredients/${id}`, { method: 'DELETE' });
    setIngredients(prev => prev.filter(i => i.id !== id));
    showToast('Ingredient removed');
  }

  async function markAllStock(inStock) {
    await Promise.all(ingredients.map(ing =>
      fetch(`/api/ingredients/${ing.id}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ in_stock: inStock }),
      })
    ));
    setIngredients(prev => prev.map(i => ({ ...i, in_stock: inStock })));
    showToast(inStock ? 'All marked in stock' : 'All marked out of stock');
  }

  const suggestions = ingredients.filter(ing => 
    newName.trim() && ing.name.toLowerCase().includes(newName.toLowerCase())
  ).slice(0, 8);

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(p => Math.min(p + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(p => Math.max(p - 1, 0));
    } else if (e.key === 'Enter') {
      if (showSuggestions && suggestions[activeIndex]) {
        e.preventDefault();
        await addIngredient(e, suggestions[activeIndex].name);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  }

  const filtered = ingredients.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  const inStockCount = ingredients.filter(i => i.in_stock).length;

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1>My Pantry</h1>
        <p>
          {ingredients.length} ingredients · {inStockCount} in stock
        </p>
      </div>

      <form onSubmit={addIngredient} className="stock-controls">
        <div className="ingredient-input-wrapper" style={{ flex: 1 }}>
          <input
            type="text"
            placeholder="Add a new ingredient..."
            value={newName}
            onChange={e => {
              setNewName(e.target.value);
              setShowSuggestions(true);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            id="new-ingredient-input"
            autoComplete="off"
          />
          {showSuggestions && newName.trim() && suggestions.length > 0 && (
            <div className="suggestions-list">
              {suggestions.map((s, idx) => (
                <div
                  key={s.id}
                  className={`suggestion-item ${idx === activeIndex ? 'active' : ''}`}
                  onClick={() => addIngredient(null, s.name)}
                >
                  {s.name}
                </div>
              ))}
            </div>
          )}
        </div>
        <button type="submit" className="btn btn-primary" id="add-ingredient-btn">
          + Add
        </button>
      </form>

      {ingredients.length > 0 && (
        <div className="stock-controls">
          {ingredients.length > 5 && (
            <div className="search-input" style={{ flex: 1 }}>
              <input
                type="search"
                placeholder="Search ingredients..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                id="search-ingredients"
              />
            </div>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => markAllStock(true)}>All In Stock</button>
          <button className="btn btn-secondary btn-sm" onClick={() => markAllStock(false)}>All Out</button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🌿</div>
          <div className="empty-state-text">
            {ingredients.length === 0
              ? 'No ingredients yet. Add some above!'
              : 'No ingredients match your search.'}
          </div>
        </div>
      ) : (
        <div className="stock-list">
          {filtered.map(ing => (
            <div
              key={ing.id}
              className={`stock-item ${ing.in_stock ? 'in-stock' : ''}`}
              onClick={() => toggleStock(ing)}
              id={`stock-item-${ing.id}`}
            >
              <div className="stock-toggle" />
              <span className="stock-item-name">{ing.name}</span>
              <button
                className="stock-item-delete"
                onClick={e => {
                  e.stopPropagation();
                  deleteIngredient(ing.id);
                }}
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {toast && <div className={`toast ${isError ? 'error' : ''}`}>{toast}</div>}
    </div>
  );
}
