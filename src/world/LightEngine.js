import { CHUNK_SIZE, MAX_LIGHT, WORLD_HEIGHT } from "../constants.js";
import { Blocks, getBlockLight, isTransparent } from "../blocks/BlockTypes.js";

export class LightEngine {
  compute(chunk) {
    chunk.sunLight.fill(0);
    chunk.blockLight.fill(0);
    this.computeSunlight(chunk);
    this.computeBlockLight(chunk);
  }

  computeSunlight(chunk) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        let light = MAX_LIGHT;
        for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
          const block = chunk.getBlock(x, y, z);
          const index = chunk.constructor.index(x, y, z);
          if (block !== Blocks.AIR && !isTransparent(block)) {
            light = 0;
          } else {
            chunk.sunLight[index] = light;
            if (block !== Blocks.AIR) light = Math.max(0, light - 2);
          }
        }
      }
    }
  }

  computeBlockLight(chunk) {
    const queue = [];
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const block = chunk.getBlock(x, y, z);
          const light = getBlockLight(block);
          if (light > 0) {
            const index = chunk.constructor.index(x, y, z);
            chunk.blockLight[index] = light;
            queue.push([x, y, z, light]);
          }
        }
      }
    }

    const directions = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ];

    while (queue.length) {
      const [x, y, z, light] = queue.shift();
      if (light <= 1) continue;
      for (const [dx, dy, dz] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        const nz = z + dz;
        if (!chunk.inBounds(nx, ny, nz)) continue;
        const block = chunk.getBlock(nx, ny, nz);
        if (block !== Blocks.AIR && !isTransparent(block)) continue;
        const index = chunk.constructor.index(nx, ny, nz);
        const nextLight = light - 1;
        if (chunk.blockLight[index] < nextLight) {
          chunk.blockLight[index] = nextLight;
          queue.push([nx, ny, nz, nextLight]);
        }
      }
    }
  }
}
