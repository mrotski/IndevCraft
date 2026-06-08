import { CHUNK_SIZE, LOAD_RADIUS, SEA_LEVEL, UNLOAD_RADIUS, WORLD_HEIGHT } from "../constants.js";
import { Blocks } from "../blocks/BlockTypes.js";
import { hash32, randomFloat } from "../utils/Random.js";
import { Chunk } from "./Chunk.js";
import { TerrainGenerator } from "./TerrainGenerator.js";
import { CaveGenerator } from "./CaveGenerator.js";
import { LightEngine } from "./LightEngine.js";
import { MeshBuilder } from "../rendering/MeshBuilder.js";

export class ChunkManager {
  constructor(scene, saveManager, seed, textureAtlas) {
    this.scene = scene;
    this.saveManager = saveManager;
    this.seed = seed >>> 0;
    this.chunks = new Map();
    this.pending = [];
    this.terrain = new TerrainGenerator(this.seed);
    this.caves = new CaveGenerator(this.seed, this.terrain);
    this.lightEngine = new LightEngine();
    this.meshBuilder = new MeshBuilder(scene, this, textureAtlas);
    this.renderDistance = LOAD_RADIUS;
  }

  update(playerPosition) {
    const playerChunk = this.worldToChunk(playerPosition.x, playerPosition.z);
    this.queueNearbyChunks(playerChunk.cx, playerChunk.cz);
    this.generatePending(2);
    this.unloadFarChunks(playerChunk.cx, playerChunk.cz);
    this.rebuildDirtyMeshes(4);
  }

  queueNearbyChunks(centerCx, centerCz) {
    for (let radius = 0; radius <= this.renderDistance; radius++) {
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
          const cx = centerCx + dx;
          const cz = centerCz + dz;
          const key = this.key(cx, cz);
          if (!this.chunks.has(key) && !this.pending.includes(key)) {
            this.pending.push(key);
          }
        }
      }
    }
  }

  generatePending(budget) {
    for (let i = 0; i < budget && this.pending.length; i++) {
      const key = this.pending.shift();
      if (this.chunks.has(key)) continue;
      const [cx, cz] = key.split(",").map(Number);
      const chunk = new Chunk(cx, cz);
      this.terrain.generateBase(chunk);
      this.caves.carve(chunk);
      this.addVegetation(chunk);
      this.applySavedChanges(chunk);
      this.lightEngine.compute(chunk);
      chunk.hasGenerated = true;
      this.chunks.set(key, chunk);
      this.markNeighborsDirty(cx, cz);
    }
  }

  rebuildDirtyMeshes(budget) {
    let rebuilt = 0;
    for (const chunk of this.chunks.values()) {
      if (!chunk.dirty) continue;
      this.lightEngine.compute(chunk);
      this.meshBuilder.build(chunk);
      rebuilt++;
      if (rebuilt >= budget) return;
    }
  }

  unloadFarChunks(centerCx, centerCz) {
    for (const [key, chunk] of this.chunks) {
      const distance = Math.max(Math.abs(chunk.cx - centerCx), Math.abs(chunk.cz - centerCz));
      if (distance > UNLOAD_RADIUS) {
        chunk.dispose();
        this.chunks.delete(key);
      }
    }
  }

  addVegetation(chunk) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const worldX = chunk.cx * CHUNK_SIZE + x;
        const worldZ = chunk.cz * CHUNK_SIZE + z;
        const topY = this.findSurfaceY(chunk, x, z);
        if (topY <= SEA_LEVEL || topY >= WORLD_HEIGHT - 8) continue;

        const roll = randomFloat(this.seed ^ 0x51a7, worldX, 0, worldZ);
        if (roll > 0.975) {
          this.placeTree(chunk, x, topY + 1, z);
        }
      }
    }
  }

  findSurfaceY(chunk, x, z) {
    for (let y = WORLD_HEIGHT - 2; y > 1; y--) {
      const block = chunk.getBlock(x, y, z);
      if (block === Blocks.GRASS || block === Blocks.SAND || block === Blocks.DIRT || block === Blocks.STONE) {
        return y;
      }
    }
    return 0;
  }

  placeTree(chunk, x, y, z) {
    if (x < 2 || x > CHUNK_SIZE - 3 || z < 2 || z > CHUNK_SIZE - 3) return;
    const height = 4 + (hash32(this.seed ^ 0x777, chunk.cx * CHUNK_SIZE + x, y, chunk.cz * CHUNK_SIZE + z) % 2);
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

  applySavedChanges(chunk) {
    const changes = this.saveManager.getChunkChanges(this.key(chunk.cx, chunk.cz));
    if (!changes) return;
    for (const [index, blockId] of Object.entries(changes)) {
      chunk.blocks[Number(index)] = blockId;
    }
  }

  getBlock(worldX, worldY, worldZ) {
    if (worldY < 0 || worldY >= WORLD_HEIGHT) return Blocks.AIR;
    const { cx, cz, lx, lz } = this.worldToLocal(worldX, worldZ);
    const chunk = this.chunks.get(this.key(cx, cz));
    if (!chunk) return Blocks.AIR;
    return chunk.getBlock(lx, Math.floor(worldY), lz);
  }

  setBlock(worldX, worldY, worldZ, blockId) {
    if (worldY < 0 || worldY >= WORLD_HEIGHT) return false;
    const { cx, cz, lx, lz } = this.worldToLocal(worldX, worldZ);
    const chunk = this.chunks.get(this.key(cx, cz));
    if (!chunk) return false;
    const y = Math.floor(worldY);
    if (!chunk.setBlock(lx, y, lz, blockId)) return false;
    const localIndex = Chunk.index(lx, y, lz);
    this.saveManager.setBlockChange(this.key(cx, cz), localIndex, blockId);
    this.markNeighborsDirty(cx, cz);
    this.lightEngine.compute(chunk);
    this.meshBuilder.build(chunk);
    return true;
  }
    if (worldY < 0 || worldY >= WORLD_HEIGHT) return 0;
    const { cx, cz, lx, lz } = this.worldToLocal(worldX, worldZ);
    const chunk = this.chunks.get(this.key(cx, cz));
    if (!chunk) return 15;
    return chunk.getSunLight(lx, Math.floor(worldY), lz);
  }

  getBlockLight(worldX, worldY, worldZ) {
    if (worldY < 0 || worldY >= WORLD_HEIGHT) return 0;
    const { cx, cz, lx, lz } = this.worldToLocal(worldX, worldZ);
    const chunk = this.chunks.get(this.key(cx, cz));
    if (!chunk) return 0;
    return chunk.getBlockLight(lx, Math.floor(worldY), lz);
  }

  findSpawn() {
    return this.findSurfacePosition(0, 0);
  }

  findSurfacePosition(worldX, worldZ) {
    for (let y = WORLD_HEIGHT - 2; y > SEA_LEVEL; y--) {
      const block = this.getBlock(worldX, y, worldZ);
      if (block !== Blocks.AIR && block !== Blocks.WATER) {
        return new BABYLON.Vector3(Math.floor(worldX) + 0.5, y + 3, Math.floor(worldZ) + 0.5);
      }
    }
    return new BABYLON.Vector3(Math.floor(worldX) + 0.5, SEA_LEVEL + 20, Math.floor(worldZ) + 0.5);
  }

  prepareAreaAround(worldX, worldZ, budget = 25) {
    const { cx, cz } = this.worldToChunk(worldX, worldZ);
    this.queueNearbyChunks(cx, cz);
    this.generatePending(budget);
    this.rebuildDirtyMeshes(budget);
  }

  raycast(origin, direction, maxDistance = 6) {
    const rayDirection = direction.normalize();
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);
    const stepX = rayDirection.x > 0 ? 1 : -1;
    const stepY = rayDirection.y > 0 ? 1 : -1;
    const stepZ = rayDirection.z > 0 ? 1 : -1;
    const deltaX = rayDirection.x === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / rayDirection.x);
    const deltaY = rayDirection.y === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / rayDirection.y);
    const deltaZ = rayDirection.z === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / rayDirection.z);
    let maxX = rayDirection.x === 0 ? Number.POSITIVE_INFINITY : ((stepX > 0 ? x + 1 : x) - origin.x) / rayDirection.x;
    let maxY = rayDirection.y === 0 ? Number.POSITIVE_INFINITY : ((stepY > 0 ? y + 1 : y) - origin.y) / rayDirection.y;
    let maxZ = rayDirection.z === 0 ? Number.POSITIVE_INFINITY : ((stepZ > 0 ? z + 1 : z) - origin.z) / rayDirection.z;
    let distance = 0;
    let normal = { x: 0, y: 0, z: 0 };

    while (distance <= maxDistance) {
      const block = this.getBlock(x, y, z);
      if (block !== Blocks.AIR && block !== Blocks.WATER) {
        return {
          x,
          y,
          z,
          block,
          normal,
          place: { x: x + normal.x, y: y + normal.y, z: z + normal.z },
        };
      }

      if (maxX < maxY && maxX < maxZ) {
        x += stepX;
        distance = maxX;
        maxX += deltaX;
        normal = { x: -stepX, y: 0, z: 0 };
      } else if (maxY < maxZ) {
        y += stepY;
        distance = maxY;
        maxY += deltaY;
        normal = { x: 0, y: -stepY, z: 0 };
      } else {
        z += stepZ;
        distance = maxZ;
        maxZ += deltaZ;
        normal = { x: 0, y: 0, z: -stepZ };
      }
    }
    return null;
  }

  markNeighborsDirty(cx, cz) {
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const chunk = this.chunks.get(this.key(cx + dx, cz + dz));
        if (chunk) chunk.dirty = true;
      }
    }
  }

  shiftWorldOrigin(delta) {
    for (const chunk of this.chunks.values()) {
      if (!chunk.mesh) continue;
      chunk.mesh.position.subtractInPlace(delta);
    }
  }

  worldToChunk(x, z) {
    return {
      cx: Math.floor(x / CHUNK_SIZE),
      cz: Math.floor(z / CHUNK_SIZE),
    };
  }

  worldToLocal(x, z) {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    return {
      cx,
      cz,
      lx: ((Math.floor(x) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
      lz: ((Math.floor(z) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
    };
  }

  key(cx, cz) {
    return `${cx},${cz}`;
  }
}
