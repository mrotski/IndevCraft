export const Blocks = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  GRAVEL: 5,
  WATER: 6,
  WOOD: 7,
  LEAVES: 8,
  COAL_ORE: 11,
  IRON_ORE: 12,
  PLANKS: 13,
  GLASS: 14,
};

export const BlockData = {
  [Blocks.AIR]: { name: "Air", color: [0, 0, 0], transparent: true, solid: false, selectable: false },
  [Blocks.GRASS]: {
    name: "Grass",
    color: [0.38, 0.68, 0.23],
    sideColor: [0.88, 0.88, 0.88],
    solid: true,
    textures: { side: "grass_sides", top: "grass_top", bottom: "dirt_all_sides" },
  },
  [Blocks.DIRT]: { name: "Dirt", color: [1, 1, 1], solid: true, textures: { all: "dirt" } },
  [Blocks.STONE]: { name: "Stone", color: [1, 1, 1], solid: true, textures: { all: "stone" } },
  [Blocks.SAND]: { name: "Sand", color: [1, 1, 1], solid: true, textures: { all: "sand" } },
  [Blocks.GRAVEL]: { name: "Gravel", color: [0.86, 0.86, 0.86], solid: true, textures: { all: "gravel" } },
  [Blocks.WATER]: {
    name: "Water",
    color: [0.18, 0.45, 0.82],
    transparent: true,
    solid: false,
    alpha: 0.68,
    textures: { all: "water" },
  },
  [Blocks.WOOD]: {
    name: "Wood",
    color: [1, 1, 1],
    topColor: [1, 1, 1],
    solid: true,
    textures: { side: "wood_side", top: "wood_top", bottom: "wood_top" },
  },
  [Blocks.LEAVES]: { name: "Leaves", color: [1, 1, 1], transparent: true, solid: true, textures: { all: "leaves" } },
  [Blocks.COAL_ORE]: { name: "Coal Ore", color: [0.42, 0.42, 0.42], solid: true, textures: { all: "stone" } },
  [Blocks.IRON_ORE]: { name: "Iron Ore", color: [1, 0.72, 0.52], solid: true, textures: { all: "stone" } },
  [Blocks.PLANKS]: { name: "Wooden Planks", color: [1, 1, 1], solid: true, textures: { all: "planks" } },
  [Blocks.GLASS]: { name: "Glass", color: [1, 1, 1], transparent: true, solid: true, textures: { all: "glass" } },
};

export const HOTBAR_BLOCKS = [
  Blocks.GRASS,
  Blocks.DIRT,
  Blocks.STONE,
  Blocks.SAND,
  Blocks.GRAVEL,
  Blocks.PLANKS,
  Blocks.GLASS,
  Blocks.WOOD,
  Blocks.LEAVES,
];

export function isTransparent(blockId) {
  return BlockData[blockId]?.transparent === true;
}

export function isSolid(blockId) {
  return BlockData[blockId]?.solid === true;
}

export function occludesFaces(blockId) {
  return blockId !== undefined && blockId !== Blocks.AIR;
}

export function getBlockLight(blockId) {
  return BlockData[blockId]?.light ?? 0;
}

export function getBlockTextureKey(blockId, faceName = "top") {
  const textures = BlockData[blockId]?.textures;
  if (!textures) return "stone";
  if (faceName === "top") return textures.top ?? textures.all ?? textures.side;
  if (faceName === "bottom") return textures.bottom ?? textures.all ?? textures.side;
  return textures.side ?? textures.all ?? textures.top;
}
