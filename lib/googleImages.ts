const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_CSE_KEY ?? '';
const CX      = process.env.EXPO_PUBLIC_GOOGLE_CSE_CX ?? '';

// Google CSE returns max 10 results per request.
// Pagination uses `start` (1-indexed): page 1 → start=1, page 2 → start=11, etc.
const PER_PAGE = 10;

export type GoogleImage = {
  title: string;
  link: string;        // full-resolution image URL (stored as photoUri)
  thumbnail: string;   // small thumbnail for the grid
  contextLink: string; // source page URL
};

export async function searchGoogleImages(
  query: string,
  page = 1,
): Promise<GoogleImage[]> {
  if (!API_KEY || !CX) throw new Error('Google CSE no configurado.');

  const start = (page - 1) * PER_PAGE + 1;
  const url =
    `https://www.googleapis.com/customsearch/v1` +
    `?key=${API_KEY}` +
    `&cx=${CX}` +
    `&q=${encodeURIComponent(query)}` +
    `&searchType=image` +
    `&num=${PER_PAGE}` +
    `&start=${start}` +
    `&safe=active`;

  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Error Google CSE: ${res.status}`);
  }

  const data = await res.json();
  return (data.items ?? []).map((item: any): GoogleImage => ({
    title: item.title ?? '',
    link: item.link ?? '',
    thumbnail: item.image?.thumbnailLink ?? item.link ?? '',
    contextLink: item.image?.contextLink ?? '',
  }));
}

export async function getFirstGoogleImage(query: string): Promise<string | null> {
  try {
    const images = await searchGoogleImages(query, 1);
    return images[0]?.link ?? null;
  } catch {
    return null;
  }
}
