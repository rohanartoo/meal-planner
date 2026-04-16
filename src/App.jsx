import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import MealRandomizer from './pages/MealRandomizer.jsx';
import MealDatabase from './pages/MealDatabase.jsx';
import MealEditor from './pages/MealEditor.jsx';
import IngredientStock from './pages/IngredientStock.jsx';

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem('nourish_darkMode') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('nourish_darkMode', darkMode);
  }, [darkMode]);

  return (
    <BrowserRouter>
      <div className="app-layout">
        <nav className="sidebar">
          <div className="sidebar-logo">
            <span>Nourish</span>
          </div>
          <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="sidebar-icon">📅</span>
            <span>Weekly Menu</span>
          </NavLink>
          <NavLink to="/meals" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="sidebar-icon">📖</span>
            <span>Recipe Library</span>
          </NavLink>
          <NavLink to="/ingredients" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="sidebar-icon">🥬</span>
            <span>My Pantry</span>
          </NavLink>
          <button
            className="dark-mode-toggle"
            onClick={() => setDarkMode(d => !d)}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span className="sidebar-icon">{darkMode ? '☀️' : '🌙'}</span>
            <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </nav>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<MealRandomizer />} />
            <Route path="/meals" element={<MealDatabase />} />
            <Route path="/meals/new" element={<MealEditor />} />
            <Route path="/meals/:id/edit" element={<MealEditor />} />
            <Route path="/ingredients" element={<IngredientStock />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
