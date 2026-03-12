export const C = {
  // ── Brand colours ─────────────────────────────────────────────────────────
  primary:       '#7C5028', // walnut brown  (CTAs, active tab, buttons)
  primaryLight:  '#A67C52', // caramel        (secondary actions)
  primaryDark:   '#4E3018', // espresso       (pressed states)

  // ── Backgrounds ───────────────────────────────────────────────────────────
  bgPage:        '#F5EDE0', // warm beige     (screen backgrounds)
  bgSurface:     '#FFFBF4', // cream          (cards, modals, tab bar)
  bgCard:        '#F0E2C8', // warm amber     (recipe cards)
  bgInput:       '#FDF7EF', // pale cream     (text inputs)

  // ── Borders & dividers ────────────────────────────────────────────────────
  border:        '#DEC9A8', // tan            (hairline dividers, input borders)
  borderStrong:  '#C4A882', // darker tan     (card outlines)

  // ── Text ──────────────────────────────────────────────────────────────────
  textPrimary:   '#3D2B1F', // dark espresso  (headings, primary labels)
  textSecondary: '#7D6246', // medium brown   (secondary labels, values)
  textMuted:     '#A89070', // khaki          (placeholders, timestamps)

  // ── Semantic ──────────────────────────────────────────────────────────────
  danger:        '#B8312F', // brick red      (delete, error)
  success:       '#4E7A3A', // forest green   (online badge bg text)
  successBg:     '#EAF2E5', // pale green     (online badge background)
  infoBg:        '#E5EEF5', // pale blue      (store badge background)
  info:          '#2E6490', // steel blue     (store badge text)
};

export const FONT = {
  // System serif (Georgia on iOS, serif fallback on Android)
  // Use for headings and recipe names
  serif:      'Georgia' as const,
  // System sans-serif (San Francisco on iOS, Roboto on Android)
  sans:       undefined as undefined,
};
