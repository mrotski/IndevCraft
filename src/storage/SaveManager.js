import { SAVE_KEY } from "../constants.js";

export class SaveManager {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      this.removeRetiredBlocks(data);
      return data;
    } catch {
      return null;
    }
  }

  create(seed) {
    this.data = {
      seed,
      player: null,
      chunks: {},
      savedAt: Date.now(),
    };
    this.flush();
  }

  get seed() {
    return this.data?.seed;
  }

  getPlayer() {
    return this.data?.player ?? null;
  }

  setPlayer(position, rotation) {
    if (!this.data) return;
    this.data.player = {
      position: [position.x, position.y, position.z],
      rotation: [rotation.x, rotation.y],
    };
  }

  getChunkChanges(key) {
    return this.data?.chunks?.[key] ?? null;
  }

  setBlockChange(key, localIndex, blockId) {
    if (!this.data) return;
    if (!this.data.chunks[key]) this.data.chunks[key] = {};
    this.data.chunks[key][localIndex] = blockId;
  }

  flush() {
    if (!this.data) return;
    this.data.savedAt = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
  }

  removeRetiredBlocks(data) {
    if (!data?.chunks) return;
    for (const changes of Object.values(data.chunks)) {
      for (const [index, blockId] of Object.entries(changes)) {
        if (blockId === 9 || blockId === 10) {
          changes[index] = 0;
        }
      }
    }
  }
}
