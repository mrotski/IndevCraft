import { CHUNK_SIZE, SEA_LEVEL, WORLD_HEIGHT } from "../constants.js";
import { Blocks } from "../blocks/BlockTypes.js";
import { TerrainGenerator } from "./TerrainGenerator.js";
import { CaveGenerator } from "./CaveGenerator.js";
import { LightEngine } from "./LightEngine.js";
import { Chunk } from "./Chunk.js";

const terrain = new TerrainGenerator(0);
const caves = new CaveGenerator(0, terrain);
const lightEngine = new LightEngine();

self.onmessage = (event) => {
  const { type, payload } = event.data || {};
  if (type !== "generate") return;

  const { seed, cx, cz, key } = payload || {};
  const effectiveSeed = Number(seed) >>> 0;
  const terrainGenerator = new TerrainGenerator(effectiveSeed);
  const caveGenerator = new CaveGenerator(effectiveSeed, terrainGenerator);
  const chunk = new Chunk(cx, cz);

  terrainGenerator.generateBase(chunk);
  caveGenerator.carve(chunk);
  addVegetation(chunk, effectiveSeed, terrainGenerator);
  lightEngine.compute(chunk);

  self.postMessage({
    type: "chunk-ready",
    key,
    cx,
    cz,
    blocks: Array.from(chunk.blocks),
    sunLight: Array.from(chunk.sunLight),
    blockLight: Array.from(chunk.blockLight),
  });
};

function addVegetation(chunk, seed, terrainGenerator) {
  for (let z = 0; z < CHUNK_SIZE; z++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const worldX = chunk.cx * CHUNK_SIZE + x;
      const worldZ = chunk.cz * CHUNK_SIZE + z;
      const topY = findSurfaceY(chunk, terrainGenerator, x, z);
      if (topY <= SEA_LEVEL || topY >= WORLD_HEIGHT - 8) continue;

      const roll = Math.sin(worldX * 127.1 + worldZ * 311.7 + seed * 0.987654) * 43758.5453;
      const noise = roll - Math.floor(roll);
      if (noise > 0.975) {
        placeTree(chunk, x, topY + 1, z, seed);
      }
    }
  }
}

function findSurfaceY(chunk, terrainGenerator, x, z) {
  for (let y = WORLD_HEIGHT - 2; y > 1; y--) {
    const block = chunk.getBlock(x, y, z);
    if (block === Blocks.GRASS || block === Blocks.SAND || block === Blocks.DIRT || block === Blocks.STONE) {
      return y;
    }
  }
  return 0;
}

function placeTree(chunk, x, y, z, seed) {
  if (x < 2 || x > CHUNK_SIZE - 3 || z < 2 || z > CHUNK_SIZE - 3) return;
  const height = 4 + (Math.floor(Math.abs(Math.sin(seed + x * 13.2 + z * 7.1)) * 2));
  for (let yy = 0; yy < height; yy++) {
    chunk.setBlock(x, y + yy, z, Blocks.WOOD);
  }
  const leafBase = y + height - 2;
  for (let yy = 0; yy < 4; yy++) {
    const radius = yy === 3 ? 1 : 2;
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) === radius && Math.abs(dz) === radius && yy > 0) continue;
        const lx = x + dx;
        const ly = leafBase + yy;
        const lz = z + dz;
        if (!chunk.inBounds(lx, ly, lz)) continue;
        if (chunk.getBlock(lx, ly, lz) === Blocks.AIR) chunk.setBlock(lx, ly, lz, Blocks.LEAVES);
      }
    }
  }
}
