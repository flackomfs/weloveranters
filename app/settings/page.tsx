export type ThemePalette = {
  id: string;
  name: string;
  colors: [string, string, string];
};

function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const light = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (hue >= 0 && hue < 60) {
    r = c; g = x; b = 0;
  } else if (hue >= 60 && hue < 120) {
    r = x; g = c; b = 0;
  } else if (hue >= 120 && hue < 180) {
    r = 0; g = c; b = x;
  } else if (hue >= 180 && hue < 240) {
    r = 0; g = x; b = c;
  } else if (hue >= 240 && hue < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  const toHex = (value: number) => Math.round((value + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const BASE_THEMES: ThemePalette[] = [
  { id: 'violet-night', name: 'Violet night', colors: ['#8b5cf6', '#ec4899', '#080b18'] },
  { id: 'ocean-current', name: 'Ocean current', colors: ['#06b6d4', '#14b8a6', '#07171c'] },
  { id: 'citrus-grove', name: 'Citrus grove', colors: ['#84cc16', '#f59e0b', '#11170a'] },
  { id: 'ember-glow', name: 'Ember glow', colors: ['#f97316', '#ef4444', '#1b0c0c'] },
  { id: 'blue-hour', name: 'Blue hour', colors: ['#3b82f6', '#a78bfa', '#09101d'] },
  { id: 'rosewood', name: 'Rosewood', colors: ['#f43f5e', '#fb7185', '#1b0b13'] }
];

const GENERATED_THEMES: ThemePalette[] = Array.from({ length: 120 }, (_, index) => {
  const namePool = [
    'Aurora', 'Velvet', 'Nova', 'Solar', 'Bloom', 'Dusk', 'Night', 'Drift', 'Luna', 'Prism',
    'Coral', 'Mist', 'Wave', 'Glow', 'Sky', 'Sunset', 'Forest', 'Neon', 'Harbor', 'Cinder',
    'Bloom', 'Eclipse', 'Cascade', 'Horizon', 'Foam', 'Royal', 'Rose', 'Meadow', 'Comet', 'Orbit', 'Flare'
  ];

  const primaryHue = (index * 17 + 20) % 360;
  const accentHue = (primaryHue + 36 + (index % 9) * 9) % 360;
  const bgHue = (primaryHue + 160) % 360;
  const paletteName = namePool[index % namePool.length];
  const paletteId = `palette-${index + 1}`;

  return {
    id: paletteId,
    name: `${paletteName} ${index + 1}`,
    colors: [
      hslToHex(primaryHue, 78, 58),
      hslToHex(accentHue, 78, 62),
      hslToHex(bgHue, 42, 8)
    ]
  };
});

export const THEME_PALETTES: ThemePalette[] = [...BASE_THEMES, ...GENERATED_THEMES];
export const DEFAULT_THEME = THEME_PALETTES[0];

export function getThemePalette(themeId: unknown) {
  return THEME_PALETTES.find((theme) => theme.id === themeId) || DEFAULT_THEME;
}
