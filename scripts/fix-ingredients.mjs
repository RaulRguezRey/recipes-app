/**
 * fix-ingredients.mjs
 * Ejecutar: node scripts/fix-ingredients.mjs
 *
 * Aplica todos los cambios acordados:
 *  1. Categorías de ingredientes
 *  2. default_unit de ingredientes
 *  3. Merges de ingredientes en recetas (con conversión de cantidades)
 *  4. Eliminación de ingredientes obsoletos
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://orrryjgftyametdrpxjk.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ycnJ5amdmdHlhbWV0ZHJweGprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMzIxNzQsImV4cCI6MjA4ODkwODE3NH0.RXcQMhql593Zl5l9tN782whNeRhb4mHKv7vxVu0d4co';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── 1. Categorías ────────────────────────────────────────────────────────────

const CATEGORIES = [
  // Aceites
  [1,    'Aceites'],
  // Bebidas
  [2,    'Bebidas'],
  [107,  'Bebidas'],
  [108,  'Bebidas'],
  // Carnes y aves
  [20,   'Carnes y aves'],
  [21,   'Carnes y aves'],
  [22,   'Carnes y aves'],
  [29,   'Carnes y aves'],
  [30,   'Carnes y aves'],
  [42,   'Carnes y aves'],
  [57,   'Carnes y aves'],
  [75,   'Carnes y aves'],
  [93,   'Carnes y aves'],
  [95,   'Carnes y aves'],
  // Charcutería
  [26,   'Charcutería'],
  [37,   'Charcutería'],
  [43,   'Charcutería'],
  [46,   'Charcutería'],
  [60,   'Charcutería'],
  [70,   'Charcutería'],
  [74,   'Charcutería'],
  [97,   'Charcutería'],
  // Conservas
  [6,    'Conservas'],
  [10,   'Conservas'],
  [15,   'Conservas'],
  [16,   'Conservas'],
  [17,   'Conservas'],
  [40,   'Conservas'],
  [51,   'Conservas'],
  [59,   'Conservas'],
  [99,   'Conservas'],
  [102,  'Conservas'],
  // Especias y condimentos
  [7,    'Especias y condimentos'],
  [11,   'Especias y condimentos'],
  [18,   'Especias y condimentos'],
  [28,   'Especias y condimentos'],
  [31,   'Especias y condimentos'],
  [33,   'Especias y condimentos'],
  [39,   'Especias y condimentos'],
  [49,   'Especias y condimentos'],
  [64,   'Especias y condimentos'],
  [67,   'Especias y condimentos'],
  [77,   'Especias y condimentos'],
  [78,   'Especias y condimentos'],
  [92,   'Especias y condimentos'],
  [105,  'Especias y condimentos'],
  // Frutas y verduras
  [3,    'Frutas y verduras'],
  [8,    'Frutas y verduras'],
  [12,   'Frutas y verduras'],  // Brócoli (currently "Verduras")
  [13,   'Frutas y verduras'],
  [14,   'Frutas y verduras'],
  [23,   'Frutas y verduras'],
  [24,   'Frutas y verduras'],
  [25,   'Frutas y verduras'],
  [27,   'Frutas y verduras'],
  [32,   'Frutas y verduras'],
  [34,   'Frutas y verduras'],
  [38,   'Frutas y verduras'],
  [47,   'Frutas y verduras'],
  [48,   'Frutas y verduras'],
  [53,   'Frutas y verduras'],
  [55,   'Frutas y verduras'],
  [66,   'Frutas y verduras'],
  [73,   'Frutas y verduras'],
  [76,   'Frutas y verduras'],
  [81,   'Frutas y verduras'],
  [82,   'Frutas y verduras'],
  [85,   'Frutas y verduras'],
  [90,   'Frutas y verduras'],
  [98,   'Frutas y verduras'],
  [101,  'Frutas y verduras'],
  [103,  'Frutas y verduras'],
  [104,  'Frutas y verduras'],
  [112,  'Frutas y verduras'],
  // Frutos secos y semillas
  [83,   'Frutos secos y semillas'],
  // Lácteos y huevos
  [45,   'Lácteos y huevos'],
  [50,   'Lácteos y huevos'],
  [58,   'Lácteos y huevos'],
  [62,   'Lácteos y huevos'],
  [86,   'Lácteos y huevos'],
  [87,   'Lácteos y huevos'],
  [88,   'Lácteos y huevos'],
  [89,   'Lácteos y huevos'],
  [109,  'Lácteos y huevos'],
  [110,  'Lácteos y huevos'],
  [111,  'Lácteos y huevos'],
  // Legumbres
  [4,    'Legumbres'],
  [5,    'Legumbres'],
  [36,   'Legumbres'],
  [54,   'Legumbres'],
  // Panadería
  [41,   'Panadería'],
  [63,   'Panadería'],
  [68,   'Panadería'],
  [69,   'Panadería'],
  [106,  'Panadería'],
  // Pasta y arroz
  [9,    'Pasta y arroz'],
  [35,   'Pasta y arroz'],
  [65,   'Pasta y arroz'],
  [71,   'Pasta y arroz'],
  [72,   'Pasta y arroz'],
  [84,   'Pasta y arroz'],
  [91,   'Pasta y arroz'],
  [94,   'Pasta y arroz'],
  // Pescados
  [56,   'Pescados'],
];

// ── 2. default_unit ──────────────────────────────────────────────────────────

const DEFAULT_UNITS = [
  [1,   'ml'],   // Aceite de oliva v.e.
  [2,   'ml'],   // Agua
  [11,  'g'],    // Azúcar
  [15,  'ml'],   // Caldo de carne
  [23,  'ud'],   // Cebolla
  [28,  'tsp'],  // Comino molido
  [73,  'ud'],   // Patata
  [77,  'tsp'],  // Pimentón dulce
  [78,  'g'],    // Pimienta negra
  [92,  'g'],    // Sal
  [98,  'ud'],   // Tomate
  [99,  'g'],    // Tomate concentrado
  [112, 'ud'],   // Zanahoria
];

// ── 3. Merges: old ingredientId → new ingredientId ───────────────────────────

const MERGES = {
  19:   21,   // Carne picada → Carne picada mixta (cerdo y ternera)
  61:   95,   // Morcillo de ternera → Ternera
  96:   95,   // Ternera para guisar → Ternera
  100:  98,   // Tomate maduro → Tomate
  2705: 68,   // Rebanada de pan → Pan
};

// Notas extra a añadir en las recetas por el merge de Ternera
const RECIPE_NOTES_APPEND = {
  // recipeName fragment → note to append
  'Cocido madrileño': 'Ternera: usar morcillo.',
  'Estofado tradicional de ternera': 'Ternera: usar aguja o morcillo.',
};

// ── 4. Normalización de unidades en recetas ──────────────────────────────────
// Para cada ingredientId define la unidad destino y conversiones desde otras unidades.
// convert: { fromUnit: (qty) => newQty }
// Si no hay conversión definida para la unidad origen, se cambia la unidad pero se mantiene la cantidad.

const UNIT_RULES = {
  1:   { target: 'ml' },
  2:   { target: 'ml' },
  11:  { target: 'g',   convert: { tsp: q => Math.round(q * 4) } },
  15:  { target: 'ml' },
  23:  { target: 'ud',  convert: { g: q => Math.max(1, Math.round(q / 100)) } },
  28:  { target: 'tsp', convert: { tbsp: q => q * 3, g: q => parseFloat((q / 2.5).toFixed(1)) } },
  73:  { target: 'ud',  convert: { g: q => Math.max(1, Math.round(q / 150)) } },
  77:  { target: 'tsp', convert: { tbsp: q => q * 3 } },
  78:  { target: 'g' },
  92:  { target: 'g' },
  98:  { target: 'ud',  convert: { g: q => Math.max(1, Math.round(q / 150)) } },
  99:  { target: 'g',   convert: { tbsp: q => q * 15 } },
  112: { target: 'ud',  convert: { g: q => Math.max(1, Math.round(q / 80)) } },
};

function applyUnitRule(ingId, qty, unit) {
  const rule = UNIT_RULES[ingId];
  if (!rule || unit === rule.target) return { quantity: qty, unit };
  const newQty = rule.convert?.[unit] ? rule.convert[unit](qty) : qty;
  return { quantity: newQty, unit: rule.target };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function log(msg) { process.stdout.write(msg + '\n'); }

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log('\n═══ PASO 1: Actualizando categorías (' + CATEGORIES.length + ' ingredientes)…');
  for (const [id, category] of CATEGORIES) {
    const { error } = await sb.from('ingredients').update({ category }).eq('id', id);
    if (error) log(`  ✗ id:${id} → ${error.message}`);
    else process.stdout.write('.');
  }
  log('\n  ✓ Categorías actualizadas.');

  log('\n═══ PASO 2: Actualizando default_unit…');
  for (const [id, default_unit] of DEFAULT_UNITS) {
    const { error } = await sb.from('ingredients').update({ default_unit }).eq('id', id);
    if (error) log(`  ✗ id:${id} → ${error.message}`);
    else process.stdout.write('.');
  }
  log('\n  ✓ default_unit actualizados.');

  log('\n═══ PASO 3: Actualizando recetas (merges + unidades)…');
  const { data: recipes, error: recErr } = await sb.from('recipes').select('id, name, ingredients, notes');
  if (recErr) { log('  ✗ ' + recErr.message); process.exit(1); }

  let recipeChanges = 0;
  for (const recipe of recipes) {
    const originalIngredients = recipe.ingredients ?? [];
    let changed = false;
    let newNotes = recipe.notes ?? '';

    // Apply notes appends for Ternera merges
    for (const [fragment, noteToAdd] of Object.entries(RECIPE_NOTES_APPEND)) {
      if (recipe.name.includes(fragment) && !newNotes.includes(noteToAdd)) {
        newNotes = newNotes ? newNotes + ' ' + noteToAdd : noteToAdd;
        changed = true;
      }
    }

    const newIngredients = originalIngredients.map((ri) => {
      let { ingredientId, quantity, unit } = ri;
      ingredientId = Number(ingredientId);

      // Merge: replace old ingredientId with new one
      const mergedTo = MERGES[ingredientId];
      if (mergedTo) {
        ingredientId = mergedTo;
        changed = true;
      }

      // Fix unit (use final ingredientId after merge)
      const fixed = applyUnitRule(ingredientId, quantity, unit);
      if (fixed.unit !== unit || fixed.quantity !== quantity) changed = true;

      return { ingredientId, quantity: fixed.quantity, unit: fixed.unit };
    });

    if (changed) {
      const updatePayload = { ingredients: newIngredients };
      if (newNotes !== (recipe.notes ?? '')) updatePayload.notes = newNotes;
      const { error } = await sb.from('recipes').update(updatePayload).eq('id', recipe.id);
      if (error) {
        log(`  ✗ "${recipe.name}": ${error.message}`);
      } else {
        log(`  ✓ "${recipe.name}"`);
        recipeChanges++;
      }
    }
  }
  log(`  Total recetas modificadas: ${recipeChanges}`);

  log('\n═══ PASO 4: Eliminando ingredientes obsoletos…');
  const toDelete = Object.keys(MERGES).map(Number);
  for (const id of toDelete) {
    const { error } = await sb.from('ingredients').delete().eq('id', id);
    if (error) log(`  ✗ id:${id} → ${error.message}`);
    else log(`  ✓ Eliminado id:${id}`);
  }

  log('\n═══ COMPLETADO ✓\n');
}

main().catch(console.error);
