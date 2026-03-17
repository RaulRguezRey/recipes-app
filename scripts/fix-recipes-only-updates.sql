-- fix-recipes-only-updates.sql
-- Solo los UPDATEs de recetas (el DELETE ya se ejecutó)
-- Pegar en: Supabase Dashboard → SQL Editor → New query

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

-- Merges de ingredientId

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
