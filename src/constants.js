export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 100;
export const SEA_LEVEL = 43;
export const LOAD_RADIUS = 2;
export const UNLOAD_RADIUS = 3;
export const MAX_LIGHT = 15;
export const TARGET_FPS = 999;
export const SAVE_KEY = "indev-unlimited-save-v1";
export const SAVE_INDEX_KEY = "indev-unlimited-world-index-v1";

export const FACE_DIRECTIONS = [
  { name: "north", normal: [0, 0, -1], offset: [0, 0, -1] },
  { name: "south", normal: [0, 0, 1], offset: [0, 0, 1] },
  { name: "west", normal: [-1, 0, 0], offset: [-1, 0, 0] },
  { name: "east", normal: [1, 0, 0], offset: [1, 0, 0] },
  { name: "top", normal: [0, 1, 0], offset: [0, 1, 0] },
  { name: "bottom", normal: [0, -1, 0], offset: [0, -1, 0] },
];
