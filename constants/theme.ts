export const C = {
  // ── Brand colours ─────────────────────────────────────────────────────────
  primary:       '#5AC8FA', // walnut brown  (CTAs, active tab, buttons)
  primaryLight:  '#a9e4ff', // caramel        (secondary actions)
  primaryDark:   '#2992c2', // espresso       (pressed states)

  // ── Backgrounds ───────────────────────────────────────────────────────────
  bgPage:        '#e6e6e6', // warm beige     (screen backgrounds)
  bgSurface:     '#f7f7f7', // cream          (cards, modals, tab bar)
  bgCard:        '#f7f7f7', // warm amber     (recipe cards)
  bgInput:       '#f7f7f7', // pale cream     (text inputs)

  // ── Borders & dividers ────────────────────────────────────────────────────
  border:        '#c6edff', // tan            (hairline dividers, input borders)
  borderStrong:  '#50c8ff', // darker tan     (card outlines)

  // ── Text ──────────────────────────────────────────────────────────────────
  textPrimary:   '#383838', // dark espresso  (headings, primary labels)
  textSecondary: '#4e4e4e', // medium brown   (secondary labels, values)
  textMuted:     '#bdbdbd', // khaki          (placeholders, timestamps)

  // ── Semantic ──────────────────────────────────────────────────────────────
  danger:        '#B8312F', // brick red      (delete, error)
  success:       '#4E7A3A', // forest green   (online badge bg text)
  successBg:     '#EAF2E5', // pale green     (online badge background)
  infoBg:        '#E5EEF5', // pale blue      (store badge background)
  info:          '#2E6490', // steel blue     (store badge text)
};

export const FONT = {
  // System sans-serif (SF Pro on iOS, Roboto on Android)
  serif:      undefined as undefined,
  sans:       undefined as undefined,
};

// ── Border radius tokens ──────────────────────────────────────────────────────
export const RADIUS = {
  xs:   8,
  sm:   12,
  md:   16,
  lg:   20,
  xl:   24,
  pill: 50,
};

// ── Shadow tokens ─────────────────────────────────────────────────────────────
export const SHADOW = {
  sm: {
    elevation: 2,
    shadowColor: '#3D2B1F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
  },
  md: {
    elevation: 4,
    shadowColor: '#3D2B1F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
  },
  lg: {
    elevation: 8,
    shadowColor: '#3D2B1F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  up: {
    elevation: 8,
    shadowColor: '#3D2B1F',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.09,
    shadowRadius: 12,
  },
};
