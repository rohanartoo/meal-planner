
export default function MealTile({ meal, slot, onSwap, isLocked, onToggleLock }) {
  if (!meal) {
    return (
      <div className={`meal-tile ${slot}-tile meal-tile--empty`}>
        <div className="meal-tile-empty">No meal available</div>
      </div>
    );
  }

  const missingIds = new Set((meal.missingIngredients || []).map(i => i.id));
  const isAspirational = !meal.cookable && missingIds.size > 0;
  const ingredients = meal.ingredients || [];
  const displayIngredients = ingredients.slice(0, 3);
  const remaining = ingredients.length - 3;

  return (
    <div className={`meal-tile ${slot}-tile${isAspirational ? ' meal-tile--aspirational' : ''}${isLocked ? ' meal-tile--locked' : ''}`}>
      <button
        className="lock-btn"
        onClick={onToggleLock}
        title={isLocked ? 'Unlock this meal' : 'Lock this meal'}
        id={`lock-btn-${meal.id}`}
      >
        {isLocked ? '🔒' : '🔓'}
      </button>

      {!isLocked && (
        <button
          className="swap-btn"
          onClick={onSwap}
          title="Swap for another meal"
          id={`swap-btn-${meal.id}`}
        >
          ↻
        </button>
      )}

      {isAspirational && (
        <span className="meal-tile-shop-badge" title="Ingredients needed — add to grocery list">
          🛒
        </span>
      )}

      {!!meal.is_favorite && <span className="meal-tile-favorite" title="Favorite">★</span>}

      <div className="meal-tile-name">{meal.name}</div>

      {ingredients.length > 0 && (
        <div className="meal-tile-ingredients">
          {displayIngredients.map((ing) => (
            <span
              key={ing.id}
              className={`meal-tile-ingredient${missingIds.has(ing.id) ? ' meal-tile-ingredient--missing' : ''}`}
            >
              {ing.name}
            </span>
          ))}
          {remaining > 0 && (
            <span className="meal-tile-ingredient meal-tile-ingredient--more">+{remaining}</span>
          )}
        </div>
      )}
    </div>
  );
}
