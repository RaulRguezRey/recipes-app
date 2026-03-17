/**
 * audit-ingredients.mjs
 * Ejecutar: node scripts/audit-ingredients.mjs
 *
 * Genera un informe de todos los ingredientes de Supabase:
 *  - Lista completa ordenada alfabéticamente (nombre, unidad por defecto, categoría)
 *  - Posibles duplicados por nombre similar (normalizado)
 *  - Ingredientes usados en recetas con unidades distintas a su default_unit
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://orrryjgftyametdrpxjk.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ycnJ5amdmdHlhbWV0ZHJweGprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMzIxNzQsImV4cCI6MjA4ODkwODE3NH0.RXcQMhql593Zl5l9tN782whNeRhb4mHKv7vxVu0d4co';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function normalize(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

async function main() {
  // ── 1. Cargar datos ────────────────────────────────────────────────────────
  const [{ data: ingredients, error: e1 }, { data: recipes, error: e2 }] =
    await Promise.all([
      supabase.from('ingredients').select('*').order('name'),
      supabase.from('recipes').select('id, name, ingredients'),
    ]);

  if (e1) { console.error('Error cargando ingredientes:', e1.message); process.exit(1); }
  if (e2) { console.error('Error cargando recetas:', e2.message); process.exit(1); }

  // ── 2. Lista completa ──────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('  LISTA COMPLETA DE INGREDIENTES');
  console.log(`  Total: ${ingredients.length}`);
  console.log('════════════════════════════════════════════════════════════\n');

  const colW = [36, 12, 20];
  const header =
    'NOMBRE'.padEnd(colW[0]) +
    'UNIDAD'.padEnd(colW[1]) +
    'CATEGORÍA';
  console.log(header);
  console.log('─'.repeat(header.length + 10));

  for (const ing of ingredients) {
    console.log(
      ing.name.padEnd(colW[0]) +
      (ing.default_unit ?? '—').padEnd(colW[1]) +
      (ing.category ?? '(sin categoría)')
    );
  }

  // ── 3. Ingredientes sin categoría ─────────────────────────────────────────
  const noCat = ingredients.filter((i) => !i.category);
  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`  SIN CATEGORÍA (${noCat.length})`);
  console.log('════════════════════════════════════════════════════════════\n');
  for (const ing of noCat) {
    console.log(`  • ${ing.name}  [${ing.default_unit ?? '—'}]  (id: ${ing.id})`);
  }

  // ── 4. Posibles duplicados por nombre normalizado ─────────────────────────
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('  POSIBLES DUPLICADOS (nombre similar)');
  console.log('════════════════════════════════════════════════════════════\n');

  const byNorm = {};
  for (const ing of ingredients) {
    const key = normalize(ing.name);
    if (!byNorm[key]) byNorm[key] = [];
    byNorm[key].push(ing);
  }

  let dupCount = 0;
  for (const [key, group] of Object.entries(byNorm)) {
    if (group.length > 1) {
      dupCount++;
      console.log(`  ⚠  "${key}"`);
      for (const ing of group) {
        console.log(
          `      → "${ing.name}"  unidad: ${ing.default_unit ?? '—'}  cat: ${ing.category ?? '—'}  id: ${ing.id}`
        );
      }
    }
  }
  if (dupCount === 0) console.log('  (ninguno encontrado por nombre exacto normalizado)');

  // ── 5. Mismo ingrediente, distintas unidades en recetas ───────────────────
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('  INGREDIENTES CON UNIDADES INCONSISTENTES EN RECETAS');
  console.log('════════════════════════════════════════════════════════════\n');

  // Mapa ingredientId → { units: Set, usages: [{recipeName, unit, qty}] }
  const usageMap = {};
  const ingById = Object.fromEntries(ingredients.map((i) => [i.id, i]));

  for (const recipe of recipes) {
    const recIngredients = recipe.ingredients ?? [];
    for (const ri of recIngredients) {
      if (!ri.ingredientId) continue;
      if (!usageMap[ri.ingredientId]) {
        usageMap[ri.ingredientId] = { units: new Set(), usages: [] };
      }
      usageMap[ri.ingredientId].units.add(ri.unit);
      usageMap[ri.ingredientId].usages.push({
        recipeName: recipe.name,
        qty: ri.quantity,
        unit: ri.unit,
      });
    }
  }

  let inconsistentCount = 0;
  for (const [ingId, { units, usages }] of Object.entries(usageMap)) {
    if (units.size > 1) {
      inconsistentCount++;
      const ing = ingById[ingId];
      console.log(`  ⚠  ${ing?.name ?? ingId}  (default_unit: ${ing?.default_unit ?? '—'})`);
      for (const u of usages) {
        console.log(`      → ${u.recipeName}: ${u.qty} ${u.unit}`);
      }
      console.log();
    }
  }
  if (inconsistentCount === 0) console.log('  (ninguno encontrado)\n');

  // ── 6. Resumen por categoría ──────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('  RESUMEN POR CATEGORÍA');
  console.log('════════════════════════════════════════════════════════════\n');

  const byCat = {};
  for (const ing of ingredients) {
    const cat = ing.category ?? '(sin categoría)';
    if (!byCat[cat]) byCat[cat] = [];
    byCat[cat].push(ing.name);
  }

  for (const [cat, names] of Object.entries(byCat).sort()) {
    console.log(`  ${cat} (${names.length})`);
    for (const n of names.sort()) {
      console.log(`    • ${n}`);
    }
  }

  console.log('\n════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
