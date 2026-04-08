import React from 'react';

export default function MealTile({ meal, slot, onSwap }) {
  if (!meal) {
    return (
      <div className={`meal-tile ${slot}-tile`}>
        <div className="meal-tile-empty">No meal available</div>
      </div>
    );
  }

  return (
    <div className={`meal-tile ${slot}-tile`}>
      <button
        className="swap-btn"
        onClick={onSwap}
        title="Swap for another meal"
        id={`swap-btn-${meal.id}`}
      >
        ↻
      </button>
      <div className="meal-tile-name">
        {meal.is_favorite ? <span className="meal-tile-favorite-star" title="Favorite meal">★ </span> : null}
        {meal.name}
      </div>
    </div>
  );
}
