export const C = {
  // ── Brand colours ─────────────────────────────────────────────────────────
  primary:       '#40db64', // verde brillante   (CTAs, active tab, buttons)
  primaryLight:  '#ecfdf4', // verde muy claro   (fondos cards, chips)
  primaryDark:   '#31A64C', // verde oscuro      (pressed states, gradients)

  // ── Backgrounds ───────────────────────────────────────────────────────────
  bgPage:        '#FAFAFA', // near-white        (screen backgrounds)
  bgSurface:     '#FFFFFF', // white             (cards, modals, tab bar)
  bgCard:        '#ecfdf4', // tinte verde suave (tag pills, chips)
  bgInput:       '#FFFFFF', // white             (text inputs)

  // ── Borders & dividers ────────────────────────────────────────────────────
  border:        '#F0F0F0', // light gray        (hairline dividers, input borders)
  borderStrong:  '#40db64', // green             (chip outlines, checkbox border)

  // ── Text ──────────────────────────────────────────────────────────────────
  textPrimary:   '#212121', // dark              (headings, primary labels)
  textSecondary: '#757575', // medium gray       (secondary labels, values)
  textMuted:     '#BDBDBD', // light gray        (placeholders, timestamps)

  // ── Semantic ──────────────────────────────────────────────────────────────
  danger:        '#E53935', // red               (delete, error)
  success:       '#40db64', // green             (online badge text)
  successBg:     '#ecfdf4', // light green       (online badge background)
  infoBg:        '#ECEFF1', // light blue-gray   (store badge background)
  info:          '#546E7A', // blue-gray         (store badge text, protein)

  // ── New tokens ────────────────────────────────────────────────────────────
  accent:        '#FF7043', // orange            (FAB, favorites icon)
  warning:       '#FFB300', // amber             (fat macro)
};

export const FONT = {
  serif: 'Georgia',         // section titles, modal titles, day labels
  sans:  undefined as undefined,
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
    elevation: 3,
    shadowColor: '#40db64',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
  },
  md: {
    elevation: 5,
    shadowColor: '#40db64',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
  },
  lg: {
    elevation: 8,
    shadowColor: '#40db64',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
  },
  up: {
    elevation: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
  },
  fab: {
    elevation: 8,
    shadowColor: '#FF7043',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.40,
    shadowRadius: 20,
  },
  activePill: {
    elevation: 6,
    shadowColor: '#40db64',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.33,
    shadowRadius: 14,
  },
};
