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

REGLAS IMPORTANTES:
- mealType: "breakfast" = desayuno ligero. "lunch" = comida principal del mediodía (pasta, arroz, carnes, guisos). "snack" = merienda ligera. "dinner" = cena ligera.
- Ingredientes: SIEMPRE revisa el catálogo disponible antes de escribir un ingrediente. Si existe uno similar, usa el nombre y unidad EXACTOS del catálogo. Solo inventa un ingrediente nuevo si no existe ninguno parecido en el catálogo.
- Nombres de ingredientes nuevos (no del catálogo): primera letra en mayúscula, el resto en minúscula.
- Genera pasos detallados y claros en español.
- Estima calorías y macros de forma realista.

CATÁLOGO DE INGREDIENTES DISPONIBLES (nombre exacto — unidad):
${catalogueLine}`;
}

type CatalogueIngredient = { name: string; defaultUnit: string };

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

  return JSON.parse(jsonMatch[0]) as GeneratedRecipe;
}
