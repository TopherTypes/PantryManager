# MVP Scope and Open Questions

## MVP capabilities

### 1) Inventory management
- Add/edit/delete products.
- Store quantity, unit, purchase price, expiry date, and optional nutrition fields.
- Search and filter by product name, expiry date, and category.

### 2) Recipe management
- Add/edit/delete recipes.
- Define ingredients per recipe with quantity/unit per serving.
- Store optional preparation notes.

### 3) Recommendation engine (basic)
- Suggest recipes where all ingredients are present.
- Provide "missing ingredients" list when a recipe is not fully satisfiable.

### 4) Weekly meal planning
- Assign recipes to weekly slots.
- Calculate ingredient requirements for all planned meals.

### 5) Shopping list generation
- Compare planned ingredient requirements against inventory.
- Generate list of missing quantities.

### 6) Barcode-assisted updates
- Match scanned barcode to known local products first.
- If unknown, query a public barcode database and allow user confirmation before import.

## Explicit ambiguities to resolve

1. **Identity and accounts**
   - Is this strictly single-user and single-device?
2. **Barcode integrations**
   - Which public providers are acceptable?
   - What fallback behavior is needed if external APIs fail?
3. **Units and conversions**
   - Canonical units?
   - Allowed conversions and confidence rules?
4. **Nutrition requirements**
   - Which nutrients are mandatory vs optional?
5. **Recommendation ranking**
   - Rank by expiry urgency, cost optimization, nutritional goals, or user preference?
6. **Meal plan complexity**
   - Need support for leftovers, batch cooking, and portion multipliers?
7. **Shopping list grouping**
   - Group by store section/category?
8. **Data lifecycle**
   - How should archived/expired items be retained or purged?

## Out of scope for initial MVP

- Multi-user collaboration.
- Full authentication and role management.
- Native mobile packaging.
- Advanced AI meal optimization.
