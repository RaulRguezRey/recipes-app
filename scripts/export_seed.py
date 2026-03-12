"""
export_seed.py
Reads recetas.db and generates seeds/data.json in the format expected by the React Native app.

Usage (from the recipes-app folder):
    python scripts/export_seed.py
"""

import sqlite3
import json
import os
import random
import string
from datetime import datetime

# ── Config ────────────────────────────────────────────────────────────────────
DB_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'Recetas Manager', 'recetas.db')
OUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'seeds', 'data.json')

# ── Helpers ───────────────────────────────────────────────────────────────────
def new_id():
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=12))

def map_meal_type(tipo):
    m = {
        'almuerzo': 'lunch', 'comida': 'lunch',
        'desayuno': 'breakfast',
        'merienda': 'snack',
        'cena': 'dinner',
    }
    return m.get((tipo or '').lower().strip(), 'lunch')

def map_difficulty(dif):
    m = {
        'facil': 'easy', 'fácil': 'easy',
        'media': 'medium', 'medio': 'medium',
        'dificil': 'hard', 'difícil': 'hard',
    }
    return m.get((dif or '').lower().strip(), 'easy')

def safe_int(v, default=0):
    try: return int(v) if v is not None else default
    except: return default

def safe_float(v, default=0.0):
    try: return float(v) if v is not None else default
    except: return default

# ── Main ──────────────────────────────────────────────────────────────────────
conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# 1. Ingredients catalogue (ingredients table)
cur.execute("SELECT * FROM ingredients")
db_ingredients = cur.fetchall()

# Map from SQLite id (int) → app id (string)
ing_id_map = {}
app_ingredients = []

for row in db_ingredients:
    app_id = str(row['id'])
    ing_id_map[row['id']] = app_id
    app_ingredients.append({
        'id': app_id,
        'name': row['name'],
        'defaultUnit': 'ud',
        'category': (row['seccion'] if 'seccion' in row.keys() else None) or None,
        'isOnline': bool(row['is_online']) if row['is_online'] is not None else False,
        'purchaseUrl': (row['purchase_url'] if 'purchase_url' in row.keys() else None) or None,
        'purchaseStore': (row['purchase_store'] if 'purchase_store' in row.keys() else None) or None,
    })

# 2. Recipes
cur.execute("SELECT * FROM recipes ORDER BY id")
db_recipes = cur.fetchall()

app_recipes = []

for recipe in db_recipes:
    recipe_id = str(recipe['id'])
    prep = safe_int(recipe['tiempo_preparacion_min'])
    total = safe_int(recipe['tiempo_total_min'])
    cook = max(0, total - prep)

    # Ingredients for this recipe
    cur.execute(
        "SELECT * FROM recipe_ingredients WHERE recipe_id = ? ORDER BY id",
        (recipe['id'],)
    )
    db_ings = cur.fetchall()
    recipe_ingredients = []

    for ri in db_ings:
        # Resolve ingredient id
        if ri['ingredient_id'] and ri['ingredient_id'] in ing_id_map:
            ing_id = ing_id_map[ri['ingredient_id']]
        else:
            # Ingredient not in catalogue: create a new one
            ing_name = (ri['ingrediente'] or '').strip()
            if not ing_name:
                continue
            # Check if we already created this ingredient
            existing = next((i for i in app_ingredients if i['name'].lower() == ing_name.lower()), None)
            if existing:
                ing_id = existing['id']
            else:
                ing_id = new_id()
                app_ingredients.append({
                    'id': ing_id,
                    'name': ing_name,
                    'defaultUnit': (ri['unidad'] or 'ud').strip() or 'ud',
                    'category': None,
                    'isOnline': False,
                    'purchaseUrl': None,
                    'purchaseStore': None,
                })

        recipe_ingredients.append({
            'ingredientId': ing_id,
            'quantity': safe_float(ri['cantidad'], 1.0),
            'unit': (ri['unidad'] or 'ud').strip() or 'ud',
        })

    # Steps for this recipe
    cur.execute(
        "SELECT texto FROM recipe_steps WHERE recipe_id = ? ORDER BY step_number",
        (recipe['id'],)
    )
    steps = [row['texto'] for row in cur.fetchall() if row['texto']]

    now = datetime.utcnow().isoformat() + 'Z'

    app_recipes.append({
        'id': recipe_id,
        'name': recipe['titulo'] or '',
        'mealType': map_meal_type(recipe['tipo']),
        'origin': recipe['origen'] or '',
        'difficulty': map_difficulty(recipe['dificultad']),
        'prepTime': prep,
        'cookTime': cook,
        'servings': safe_int(recipe['raciones'], 1),
        'ingredients': recipe_ingredients,
        'steps': steps,
        'caloriesPerServing': safe_int(recipe['calorias_por_racion']),
        'proteinG': safe_float(recipe['proteinas_g']),
        'fatG': safe_float(recipe['grasas_g']),
        'carbsG': safe_float(recipe['carbohidratos_g']),
        'costEur': safe_float(recipe['coste_aproximado_por_racion']),
        'photoUri': (recipe['foto'] if 'foto' in recipe.keys() else None) or None,
        'isFavorite': bool(recipe['favorito']) if recipe['favorito'] is not None else False,
        'sourceUrl': (recipe['url'] if 'url' in recipe.keys() else None) or None,
        'notes': (recipe['notas'] if 'notas' in recipe.keys() else None) or None,
        'createdAt': (recipe['created_at'] if 'created_at' in recipe.keys() else None) or now,
        'updatedAt': now,
    })

conn.close()

# 3. Write output
seed = {
    'recipes': app_recipes,
    'ingredients': app_ingredients,
}

os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
with open(OUT_PATH, 'w', encoding='utf-8') as f:
    json.dump(seed, f, ensure_ascii=False, indent=2)

print(f"OK: Exported {len(app_recipes)} recipes and {len(app_ingredients)} ingredients")
print(f"  -> {os.path.abspath(OUT_PATH)}")
