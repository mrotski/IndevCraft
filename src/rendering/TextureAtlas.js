const TILE_SIZE = 16;

const TEXTURE_SOURCES = {
  grass_sides: { src: "../grass_sides.png", fallback: "#61ad3a" },
  grass_top: { src: "../grass_top.png", fallback: "#61ad3a" },
  dirt: { src: "../dirt_all_sides.png", fallback: "#6e4726" },
  stone: { src: "../stone_all_sides.png", fallback: "#7a7a7a" },
  sand: { src: "../sand_all_sides.png", fallback: "#c7b873" },
  cobblestone: { src: "../cobblestone_all_sides.png", fallback: "#6b6b6b" },
  water: { src: "../water_top.png", fallback: "#000dff" },
  coal_ore: { src: "../coal_ore_all_sides.png", fallback: "#383838" },
  iron_ore: { src: "../iron_ore_all_sides.png", fallback: "#b89c75" },
  wood_side: { src: "../wood_log_side.webp", fallback: "#70421a" },
  wood_top: { src: "../wood_log_top.png", fallback: "#94632b" },
  leaves: { src: "../leaves_all_sides.png", fallback: "#398c2e" },
  planks: { src: "../planks_all_sides.png", fallback: "#d1c002" },
  gravel: { src: "../gravel_all_sides.png", fallback: "#6b6b6b" },
  glass: { src: "../glass_all_sides.png", fallback: "#ffffff00" },
};

export async function loadTextureAtlas() {
  const keys = Object.keys(TEXTURE_SOURCES);
  const columns = 4;
  const rows = Math.ceil(keys.length / columns);
  const width = columns * TILE_SIZE;
  const height = rows * TILE_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
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
    if (key === "coal_ore" && definition.src) {
      // keep the source image as-is; the fallback pattern only applies if the image fails to load
    } else if (key === "iron_ore" && definition.src) {
      // keep the source image as-is; the fallback pattern only applies if the image fails to load
    } else if (key === "coal_ore") {
      paintOrePattern(context, x, y, TILE_SIZE, "#1a1a1a", "#5d5d5d", 18);
    } else if (key === "iron_ore") {
      paintOrePattern(context, x, y, TILE_SIZE, "#73583a", "#d4b48a", 18);
    }

    const inset = 0.001;
    tiles.set(key, {
      u0: x / width + inset,
      v0: 1 - (y + TILE_SIZE) / height + inset,
      u1: (x + TILE_SIZE) / width - inset,
      v1: 1 - y / height - inset,
    });

    previews.set(key, createPreviewUrl(context, x, y));
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  return {
    texture,
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

function paintOrePattern(context, x, y, size, background, fleckColor, fleckCount) {
  context.fillStyle = background;
  context.fillRect(x, y, size, size);

  const positions = [
    [1, 2], [2, 1], [4, 3], [6, 2], [8, 4], [11, 2], [13, 5], [3, 8],
    [6, 9], [9, 8], [12, 10], [2, 12], [5, 13], [10, 12], [14, 13], [7, 14],
    [1, 6], [14, 2],
  ];

  context.fillStyle = fleckColor;
  for (let i = 0; i < Math.min(fleckCount, positions.length); i++) {
    const [dx, dy] = positions[i];
    context.fillRect(x + dx, y + dy, 2, 2);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load ${src}`));
    image.src = src;
  });
}
