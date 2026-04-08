import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import MealRandomizer from './pages/MealRandomizer.jsx';
import MealDatabase from './pages/MealDatabase.jsx';
import MealEditor from './pages/MealEditor.jsx';
import IngredientStock from './pages/IngredientStock.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <nav className="sidebar">
          <div className="sidebar-logo">
            <span>Nourish</span>
          </div>
          <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
            <span>Weekly Menu</span>
          </NavLink>
          <NavLink to="/meals" className={({ isActive }) => isActive ? 'active' : ''}>
            <span>Recipe Library</span>
          </NavLink>
          <NavLink to="/ingredients" className={({ isActive }) => isActive ? 'active' : ''}>
            <span>My Pantry</span>
          </NavLink>
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
