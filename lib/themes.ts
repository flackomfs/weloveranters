export type ThemePalette = {
  id: string;
  name: string;
  colors: [string, string, string];
};

export const THEME_PALETTES: ThemePalette[] = [
  { id: 'violet-night', name: 'Violet night', colors: ['#8b5cf6', '#ec4899', '#080b18'] },
  { id: 'ocean-current', name: 'Ocean current', colors: ['#06b6d4', '#14b8a6', '#07171c'] },
  { id: 'citrus-grove', name: 'Citrus grove', colors: ['#84cc16', '#f59e0b', '#11170a'] },
  { id: 'ember-glow', name: 'Ember glow', colors: ['#f97316', '#ef4444', '#1b0c0c'] },
  { id: 'blue-hour', name: 'Blue hour', colors: ['#3b82f6', '#a78bfa', '#09101d'] },
  { id: 'rosewood', name: 'Rosewood', colors: ['#f43f5e', '#fb7185', '#1b0b13'] }
];

export const DEFAULT_THEME = THEME_PALETTES[0];

export function getThemePalette(themeId: unknown) {
  return THEME_PALETTES.find((theme) => theme.id === themeId) || DEFAULT_THEME;
}