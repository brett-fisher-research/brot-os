import { promises as fs } from 'node:fs';
import { FEATURES_PATH } from './paths';

export type Feature = {
  label: string;
  href: string;
  // Emoji (e.g. "📚") rendered as text, OR an image path (e.g. "/bookshelf/icon-192.png")
  // rendered as <img>. The sidebar decides by whether it starts with "/".
  icon?: string;
  // Present for promoted experiments; absent for built-in pages.
  slug?: string;
};

// Read data/platform-features.json at request time (the route is `force-dynamic`), so
// promoting/demoting an experiment shows up with no rebuild of this app.
export async function readFeatures(): Promise<Feature[]> {
  let raw: string;
  try {
    raw = await fs.readFile(FEATURES_PATH, 'utf8');
  } catch {
    return [];
  }
  try {
    const parsed: { features?: Feature[] } = JSON.parse(raw);
    return Array.isArray(parsed.features) ? parsed.features : [];
  } catch {
    return [];
  }
}
