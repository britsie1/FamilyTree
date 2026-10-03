import type { Gender } from '../types/tree';

const SILHOUETTE_PATHS = {
  male: '<path d="M48 132c3-24 15-34 39-39l9-10h28l9 10c24 5 36 15 39 39H48Z M97 73h26v22c-7 9-19 9-26 0V73Z M84 48c0-22 11-33 26-33s26 11 26 33l-3 18c-3 15-12 24-23 24s-20-9-23-24l-3-18Z" fill="#7894b0"/><path d="M84 49c-4-22 9-37 26-37 20 0 30 15 26 37l-7-15c-14 4-25 3-35-1l-10 16Z" fill="#607f9e"/>',
  female: '<path d="M76 51c0-25 12-39 34-39s34 14 34 39l6 45c-23 12-57 12-80 0l6-45Z" fill="#a67f8d"/><path d="M48 132c3-24 17-34 42-39l8-12h24l8 12c25 5 39 15 42 39H48Z M98 73h24v22c-6 9-18 9-24 0V73Z M87 47c0-18 9-29 23-29s23 11 23 29l-3 20c-3 14-10 23-20 23s-17-9-20-23l-3-20Z" fill="#bc97a3"/><path d="M83 50c-3-25 10-35 27-35 19 0 29 14 27 36-12-3-23-14-27-24-5 12-16 21-27 23Z" fill="#a67f8d"/>',
  neutral: '<path d="M48 132c3-25 19-35 44-40l7-12h22l7 12c25 5 41 15 44 40H48Z M98 73h24v22c-6 9-18 9-24 0V73Z M85 48c0-23 10-35 25-35s25 12 25 35l-3 19c-3 14-11 23-22 23s-19-9-22-23l-3-19Z" fill="#9aa5b1"/>',
};

const SILHOUETTE_URLS = Object.fromEntries(Object.entries(SILHOUETTE_PATHS).map(([variant, paths]) => [
  variant,
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 132"><ellipse cx="110" cy="132" rx="92" ry="56" fill="#94a3b8" opacity=".12"/>${paths}</svg>`)}`,
]));

/** Embedded artwork works offline and stays self-contained in tree exports. */
export function getPersonSilhouetteUrl(gender?: Gender): string {
  const variant = gender === 'male' || gender === 'female' ? gender : 'neutral';
  return SILHOUETTE_URLS[variant];
}