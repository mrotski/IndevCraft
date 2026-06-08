const TILE_SIZE = 16;

const TEXTURE_SOURCES = {
  grass_sides: { src: "../grass_sides.png", fallback: "#61ad3a" },
  grass_top: { src: "../grass_top.png", fallback: "#61ad3a" },
  grass_bottom: { src: "../dirt_all_sides.png", fallback: "#61ad3a" },
  dirt: { src: "../dirt_all_sides.png", fallback: "#6e4726" },
  stone: { src: "../stone_all_sides.png", fallback: "#7a7a7a" },
  sand: { src: "../sand_all_sides.png", fallback: "#c7b873" },
  cobblestone: { src: "../cobblestone_all_sides.png", fallback: "#6b6b6b" },
  water: { src: "../water_top.png", fallback: "#000dff" },
  wood_side: { src: "../wood_log_side.webp", fallback: "#70421a" },
  wood_top: { src: "../wood_log_top.png", fallback: "#94632b" },
  leaves: { src: "../leaves_all_sides.png", fallback: "#398c2e" },
  planks: { src: "../planks_all_sides.png", fallback: "#d1c002" },
  gravel: { src: "../gravel_all_sides.png", fallback: "#6b6b6b" },
  glass: { src: "../glass_all_sides.png", fallback: "#ffffff00" },
};

export async function loadTextureAtlas(scene) {
  const keys = Object.keys(TEXTURE_SOURCES);
  const columns = 4;
  const rows = Math.ceil(keys.length / columns);
  const width = columns * TILE_SIZE;
  const height = rows * TILE_SIZE;
  const dynamicTexture = new BABYLON.DynamicTexture(
    "classic-block-atlas",
    { width, height },
    scene,
    false,
    BABYLON.Texture.NEAREST_SAMPLINGMODE,
  );
  const context = dynamicTexture.getContext();
  context.imageSmoothingEnabled = false;

  const tiles = new Map();
  const previews = new Map();
  for (let index = 0; index < keys.length; index++) {
    const key = keys[index];
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = column * TILE_SIZE;
    const y = row * TILE_SIZE;
    const definition = TEXTURE_SOURCES[key];

    context.fillStyle = definition.fallback;
    context.fillRect(x, y, TILE_SIZE, TILE_SIZE);

    if (definition.src) {
      try {
        const image = await loadImage(new URL(definition.src, import.meta.url).href);
        context.drawImage(image, x, y, TILE_SIZE, TILE_SIZE);
      } catch (error) {
        console.warn(`Using fallback texture for ${key}`, error);
      }
    }

    const inset = 0.001;
    tiles.set(key, {
      u0: x / width + inset,
      v0: y / height + inset,
      u1: (x + TILE_SIZE) / width - inset,
      v1: (y + TILE_SIZE) / height - inset,
    });

    previews.set(key, createPreviewUrl(context, x, y));
  }

  dynamicTexture.update(false);
  dynamicTexture.hasAlpha = true;
  dynamicTexture.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
  dynamicTexture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;

  return {
    texture: dynamicTexture,
    getUV(key) {
      return tiles.get(key) ?? tiles.get("stone");
    },
    getPreviewURL(key) {
      return previews.get(key) ?? previews.get("stone");
    },
  };
}

function createPreviewUrl(sourceContext, x, y) {
  const preview = document.createElement("canvas");
  preview.width = TILE_SIZE;
  preview.height = TILE_SIZE;
  const previewContext = preview.getContext("2d");
  previewContext.imageSmoothingEnabled = false;
  previewContext.drawImage(sourceContext.canvas, x, y, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
  return preview.toDataURL("image/png");
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load ${src}`));
    image.src = src;
  });
}
