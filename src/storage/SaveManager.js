import { SAVE_INDEX_KEY, SAVE_KEY } from "../constants.js";

export class SaveManager {
  constructor() {
    this.activeName = localStorage.getItem(SAVE_INDEX_KEY) ?? "World 1";
    this.data = this.loadActive();
  }

  loadActive() {
    try {
      const raw = localStorage.getItem(this.getStorageKey(this.activeName)) ?? localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      this.prepareData(data, this.activeName);
      return data;
    } catch {
      return null;
    }
  }

  create(seed) {
    this.data = {
      name: this.activeName,
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
    this.data.name = this.activeName;
    this.data.savedAt = Date.now();
    localStorage.setItem(this.getStorageKey(this.activeName), JSON.stringify(this.data));
    localStorage.setItem(SAVE_INDEX_KEY, this.activeName);
  }

  saveNamed(name) {
    const normalizedName = this.normalizeName(name);
    if (!normalizedName) return null;
    this.activeName = normalizedName;
    this.flush();
    return normalizedName;
  }

  listWorlds() {
    const worlds = new Map();
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key?.startsWith(`${SAVE_KEY}:`)) continue;
      this.addWorldFromRaw(worlds, localStorage.getItem(key), decodeURIComponent(key.slice(SAVE_KEY.length + 1)));
    }

    const legacy = localStorage.getItem(SAVE_KEY);
    if (legacy) {
      this.addWorldFromRaw(worlds, legacy, "World 1");
    }

    return [...worlds.values()].sort((a, b) => b.savedAt - a.savedAt);
  }

  loadNamed(name) {
    const normalizedName = this.normalizeName(name);
    const raw = localStorage.getItem(this.getStorageKey(normalizedName)) ??
      (normalizedName === "World 1" ? localStorage.getItem(SAVE_KEY) : null);
    if (!raw) return false;
    const data = JSON.parse(raw);
    this.prepareData(data, normalizedName);
    this.activeName = normalizedName;
    this.data = data;
    localStorage.setItem(SAVE_INDEX_KEY, normalizedName);
    return true;
  }

  addWorldFromRaw(worlds, raw, fallbackName) {
    try {
      if (!raw) return;
      const data = JSON.parse(raw);
      const name = this.normalizeName(data.name ?? fallbackName);
      worlds.set(name, {
        name,
        seed: data.seed,
        savedAt: data.savedAt ?? 0,
        player: data.player ?? null,
      });
    } catch {
      // Ignore malformed save slots.
    }
  }

  prepareData(data, name) {
    data.name = this.normalizeName(data.name ?? name);
    data.chunks ??= {};
    this.removeRetiredBlocks(data);
  }

  normalizeName(name) {
    return String(name ?? "").trim().replace(/\s+/g, " ").slice(0, 32);
  }

  getStorageKey(name) {
    return `${SAVE_KEY}:${encodeURIComponent(name)}`;
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
