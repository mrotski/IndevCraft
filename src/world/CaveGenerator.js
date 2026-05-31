import { CHUNK_SIZE, SEA_LEVEL, WORLD_HEIGHT } from "../constants.js";
import { Blocks } from "../blocks/BlockTypes.js";
import { Random, hash32 } from "../utils/Random.js";

export class CaveGenerator {
  constructor(seed, terrainGenerator) {
    this.seed = seed >>> 0;
    this.terrain = terrainGenerator;
  }

  carve(chunk) {
    const searchRadius = 1;
    for (let dz = -searchRadius; dz <= searchRadius; dz++) {
      for (let dx = -searchRadius; dx <= searchRadius; dx++) {
        this.carveCavesFromRegion(chunk, chunk.cx + dx, chunk.cz + dz);
      }
    }
  }

  carveCavesFromRegion(chunk, regionCx, regionCz) {
    const random = new Random(hash32(this.seed ^ 0xc0ffee, regionCx, 0, regionCz));
    const caveCount = random.int(2, 5);
    for (let cave = 0; cave < caveCount; cave++) {
      let x = regionCx * CHUNK_SIZE + random.next() * CHUNK_SIZE;
      let z = regionCz * CHUNK_SIZE + random.next() * CHUNK_SIZE;
      let y = random.int(14, Math.min(SEA_LEVEL + 22, WORLD_HEIGHT - 20));
      let yaw = random.next() * Math.PI * 2;
      let pitch = (random.next() - 0.5) * 0.45;
      const length = random.int(48, 110);
      let radius = 1.35 + random.next() * 1.9;

      for (let step = 0; step < length; step++) {
        radius += (random.next() - 0.5) * 0.13;
        radius = Math.max(1.15, Math.min(3.8, radius));
        this.carveSphere(chunk, x, y, z, radius);

        if (random.chance(0.045) && step > 14) {
          this.branch(chunk, x, y, z, yaw + (random.next() - 0.5) * 1.8, pitch, random);
        }

        yaw += (random.next() - 0.5) * 0.32;
        pitch = pitch * 0.74 + (random.next() - 0.5) * 0.16;
        x += Math.cos(yaw) * Math.cos(pitch) * 1.45;
        z += Math.sin(yaw) * Math.cos(pitch) * 1.45;
        y += Math.sin(pitch) * 1.15;
        y = Math.max(8, Math.min(WORLD_HEIGHT - 10, y));
      }
    }
  }

  branch(chunk, startX, startY, startZ, yaw, pitch, random) {
    let x = startX;
    let y = startY;
    let z = startZ;
    const length = random.int(18, 42);
    let radius = 1.0 + random.next() * 1.2;
    for (let step = 0; step < length; step++) {
      this.carveSphere(chunk, x, y, z, radius);
      yaw += (random.next() - 0.5) * 0.38;
      pitch = pitch * 0.75 + (random.next() - 0.5) * 0.18;
      x += Math.cos(yaw) * Math.cos(pitch) * 1.3;
      z += Math.sin(yaw) * Math.cos(pitch) * 1.3;
      y += Math.sin(pitch);
    }
  }

  carveSphere(chunk, worldX, worldY, worldZ, radius) {
    const minX = Math.floor(worldX - radius - 1);
    const maxX = Math.ceil(worldX + radius + 1);
    const minY = Math.floor(worldY - radius - 1);
    const maxY = Math.ceil(worldY + radius + 1);
    const minZ = Math.floor(worldZ - radius - 1);
    const maxZ = Math.ceil(worldZ + radius + 1);

    for (let y = minY; y <= maxY; y++) {
      if (y <= 2 || y >= WORLD_HEIGHT - 2) continue;
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          const localX = x - chunk.cx * CHUNK_SIZE;
          const localZ = z - chunk.cz * CHUNK_SIZE;
          if (localX < 0 || localX >= CHUNK_SIZE || localZ < 0 || localZ >= CHUNK_SIZE) continue;
          const dx = (x - worldX) / radius;
          const dy = (y - worldY) / (radius * 0.78);
          const dz = (z - worldZ) / radius;
          if (dx * dx + dy * dy + dz * dz <= 1) {
            const block = chunk.getBlock(localX, y, localZ);
            if (block !== Blocks.WATER) {
              chunk.setBlock(localX, y, localZ, Blocks.AIR);
            }
          }
        }
      }
    }
  }
}
