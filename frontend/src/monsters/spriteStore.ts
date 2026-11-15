import type { CreatureMeta, ThemeManifest } from "./types";

const BASE = "/art/monsters/";

/** A loaded creature: its manifest entry, sheet URL and size, and the bounds of its resting pose. */
export type SpriteData = {
  id: string;
  themeId: string;
  palette: string[];
  creature: CreatureMeta;
  url: string;
  sheetW: number;
  sheetH: number;
  /** Bounding box of the idle frames' opaque pixels, in frame pixels. */
  bbox: { left: number; top: number; right: number; bottom: number };
};

const manifests = new Map<string, Promise<ThemeManifest | null>>();
const sprites = new Map<string, Promise<SpriteData | null>>();
const resolved = new Map<string, SpriteData | null>();

function loadManifest(themeId: string): Promise<ThemeManifest | null> {
  let pending = manifests.get(themeId);
  if (!pending) {
    pending = fetch(`${BASE}${themeId}/manifest.json`)
      .then((response) => (response.ok ? (response.json() as Promise<ThemeManifest>) : null))
      .catch(() => null);
    manifests.set(themeId, pending);
  }
  return pending;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

function measure(image: HTMLImageElement, creature: CreatureMeta): SpriteData["bbox"] {
  const { w, h } = creature.frame;
  const fallback = { left: 0, top: 0, right: w, bottom: h };
  try {
    const canvas = document.createElement("canvas");
    canvas.width = w * creature.animations.idle.frames;
    canvas.height = h;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return fallback;
    context.drawImage(image, 0, creature.animations.idle.row * h, canvas.width, h, 0, 0, canvas.width, h);
    const { data } = context.getImageData(0, 0, canvas.width, h);
    const box = { left: w, top: h, right: 0, bottom: 0 };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < canvas.width; x++) {
        if (data[(y * canvas.width + x) * 4 + 3] === 0) continue;
        const fx = x % w;
        if (fx < box.left) box.left = fx;
        if (fx + 1 > box.right) box.right = fx + 1;
        if (y < box.top) box.top = y;
        if (y + 1 > box.bottom) box.bottom = y + 1;
      }
    }
    return box.right > box.left ? box : fallback;
  } catch {
    return fallback;
  }
}

/** Loads a sprite by "<theme>/<creature>". Manifests and images are fetched once and cached. Resolves to null on any failure. */
export function loadSprite(spriteId: string): Promise<SpriteData | null> {
  let pending = sprites.get(spriteId);
  if (pending) return pending;
  const [themeId, creatureId] = spriteId.split("/");
  pending = (async () => {
    if (!themeId || !creatureId) return null;
    const manifest = await loadManifest(themeId);
    const creature = manifest?.creatures.find((item) => item.id === creatureId);
    if (!manifest || !creature) return null;
    const url = BASE + creature.sheet;
    const image = await loadImage(url);
    if (!image) return null;
    return { id: spriteId, themeId, palette: manifest.palette, creature, url, sheetW: image.naturalWidth, sheetH: image.naturalHeight, bbox: measure(image, creature) };
  })().then((data) => {
    resolved.set(spriteId, data);
    return data;
  });
  sprites.set(spriteId, pending);
  return pending;
}

/** The sprite if it has finished loading, null if loading failed or there is none, undefined if it is not loaded yet. */
export function peekSprite(spriteId: string | undefined): SpriteData | null | undefined {
  if (!spriteId) return null;
  return resolved.get(spriteId);
}
