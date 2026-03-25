const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';
const MODEL = 'claude-haiku-4-5-20251001';

export type GeneratedRecipe = {
  name: string;
  mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner';
  origin: string;
  difficulty: 'easy' | 'medium' | 'hard';
  prepTime: number;
  cookTime: number;
  servings: number;
  ingredients: { name: string; quantity: number; unit: string }[];
  steps: string[];
  caloriesPerServing: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  costEur: number;
  notes: string | null;
};

function buildSystemPrompt(catalogueLine: string): string {
  return `Eres un asistente de cocina español. El usuario describe una receta y tú la generas en JSON estricto.

Responde ÚNICAMENTE con un objeto JSON válido con esta estructura (sin texto adicional ni markdown):
{
  "name": string,
  "mealType": "breakfast" | "lunch" | "snack" | "dinner",
  "origin": string (país o región, ej: "Italiana", "Española", "Mexicana"),
  "difficulty": "easy" | "medium" | "hard",
  "prepTime": number (minutos de preparación),
  "cookTime": number (minutos de cocción),
  "servings": number,
  "ingredients": [{ "name": string, "quantity": number, "unit": string }],
  "steps": [string],
  "caloriesPerServing": number,
  "proteinG": number,
  "fatG": number,
  "carbsG": number,
  "costEur": number (coste aproximado por ración en euros),
  "notes": string | null
}

REGLAS — LEE CON ATENCIÓN:

1. name:
   - Solo la primera letra del título en mayúscula, el resto en minúscula. Ejemplos correctos: "Pasta carbonara", "Pollo al curry", "Tortilla de patatas". INCORRECTO: "Pasta Carbonara", "Pollo Al Curry".

2. mealType:
   - "breakfast": desayunos (tostadas, cereales, huevos revueltos, smoothies...).
   - "lunch": comida principal del mediodía con hidratos o proteína contundente (pasta, arroces, guisos, carnes, pescados).
   - "snack": picoteo o merienda ligera (fruta, yogur, galletas, bocadillo pequeño).
   - "dinner": cena equilibrada pero más ligera que el almuerzo (sopas, ensaladas, tortillas, verduras con proteína).

3. origin: usa siempre el gentilicio en femenino: "Italiana", "Española", "Mexicana", "Americana", "Japonesa", "India", "Francesa". NUNCA uses "Estadounidense", usa "Americana".

4. Tiempos:
   - prepTime y cookTime son siempre números enteros en minutos, mínimo 1.
   - cookTime nunca puede ser 0. Si la receta no requiere calor (smoothie, ensalada), pon cookTime = prepTime.
   - Los tiempos deben ser realistas: una tortilla de patatas necesita mínimo 30 min de cocción, una pasta 15 min, un guiso 45 min.

5. Unidades — CRÍTICO:
   - Líquidos (leche, agua, caldo, zumo, leche de coco, nata, aceite*): ml o l.
   - Sólidos pesables (carne, pescado, arroz, pasta, harina, azúcar, yogur, queso, mantequilla): g o kg.
   - Especias en polvo (curry, comino, pimentón, canela, cúrcuma, orégano seco...): g o tsp.
   - Hierbas frescas (cilantro, perejil, albahaca, menta...): g o ramita.
   - Ingredientes contables (cebolla, huevo, tomate, patata, pimiento, limón, aguacate, ajo...): ud.
   - NUNCA uses "ud" para líquidos, especias, hierbas, carnes, pescados, arroces, pastas ni lácteos.

6. Ingredientes — PRIORIDAD MÁXIMA:
   - Busca en el CATÁLOGO cada ingrediente que necesites. Si el catálogo tiene uno igual o muy similar (singular/plural, con/sin adjetivo), usa el nombre y la unidad EXACTOS del catálogo, sin modificarlos.
   - Ejemplos de equivalencias válidas: catálogo "Tomate" → usa "Tomate" aunque la receta lleve "tomates"; catálogo "Aceite de oliva" → úsalo aunque necesites "aceite de oliva virgen".
   - Solo crea un ingrediente nuevo si en el catálogo no hay ninguno razonablemente equivalente.
   - Ingredientes nuevos (no del catálogo): primera letra mayúscula, resto minúscula.

7. Pasos: detallados, claros, en español. Mínimo 4 pasos.

8. Macros y calorías: estimaciones realistas basadas en los ingredientes reales.

EJEMPLO DE SALIDA VÁLIDA:
{
  "name": "Pasta boloñesa",
  "mealType": "lunch",
  "origin": "Italiana",
  "difficulty": "easy",
  "prepTime": 10,
  "cookTime": 30,
  "servings": 4,
  "ingredients": [
    { "name": "Pasta", "quantity": 400, "unit": "g" },
    { "name": "Carne picada mixta", "quantity": 500, "unit": "g" },
    { "name": "Tomate triturado", "quantity": 400, "unit": "g" },
    { "name": "Cebolla", "quantity": 1, "unit": "ud" },
    { "name": "Aceite de oliva", "quantity": 2, "unit": "cucharada" }
  ],
  "steps": [
    "Picar la cebolla finamente y sofreírla en aceite a fuego medio durante 5 minutos.",
    "Añadir la carne picada y cocinar removiendo hasta que pierda el color rosado.",
    "Incorporar el tomate triturado, salpimentar y dejar cocer a fuego lento 20 minutos.",
    "Cocer la pasta en agua con sal según el paquete. Escurrir y servir con la salsa."
  ],
  "caloriesPerServing": 520,
  "proteinG": 32,
  "fatG": 18,
  "carbsG": 58,
  "costEur": 2.5,
  "notes": null
}

CATÁLOGO DE INGREDIENTES DISPONIBLES (nombre exacto — unidad):
${catalogueLine}`;
}

type CatalogueIngredient = { name: string; defaultUnit: string };

// Corrige unidades "ud" incorrectas basándose en el nombre del ingrediente.
// Solo actúa cuando la unidad es "ud" y el nombre encaja con un patrón conocido.
function fixUnit(name: string, unit: string): string {
  if (unit !== 'ud') return unit;

  const n = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const isLiquid = [
    'leche', 'agua', 'caldo', 'zumo', 'nata', 'aceite', 'vino', 'cerveza',
    'vinagre', 'sirope', 'miel liquida', 'leche de coco', 'bebida',
  ].some((k) => n.includes(k));

  const isSpice = [
    'curry', 'comino', 'pimenton', 'canela', 'curcuma', 'oregano', 'tomillo',
    'romero', 'jengibre', 'pimienta', 'azafran', 'cardamomo', 'clavo',
    'nuez moscada', 'cayena', 'cilantro seco', 'perejil seco', 'albahaca seca',
    'sal ', 'sal$',
  ].some((k) => new RegExp(k).test(n));

  const isHerb = [
    'cilantro fresco', 'perejil fresco', 'albahaca fresca', 'menta', 'hierbabuena',
    'eneldo', 'cebollino', 'cilantro', 'perejil', 'albahaca',
  ].some((k) => n.includes(k));

  const isWeighable = [
    'pollo', 'carne', 'ternera', 'cerdo', 'cordero', 'pavo', 'buey',
    'salmon', 'atun', 'merluza', 'bacalao', 'gambas', 'langostino', 'pescado',
    'arroz', 'pasta', 'fideos', 'espagueti', 'macarron', 'harina',
    'azucar', 'yogur', 'queso', 'mantequilla', 'margarina', 'avena',
    'lentejas', 'garbanzos', 'alubias', 'quinoa', 'cuscus',
  ].some((k) => n.includes(k));

  if (isLiquid)    return 'ml';
  if (isSpice)     return 'tsp';
  if (isHerb)      return 'g';
  if (isWeighable) return 'g';

  return unit; // mantener "ud" si no hay patrón claro (cebolla, tomate, huevo... son ud correcto)
}

export async function generateRecipeFromPrompt(
  userPrompt: string,
  catalogue: CatalogueIngredient[] = [],
): Promise<GeneratedRecipe> {
  if (!ANTHROPIC_API_KEY) throw new Error('API key de Anthropic no configurada.');

  const catalogueLine = catalogue.length > 0
    ? catalogue.map((i) => `${i.name} — ${i.defaultUnit}`).join('\n')
    : '(catálogo vacío)';

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system: buildSystemPrompt(catalogueLine),
      messages: [
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Error de Anthropic: ${err}`);
  }

  const data = await response.json();
  const content: string = data.content[0]?.text ?? '';

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('La IA no devolvió un JSON válido.');

  const parsed = JSON.parse(jsonMatch[0]) as GeneratedRecipe;

  // Post-process: corregir unidades incorrectas
  parsed.ingredients = parsed.ingredients.map((ing) => ({
    ...ing,
    unit: fixUnit(ing.name, ing.unit),
  }));

  // Post-process: cookTime nunca 0
  if (!parsed.cookTime || parsed.cookTime < 1) parsed.cookTime = parsed.prepTime;

  return parsed;
}
