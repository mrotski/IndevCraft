import { CHUNK_SIZE, LOAD_RADIUS, SEA_LEVEL, WORLD_HEIGHT } from "../constants.js";
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
    this.pendingSet = new Set();
    this.terrain = new TerrainGenerator(this.seed);
    this.caves = new CaveGenerator(this.seed, this.terrain);
    this.lightEngine = new LightEngine();
    this.meshBuilder = new MeshBuilder(scene, this, textureAtlas);
    this.renderDistance = LOAD_RADIUS;
    this.lastPlayerChunkKey = null;
    this.lastQueuedRenderDistance = this.renderDistance;
    this.dirtyQueue = [];
    this.dirtySet = new Set();
    this.workAccumulator = 0;
    this.waterAccumulator = 0;
    this.waterFlowQueue = [];
    this.waterFlowSet = new Set();
    this.generatingSet = new Set();
    this.chunkReadyResolvers = new Map();
    this.worker = null;
    this.workerFallback = false;
    this.createWorker();
  }

  update(playerPosition, deltaSeconds = 0) {
    const playerChunk = this.worldToChunk(playerPosition.x, playerPosition.z);
    const chunkKey = this.key(playerChunk.cx, playerChunk.cz);
    const needsStreamingUpdate = chunkKey !== this.lastPlayerChunkKey || this.lastQueuedRenderDistance !== this.renderDistance;
    if (needsStreamingUpdate) {
      this.queueNearbyChunks(playerChunk.cx, playerChunk.cz);
      this.unloadFarChunks(playerChunk.cx, playerChunk.cz);
      this.lastPlayerChunkKey = chunkKey;
      this.lastQueuedRenderDistance = this.renderDistance;
    }

    this.workAccumulator += deltaSeconds;
    if (this.workAccumulator < 0.05 && (this.pending.length || this.dirtyQueue.length)) {
      return;
    }
    this.workAccumulator = 0;

    if (this.pending.length) {
      this.generatePending(1);
    }

    if (this.dirtyQueue.length) {
      const meshBudget = deltaSeconds > 0.016 ? 1 : 2;
      this.rebuildDirtyMeshes(meshBudget, playerChunk.cx, playerChunk.cz);
    }

    this.waterAccumulator += deltaSeconds;
    if (this.waterAccumulator >= 0.03) {
      const waterBudget = Math.max(6, Math.floor(this.waterAccumulator / 0.03) * 8);
      this.waterAccumulator = 0;
      this.processWaterFlow(waterBudget);
    }
  }

  queueNearbyChunks(centerCx, centerCz) {
    for (let radius = 0; radius <= this.renderDistance; radius++) {
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
          const cx = centerCx + dx;
          const cz = centerCz + dz;
          const key = this.key(cx, cz);
          if (!this.chunks.has(key) && !this.pendingSet.has(key) && !this.generatingSet.has(key)) {
            this.pending.push(key);
            this.pendingSet.add(key);
          }
        }
      }
    }
  }

  generatePending(budget) {
    for (let i = 0; i < budget && this.pending.length; i++) {
      const key = this.pending.shift();
      if (!key) break;
      this.pendingSet.delete(key);
      if (this.chunks.has(key) || this.generatingSet.has(key)) continue;
      const [cx, cz] = key.split(",").map(Number);
      this.generatingSet.add(key);
      if (this.worker && !this.workerFallback) {
        this.worker.postMessage({ type: "generate", payload: { seed: this.seed, cx, cz, key } });
        continue;
      }

      const chunk = new Chunk(cx, cz);
      this.terrain.generateBase(chunk);
      this.caves.carve(chunk);
      this.addVegetation(chunk);
      this.applySavedChanges(chunk);
      this.lightEngine.compute(chunk);
      this.finalizeChunkGeneration(chunk, key, cx, cz);
    }
  }

  createWorker() {
    if (typeof window === "undefined" || typeof Worker === "undefined") {
      this.workerFallback = true;
      return;
    }

    try {
      this.worker = new Worker(new URL("./ChunkWorker.js", import.meta.url), { type: "module" });
      this.worker.onmessage = (event) => this.handleWorkerMessage(event.data);
      this.worker.onerror = (error) => {
        console.error("Chunk worker failed", error);
        this.workerFallback = true;
      };
    } catch (error) {
      console.warn("Chunk worker unavailable", error);
      this.workerFallback = true;
    }
  }

  handleWorkerMessage(message) {
    if (!message || message.type !== "chunk-ready") return;

    const { key, cx, cz, blocks, sunLight, blockLight } = message;
    if (!key || this.chunks.has(key)) {
      this.generatingSet.delete(key);
      return;
    }

    this.generatingSet.delete(key);

    const chunk = new Chunk(cx, cz);
    chunk.blocks = new Uint8Array(blocks);
    chunk.sunLight = new Uint8Array(sunLight);
    chunk.blockLight = new Uint8Array(blockLight);
    this.finalizeChunkGeneration(chunk, key, cx, cz);
  }

  finalizeChunkGeneration(chunk, key, cx, cz) {
    this.addVegetation(chunk);
    this.applySavedChanges(chunk);
    chunk.hasGenerated = true;
    chunk.dirty = true;
    this.chunks.set(key, chunk);
    this.queueChunkForMeshBuild(chunk);
    this.markNeighborsDirty(cx, cz);
    this.seedWaterFlowFromChunk(chunk);
    this.notifyChunkReady(key);
  }

  notifyChunkReady(key) {
    const resolvers = this.chunkReadyResolvers.get(key);
    if (!resolvers) return;
    this.chunkReadyResolvers.delete(key);
    for (const { resolve, timeout } of resolvers) {
      clearTimeout(timeout);
      resolve(true);
    }
  }

  rebuildDirtyMeshes(budget, centerCx = 0, centerCz = 0) {
    if (!this.dirtyQueue.length) return;
    const dirtyChunks = this.dirtyQueue
      .filter((chunk) => chunk?.dirty && chunk?.hasGenerated)
      .sort((a, b) => this.getMeshBuildPriority(a, centerCx, centerCz) - this.getMeshBuildPriority(b, centerCx, centerCz));

    const selected = dirtyChunks.slice(0, Math.max(1, budget));
    this.dirtyQueue = this.dirtyQueue.filter((chunk) => {
      if (!chunk || !chunk.hasGenerated || !chunk.dirty) {
        if (chunk) {
          this.dirtySet.delete(this.key(chunk.cx, chunk.cz));
        }
        return false;
      }
      if (selected.includes(chunk)) {
        this.dirtySet.delete(this.key(chunk.cx, chunk.cz));
        return false;
      }
      return true;
    });

    for (const chunk of selected) {
      if (!chunk?.dirty || !chunk?.hasGenerated) continue;
      this.lightEngine.compute(chunk);
      this.meshBuilder.build(chunk, 0);
    }
  }

  getMeshBuildPriority(chunk, centerCx = 0, centerCz = 0) {
    const distance = Math.max(Math.abs(chunk.cx - centerCx), Math.abs(chunk.cz - centerCz));
    const hasMesh = chunk.mesh ? 0 : 1;
    return distance * 10 + hasMesh;
  }

  unloadFarChunks(centerCx, centerCz) {
    for (const [key, chunk] of this.chunks) {
      const distance = Math.max(Math.abs(chunk.cx - centerCx), Math.abs(chunk.cz - centerCz));
      if (distance > this.renderDistance) {
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
    const previousBlock = chunk.getBlock(lx, y, lz);
    if (!chunk.setBlock(lx, y, lz, blockId)) return false;
    const localIndex = Chunk.index(lx, y, lz);
    this.saveManager.setBlockChange(this.key(cx, cz), localIndex, blockId);
    this.queueChunkForMeshBuild(chunk);
    this.markNeighborsDirty(cx, cz);
    this.lightEngine.compute(chunk);
    if (previousBlock === Blocks.WATER || blockId === Blocks.WATER || blockId === Blocks.AIR) {
      this.enqueueWaterFlowAround(worldX, y, worldZ);
    }
    return true;
  }

  getSunLight(worldX, worldY, worldZ) {
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
        return new THREE.Vector3(Math.floor(worldX) + 0.5, y + 3, Math.floor(worldZ) + 0.5);
      }
    }
    return new THREE.Vector3(Math.floor(worldX) + 0.5, SEA_LEVEL + 20, Math.floor(worldZ) + 0.5);
  }

  prepareAreaAround(worldX, worldZ, budget = 96) {
    const { cx, cz } = this.worldToChunk(worldX, worldZ);
    const targetKey = this.key(cx, cz);
    this.queueNearbyChunks(cx, cz);

    for (let generated = 0; generated < budget && this.pending.length; generated++) {
      this.generatePending(1);
      if (this.chunks.has(targetKey)) break;
    }

    this.rebuildDirtyMeshes(Math.max(4, Math.floor(budget / 8)), cx, cz);
    return this.chunks.has(targetKey);
  }

  waitForChunkLoadedAt(worldX, worldZ, timeoutMs = 10000) {
    const { cx, cz } = this.worldToChunk(worldX, worldZ);
    const key = this.key(cx, cz);
    if (this.chunks.has(key)) return Promise.resolve(true);

    this.queueNearbyChunks(cx, cz);
    this.generatePending(1);

    return new Promise((resolve, reject) => {
      const existing = this.chunkReadyResolvers.get(key) || [];
      const timeout = setTimeout(() => {
        const resolvers = this.chunkReadyResolvers.get(key) || [];
        this.chunkReadyResolvers.set(
          key,
          resolvers.filter((entry) => entry.timeout !== timeout),
        );
        reject(new Error("Chunk generation timed out"));
      }, timeoutMs);

      existing.push({ resolve, reject, timeout });
      this.chunkReadyResolvers.set(key, existing);
    });
  }

  hasGeneratedChunkAtWorld(worldX, worldZ) {
    const { cx, cz } = this.worldToChunk(worldX, worldZ);
    return this.chunks.has(this.key(cx, cz));
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

  queueChunkForMeshBuild(chunk) {
    if (!chunk || !chunk.hasGenerated) return;
    chunk.dirty = true;
    const key = this.key(chunk.cx, chunk.cz);
    if (this.dirtySet.has(key)) return;
    this.dirtyQueue.push(chunk);
    this.dirtySet.add(key);
  }

  markNeighborsDirty(cx, cz) {
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const chunk = this.chunks.get(this.key(cx + dx, cz + dz));
        if (chunk) this.queueChunkForMeshBuild(chunk);
      }
    }
  }

  seedWaterFlowFromChunk(chunk) {
    if (!chunk) return;

    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const isEdge = x === 0 || x === CHUNK_SIZE - 1 || z === 0 || z === CHUNK_SIZE - 1;
        if (!isEdge) continue;

        for (let y = 0; y < WORLD_HEIGHT; y++) {
          if (chunk.getBlock(x, y, z) !== Blocks.WATER) continue;
          const worldX = chunk.cx * CHUNK_SIZE + x;
          const worldZ = chunk.cz * CHUNK_SIZE + z;
          this.enqueueWaterFlowAround(worldX, y, worldZ);
        }
      }
    }
  }

  enqueueWaterFlowAround(worldX, worldY, worldZ) {
    const offsets = [
      [0, 0, 0],
      [1, 0, 0],
      [-1, 0, 0],
      [0, 0, 1],
      [0, 0, -1],
      [0, 1, 0],
      [0, -1, 0],
    ];

    for (const [dx, dy, dz] of offsets) {
      this.enqueueWaterFlow(worldX + dx, worldY + dy, worldZ + dz);
    }
  }

  enqueueWaterFlow(worldX, worldY, worldZ) {
    const x = Math.floor(worldX);
    const y = Math.floor(worldY);
    const z = Math.floor(worldZ);
    if (y < 0 || y >= WORLD_HEIGHT) return;
    const key = this.waterKey(x, y, z);
    if (this.waterFlowSet.has(key)) return;
    this.waterFlowSet.add(key);
    this.waterFlowQueue.push({ x, y, z });
  }

  processWaterFlow(budget = 12) {
    let processed = 0;
    while (processed < budget && this.waterFlowQueue.length > 0) {
      const cell = this.waterFlowQueue.shift();
      if (!cell) break;
      this.waterFlowSet.delete(this.waterKey(cell.x, cell.y, cell.z));

      if (this.getBlock(cell.x, cell.y, cell.z) !== Blocks.WATER) {
        continue;
      }

      processed++;

      if (cell.y > 0 && this.getBlock(cell.x, cell.y - 1, cell.z) === Blocks.AIR) {
        if (this.setBlock(cell.x, cell.y - 1, cell.z, Blocks.WATER)) {
          this.enqueueWaterFlowAround(cell.x, cell.y - 1, cell.z);
        }
        continue;
      }

      const neighbors = [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 0, 1],
        [0, 0, -1],
      ];

      for (const [dx, dy, dz] of neighbors) {
        const nx = cell.x + dx;
        const ny = cell.y + dy;
        const nz = cell.z + dz;
        if (this.getBlock(nx, ny, nz) !== Blocks.AIR) continue;
        if (this.setBlock(nx, ny, nz, Blocks.WATER)) {
          this.enqueueWaterFlowAround(nx, ny, nz);
        }
      }
    }
  }

  waterKey(x, y, z) {
    return `${x},${y},${z}`;
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
