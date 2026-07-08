import { CHUNK_SIZE, SEA_LEVEL, WORLD_HEIGHT } from "../constants.js";
import { Blocks } from "../blocks/BlockTypes.js";
import { PerlinNoise, randomFloat } from "../utils/Random.js";

export class TerrainGenerator {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.heightNoise = new PerlinNoise(this.seed ^ 0xa531f31d);
    this.detailNoise = new PerlinNoise(this.seed ^ 0x7bd1c779);
    this.oreNoise = new PerlinNoise(this.seed ^ 0x49a73f9b);
  }

  generateBase(chunk) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const worldX = chunk.cx * CHUNK_SIZE + x;
        const worldZ = chunk.cz * CHUNK_SIZE + z;
        const height = this.getHeight(worldX, worldZ);
        const beach = height <= SEA_LEVEL + 2;

        for (let y = 0; y < WORLD_HEIGHT; y++) {
          let block = Blocks.AIR;
          if (y === 0) {
            block = Blocks.STONE;
          } else if (y < height - 4) {
            block = this.getStoneOrOre(worldX, y, worldZ);
          } else if (y < height - 1) {
            block = beach ? Blocks.SAND : Blocks.DIRT;
          } else if (y < height) {
            block = beach ? Blocks.SAND : Blocks.GRASS;
          } else if (y <= SEA_LEVEL) {
            block = Blocks.WATER;
          }
          chunk.setBlock(x, y, z, block);
        }
      }
    }
  }

  getHeight(worldX, worldZ) {
    const broad = this.heightNoise.noise2(worldX * 0.006, worldZ * 0.006);
    const hills = this.heightNoise.noise2(worldX * 0.021, worldZ * 0.021);
    const rough = this.detailNoise.noise2(worldX * 0.071, worldZ * 0.071);
    const cliffSignal = Math.abs(this.detailNoise.noise2(worldX * 0.014, worldZ * 0.014));
    const cliffs = cliffSignal > 0.48 ? (cliffSignal - 0.48) * 52 : 0;
    const height = SEA_LEVEL + 9 + broad * 28 + hills * 11 + rough * 4 + cliffs;
    return Math.max(18, Math.min(WORLD_HEIGHT - 8, Math.floor(height)));
  }

  getSurfaceInfo(worldX, worldZ) {
    const height = this.getHeight(worldX, worldZ);
    if (height < SEA_LEVEL) {
      return { height: SEA_LEVEL + 1, block: Blocks.WATER };
    }
    if (height <= SEA_LEVEL + 2) {
      return { height, block: Blocks.SAND };
    }
    return { height, block: Blocks.GRASS };
  }

  getStoneOrOre(worldX, y, worldZ) {
    const coal = this.oreNoise.noise3(worldX * 0.09, y * 0.16, worldZ * 0.09);
    if (coal > 0.43 && y < 92) return Blocks.COAL_ORE;
    const iron = this.oreNoise.noise3((worldX + 311) * 0.11, y * 0.2, (worldZ - 97) * 0.11);
    if (iron > 0.48 && y < 58) return Blocks.IRON_ORE;
    const gravel = randomFloat(this.seed ^ 0x42, Math.floor(worldX / 5), Math.floor(y / 4), Math.floor(worldZ / 5));
    if (gravel > 0.965 && y < SEA_LEVEL + 8) return Blocks.GRAVEL;
    return Blocks.STONE;
  }
}
