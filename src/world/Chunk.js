import { CHUNK_SIZE, WORLD_HEIGHT } from "../constants.js";
import { Blocks } from "../blocks/BlockTypes.js";

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);
    this.sunLight = new Uint8Array(this.blocks.length);
    this.blockLight = new Uint8Array(this.blocks.length);
    this.dirty = true;
    this.mesh = null;
    this.hasGenerated = false;
  }

  static index(x, y, z) {
    return x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
  }

  inBounds(x, y, z) {
    return x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE && y >= 0 && y < WORLD_HEIGHT;
  }

  getBlock(x, y, z) {
    if (!this.inBounds(x, y, z)) return Blocks.AIR;
    return this.blocks[Chunk.index(x, y, z)];
  }

  setBlock(x, y, z, blockId) {
    if (!this.inBounds(x, y, z)) return false;
    this.blocks[Chunk.index(x, y, z)] = blockId;
    this.dirty = true;
    return true;
  }

  getSunLight(x, y, z) {
    if (!this.inBounds(x, y, z)) return 15;
    return this.sunLight[Chunk.index(x, y, z)];
  }

  getBlockLight(x, y, z) {
    if (!this.inBounds(x, y, z)) return 0;
    return this.blockLight[Chunk.index(x, y, z)];
  }

  setLight(x, y, z, sun, block) {
    if (!this.inBounds(x, y, z)) return;
    const index = Chunk.index(x, y, z);
    this.sunLight[index] = sun;
    this.blockLight[index] = block;
  }

  dispose() {
    if (this.mesh) {
      this.mesh.dispose();
      this.mesh = null;
    }
  }
}
