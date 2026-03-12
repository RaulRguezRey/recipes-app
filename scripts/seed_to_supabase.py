"""
seed_to_supabase.py
Uploads seeds/data.json (recipes + ingredients) to your Supabase project.

Usage (from the recipes-app folder):
    python scripts/seed_to_supabase.py

Requires:
    pip install supabase

Set these env vars (or edit the constants below):
    SUPABASE_URL      — e.g. https://abcdefgh.supabase.co
    SUPABASE_KEY      — service_role key (NOT anon key) for bypassing RLS
"""

import json
import os
import sys

# ── Config ────────────────────────────────────────────────────────────────────

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')   # service_role key

SEED_PATH = os.path.join(os.path.dirname(__file__), '..', 'seeds', 'data.json')

# ── Validate ──────────────────────────────────────────────────────────────────

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Set SUPABASE_URL and SUPABASE_KEY environment variables.")
    print("  Windows PowerShell:")
    print("    $env:SUPABASE_URL='https://xxxx.supabase.co'")
    print("    $env:SUPABASE_KEY='eyJ...'")
    sys.exit(1)

try:
    from supabase import create_client
except ImportError:
    print("ERROR: supabase package not installed. Run: pip install supabase")
    sys.exit(1)

# ── Load seed data ────────────────────────────────────────────────────────────

with open(SEED_PATH, encoding='utf-8') as f:
    seed = json.load(f)

ingredients = seed['ingredients']
recipes = seed['recipes']

print(f"Seed file: {len(recipes)} recipes, {len(ingredients)} ingredients")

# ── Connect ───────────────────────────────────────────────────────────────────

client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Upload ingredients ────────────────────────────────────────────────────────

print("Uploading ingredients...")

ing_rows = [
    {
        'id':             str(i['id']),
        'name':           i['name'],
        'default_unit':   i.get('defaultUnit', 'ud'),
        'category':       i.get('category'),
        'is_online':      bool(i.get('isOnline', False)),
        'purchase_url':   i.get('purchaseUrl'),
        'purchase_store': i.get('purchaseStore'),
    }
    for i in ingredients
]

# Upsert in batches of 500
BATCH = 500
for start in range(0, len(ing_rows), BATCH):
    batch = ing_rows[start:start + BATCH]
    result = client.table('ingredients').upsert(batch).execute()
    print(f"  ingredients {start + 1}-{start + len(batch)}: OK")

# ── Upload recipes ────────────────────────────────────────────────────────────

print("Uploading recipes...")

recipe_rows = [
    {
        'id':                   str(r['id']),
        'name':                 r['name'],
        'meal_type':            r.get('mealType', 'lunch'),
        'origin':               r.get('origin', ''),
        'difficulty':           r.get('difficulty', 'easy'),
        'prep_time':            r.get('prepTime', 0),
        'cook_time':            r.get('cookTime', 0),
        'servings':             r.get('servings', 1),
        'ingredients':          r.get('ingredients', []),
        'steps':                r.get('steps', []),
        'calories_per_serving': r.get('caloriesPerServing', 0),
        'protein_g':            r.get('proteinG', 0),
        'fat_g':                r.get('fatG', 0),
        'carbs_g':              r.get('carbsG', 0),
        'cost_eur':             r.get('costEur', 0),
        'photo_uri':            r.get('photoUri'),
        'is_favorite':          bool(r.get('isFavorite', False)),
        'source_url':           r.get('sourceUrl'),
        'notes':                r.get('notes'),
        'created_at':           r.get('createdAt'),
        'updated_at':           r.get('updatedAt'),
    }
    for r in recipes
]

for start in range(0, len(recipe_rows), BATCH):
    batch = recipe_rows[start:start + BATCH]
    result = client.table('recipes').upsert(batch).execute()
    print(f"  recipes {start + 1}-{start + len(batch)}: OK")

print(f"\nDone! Uploaded {len(ing_rows)} ingredients and {len(recipe_rows)} recipes.")
