import { CHUNK_SIZE, WORLD_HEIGHT } from "./constants.js";
import { SaveManager } from "./storage/SaveManager.js";
import { ChunkManagerThree } from "./world/ChunkManager_three.js";

export async function startGame() {
  const canvas = document.getElementById("gameCanvas");
  const loading = document.getElementById("loading");

  if (!window.THREE) {
    loading.innerHTML = "<strong>Three.js failed to load.</strong><span>Check your network connection and reload.</span>";
    throw new Error("Three.js unavailable");
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x6faddb);
  scene.fog = new THREE.Fog(0x6faddb, 34, 70);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(8, 20, 32);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x443322, 0.9);
  scene.add(hemi);

  const saveManager = new SaveManager();
  if (!saveManager.data) {
    const seed = Math.floor(Math.random() * 0xffffffff);
    saveManager.create(seed);
  }

  const textureAtlas = await loadTextureAtlasThree();
  const chunkManager = new ChunkManagerThree(scene, saveManager, saveManager.seed, textureAtlas);

  // generate a few chunks around origin for the prototype
  chunkManager.queueNearbyChunks(0, 0);
  chunkManager.generatePending(64);
  chunkManager.rebuildDirtyMeshes(64);

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  window.addEventListener("resize", onResize);

  loading.classList.add("hidden");

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();
}

async function loadTextureAtlasThree() {
  // Minimal canvas atlas similar to the Babylon loader
  const TILE_SIZE = 16;
  const TEXTURE_SOURCES = {
    stone: { src: "../stone_all_sides.png", fallback: "#7a7a7a" },
    dirt: { src: "../dirt_all_sides.png", fallback: "#6e4726" },
    grass_sides: { src: "../grass_sides.png", fallback: "#61ad3a" },
    grass_top: { src: "../grass_top.png", fallback: "#61ad3a" },
    water: { src: "../water_top.png", fallback: "#000dff" },
    coal_ore: { src: null, fallback: "#383838" },
    iron_ore: { src: null, fallback: "#b89c75" },
    glass: { src: "../glass_all_sides.png", fallback: "#ffffff00" },
  };

  const keys = Object.keys(TEXTURE_SOURCES);
  const columns = 4;
  const rows = Math.ceil(keys.length / columns);
  const width = columns * TILE_SIZE;
  const height = rows * TILE_SIZE;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const tiles = new Map();
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = col * TILE_SIZE;
    const y = row * TILE_SIZE;
    const def = TEXTURE_SOURCES[key];
    ctx.fillStyle = def.fallback;
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    if (def.src) {
      try {
        const img = await loadImage(new URL(def.src, import.meta.url).href);
        ctx.drawImage(img, x, y, TILE_SIZE, TILE_SIZE);
      } catch (e) {
        console.warn(`Atlas: using fallback for ${key}`, e);
      }
    }
    if (key === "coal_ore") {
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = "#5d5d5d";
      ctx.fillRect(x + 2, y + 3, 2, 2);
      ctx.fillRect(x + 8, y + 6, 2, 2);
      ctx.fillRect(x + 12, y + 10, 2, 2);
    } else if (key === "iron_ore") {
      ctx.fillStyle = "#73583a";
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = "#d4b48a";
      ctx.fillRect(x + 2, y + 3, 2, 2);
      ctx.fillRect(x + 8, y + 6, 2, 2);
      ctx.fillRect(x + 12, y + 10, 2, 2);
    }
    const inset = 0.001;
    tiles.set(key, { u0: x / width + inset, v0: y / height + inset, u1: (x + TILE_SIZE) / width - inset, v1: (y + TILE_SIZE) / height - inset });
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.needsUpdate = true;

  return {
    texture,
    getUV(key) {
      return tiles.get(key) ?? tiles.get("stone");
    },
    getPreviewURL() {
      return canvas.toDataURL();
    },
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}
