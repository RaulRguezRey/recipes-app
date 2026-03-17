-- fix-recipes.sql
-- Pegar en: Supabase Dashboard → SQL Editor → New query
-- Corrige unidades en los ingredients JSONB de cada receta
-- y aplica los merges de ingredientes.

-- ── HELPER: función para transformar cada elemento del array ─────────────────
-- (No hace falta crearla, todas las queries son standalone)

-- ════════════════════════════════════════════════════════════════════════════
-- 1. ACEITE DE OLIVA VIRGEN EXTRA (id:1) — g → ml
-- ════════════════════════════════════════════════════════════════════════════
UPDATE recipes
SET ingredients = (
  SELECT jsonb_agg(
    CASE
      WHEN (e->>'ingredientId')::int = 1 AND e->>'unit' = 'g'
        THEN jsonb_set(e, '{unit}', '"ml"')
      ELSE e
    END
  )
  FROM jsonb_array_elements(ingredients) AS e
)
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(ingredients) AS e
  WHERE (e->>'ingredientId')::int = 1 AND e->>'unit' = 'g'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 2. AGUA (id:2) — ud → ml
-- ════════════════════════════════════════════════════════════════════════════
UPDATE recipes
SET ingredients = (
  SELECT jsonb_agg(
    CASE
      WHEN (e->>'ingredientId')::int = 2 AND e->>'unit' = 'ud'
        THEN jsonb_set(e, '{unit}', '"ml"')
      ELSE e
    END
  )
  FROM jsonb_array_elements(ingredients) AS e
)
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(ingredients) AS e
  WHERE (e->>'ingredientId')::int = 2 AND e->>'unit' = 'ud'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 3. AZÚCAR (id:11) — tsp → g  (1 tsp ≈ 4 g)
-- ════════════════════════════════════════════════════════════════════════════
UPDATE recipes
SET ingredients = (
  SELECT jsonb_agg(
    CASE
      WHEN (e->>'ingredientId')::int = 11 AND e->>'unit' = 'tsp'
        THEN jsonb_set(jsonb_set(e, '{unit}', '"g"'), '{quantity}', to_jsonb(round((e->>'quantity')::numeric * 4)))
      ELSE e
    END
  )
  FROM jsonb_array_elements(ingredients) AS e
)
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(ingredients) AS e
  WHERE (e->>'ingredientId')::int = 11 AND e->>'unit' = 'tsp'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 4. CALDO DE CARNE (id:15) — g → ml
-- ════════════════════════════════════════════════════════════════════════════
UPDATE recipes
SET ingredients = (
  SELECT jsonb_agg(
    CASE
      WHEN (e->>'ingredientId')::int = 15 AND e->>'unit' = 'g'
        THEN jsonb_set(e, '{unit}', '"ml"')
      ELSE e
    END
  )
  FROM jsonb_array_elements(ingredients) AS e
)
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(ingredients) AS e
  WHERE (e->>'ingredientId')::int = 15 AND e->>'unit' = 'g'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 5. CEBOLLA (id:23) — g → ud  (100 g ≈ 1 ud)
-- ════════════════════════════════════════════════════════════════════════════
UPDATE recipes
SET ingredients = (
  SELECT jsonb_agg(
    CASE
      WHEN (e->>'ingredientId')::int = 23 AND e->>'unit' = 'g'
        THEN jsonb_set(jsonb_set(e, '{unit}', '"ud"'), '{quantity}', to_jsonb(GREATEST(1, round((e->>'quantity')::numeric / 100))))
      ELSE e
    END
  )
  FROM jsonb_array_elements(ingredients) AS e
)
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(ingredients) AS e
  WHERE (e->>'ingredientId')::int = 23 AND e->>'unit' = 'g'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 6. COMINO MOLIDO (id:28) — tbsp → tsp (*3) y g → tsp (/2.5)
-- ════════════════════════════════════════════════════════════════════════════
UPDATE recipes
SET ingredients = (
  SELECT jsonb_agg(
    CASE
      WHEN (e->>'ingredientId')::int = 28 AND e->>'unit' = 'tbsp'
        THEN jsonb_set(jsonb_set(e, '{unit}', '"tsp"'), '{quantity}', to_jsonb((e->>'quantity')::numeric * 3))
      WHEN (e->>'ingredientId')::int = 28 AND e->>'unit' = 'g'
        THEN jsonb_set(jsonb_set(e, '{unit}', '"tsp"'), '{quantity}', to_jsonb(round((e->>'quantity')::numeric / 2.5 * 2) / 2))
      ELSE e
    END
  )
  FROM jsonb_array_elements(ingredients) AS e
)
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(ingredients) AS e
  WHERE (e->>'ingredientId')::int = 28 AND e->>'unit' IN ('tbsp', 'g')
);

-- ════════════════════════════════════════════════════════════════════════════
-- 7. PATATA (id:73) — g → ud  (150 g ≈ 1 ud mediana)
-- ════════════════════════════════════════════════════════════════════════════
UPDATE recipes
SET ingredients = (
  SELECT jsonb_agg(
    CASE
      WHEN (e->>'ingredientId')::int = 73 AND e->>'unit' = 'g'
        THEN jsonb_set(jsonb_set(e, '{unit}', '"ud"'), '{quantity}', to_jsonb(GREATEST(1, round((e->>'quantity')::numeric / 150))))
      ELSE e
    END
  )
  FROM jsonb_array_elements(ingredients) AS e
)
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(ingredients) AS e
  WHERE (e->>'ingredientId')::int = 73 AND e->>'unit' = 'g'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 8. PIMENTÓN DULCE (id:77) — tbsp → tsp (*3)
-- ════════════════════════════════════════════════════════════════════════════
UPDATE recipes
SET ingredients = (
  SELECT jsonb_agg(
    CASE
      WHEN (e->>'ingredientId')::int = 77 AND e->>'unit' = 'tbsp'
        THEN jsonb_set(jsonb_set(e, '{unit}', '"tsp"'), '{quantity}', to_jsonb((e->>'quantity')::numeric * 3))
      ELSE e
    END
  )
  FROM jsonb_array_elements(ingredients) AS e
)
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(ingredients) AS e
  WHERE (e->>'ingredientId')::int = 77 AND e->>'unit' = 'tbsp'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 9. PIMIENTA NEGRA (id:78) — ud → g  (1 ud = 1 g "al gusto")
-- ════════════════════════════════════════════════════════════════════════════
UPDATE recipes
SET ingredients = (
  SELECT jsonb_agg(
    CASE
      WHEN (e->>'ingredientId')::int = 78 AND e->>'unit' = 'ud'
        THEN jsonb_set(e, '{unit}', '"g"')
      ELSE e
    END
  )
  FROM jsonb_array_elements(ingredients) AS e
)
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(ingredients) AS e
  WHERE (e->>'ingredientId')::int = 78 AND e->>'unit' = 'ud'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 10. SAL (id:92) — ud → g  (1 ud = 1 g "al gusto")
-- ════════════════════════════════════════════════════════════════════════════
UPDATE recipes
SET ingredients = (
  SELECT jsonb_agg(
    CASE
      WHEN (e->>'ingredientId')::int = 92 AND e->>'unit' = 'ud'
        THEN jsonb_set(e, '{unit}', '"g"')
      ELSE e
    END
  )
  FROM jsonb_array_elements(ingredients) AS e
)
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(ingredients) AS e
  WHERE (e->>'ingredientId')::int = 92 AND e->>'unit' = 'ud'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 11. TOMATE (id:98) — g → ud  (150 g ≈ 1 ud)
-- ════════════════════════════════════════════════════════════════════════════
UPDATE recipes
SET ingredients = (
  SELECT jsonb_agg(
    CASE
      WHEN (e->>'ingredientId')::int = 98 AND e->>'unit' = 'g'
        THEN jsonb_set(jsonb_set(e, '{unit}', '"ud"'), '{quantity}', to_jsonb(GREATEST(1, round((e->>'quantity')::numeric / 150))))
      ELSE e
    END
  )
  FROM jsonb_array_elements(ingredients) AS e
)
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(ingredients) AS e
  WHERE (e->>'ingredientId')::int = 98 AND e->>'unit' = 'g'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 12. TOMATE CONCENTRADO (id:99) — tbsp → g  (1 tbsp ≈ 15 g)
-- ════════════════════════════════════════════════════════════════════════════
UPDATE recipes
SET ingredients = (
  SELECT jsonb_agg(
    CASE
      WHEN (e->>'ingredientId')::int = 99 AND e->>'unit' = 'tbsp'
        THEN jsonb_set(jsonb_set(e, '{unit}', '"g"'), '{quantity}', to_jsonb((e->>'quantity')::numeric * 15))
      ELSE e
    END
  )
  FROM jsonb_array_elements(ingredients) AS e
)
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(ingredients) AS e
  WHERE (e->>'ingredientId')::int = 99 AND e->>'unit' = 'tbsp'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 13. ZANAHORIA (id:112) — g → ud  (80 g ≈ 1 zanahoria mediana)
-- ════════════════════════════════════════════════════════════════════════════
UPDATE recipes
SET ingredients = (
  SELECT jsonb_agg(
    CASE
      WHEN (e->>'ingredientId')::int = 112 AND e->>'unit' = 'g'
        THEN jsonb_set(jsonb_set(e, '{unit}', '"ud"'), '{quantity}', to_jsonb(GREATEST(1, round((e->>'quantity')::numeric / 80))))
      ELSE e
    END
  )
  FROM jsonb_array_elements(ingredients) AS e
)
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(ingredients) AS e
  WHERE (e->>'ingredientId')::int = 112 AND e->>'unit' = 'g'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 14. MERGE: Carne picada (id:19) → Carne picada mixta (id:21)
-- ════════════════════════════════════════════════════════════════════════════
UPDATE recipes
SET ingredients = (
  SELECT jsonb_agg(
    CASE
      WHEN (e->>'ingredientId')::int = 19
        THEN jsonb_set(e, '{ingredientId}', '21')
      ELSE e
    END
  )
  FROM jsonb_array_elements(ingredients) AS e
)
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(ingredients) AS e
  WHERE (e->>'ingredientId')::int = 19
);

-- ════════════════════════════════════════════════════════════════════════════
-- 15. MERGE: Morcillo de ternera (id:61) → Ternera (id:95)
-- ════════════════════════════════════════════════════════════════════════════
UPDATE recipes
SET ingredients = (
  SELECT jsonb_agg(
    CASE
      WHEN (e->>'ingredientId')::int = 61
        THEN jsonb_set(e, '{ingredientId}', '95')
      ELSE e
    END
  )
  FROM jsonb_array_elements(ingredients) AS e
)
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(ingredients) AS e
  WHERE (e->>'ingredientId')::int = 61
);

UPDATE recipes
SET notes = CASE WHEN notes IS NULL OR notes = '' THEN 'Ternera: usar morcillo.' ELSE notes || ' Ternera: usar morcillo.' END
WHERE name ILIKE '%Cocido madrile%'
  AND (notes IS NULL OR notes NOT LIKE '%morcillo%');

-- ════════════════════════════════════════════════════════════════════════════
-- 16. MERGE: Ternera para guisar (id:96) → Ternera (id:95)
-- ════════════════════════════════════════════════════════════════════════════
UPDATE recipes
SET ingredients = (
  SELECT jsonb_agg(
    CASE
      WHEN (e->>'ingredientId')::int = 96
        THEN jsonb_set(e, '{ingredientId}', '95')
      ELSE e
    END
  )
  FROM jsonb_array_elements(ingredients) AS e
)
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(ingredients) AS e
  WHERE (e->>'ingredientId')::int = 96
);

UPDATE recipes
SET notes = CASE WHEN notes IS NULL OR notes = '' THEN 'Ternera: usar aguja o morcillo.' ELSE notes || ' Ternera: usar aguja o morcillo.' END
WHERE name ILIKE '%Estofado tradicional de ternera%'
  AND (notes IS NULL OR notes NOT LIKE '%aguja%');

-- ════════════════════════════════════════════════════════════════════════════
-- 17. MERGE: Tomate maduro (id:100) → Tomate (id:98)
-- ════════════════════════════════════════════════════════════════════════════
UPDATE recipes
SET ingredients = (
  SELECT jsonb_agg(
    CASE
      WHEN (e->>'ingredientId')::int = 100
        THEN jsonb_set(e, '{ingredientId}', '98')
      ELSE e
    END
  )
  FROM jsonb_array_elements(ingredients) AS e
)
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(ingredients) AS e
  WHERE (e->>'ingredientId')::int = 100
);

-- ════════════════════════════════════════════════════════════════════════════
-- 18. MERGE: Rebanada de pan (id:2705) → Pan (id:68)
-- ════════════════════════════════════════════════════════════════════════════
UPDATE recipes
SET ingredients = (
  SELECT jsonb_agg(
    CASE
      WHEN (e->>'ingredientId')::int = 2705
        THEN jsonb_set(e, '{ingredientId}', '68')
      ELSE e
    END
  )
  FROM jsonb_array_elements(ingredients) AS e
)
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(ingredients) AS e
  WHERE (e->>'ingredientId')::int = 2705
);

-- ════════════════════════════════════════════════════════════════════════════
-- 19. Eliminar ingredientes obsoletos (los merges ya están aplicados arriba)
-- ════════════════════════════════════════════════════════════════════════════
DELETE FROM ingredients WHERE id IN ('19', '61', '96', '100', '2705');

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN (opcional, ejecutar después)
-- ════════════════════════════════════════════════════════════════════════════
-- SELECT name, e->>'ingredientId' as ing_id, e->>'unit' as unit, e->>'quantity' as qty
-- FROM recipes, jsonb_array_elements(ingredients) AS e
-- WHERE (e->>'ingredientId')::int = 1
-- ORDER BY name;
