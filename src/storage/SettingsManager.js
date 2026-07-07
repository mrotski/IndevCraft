import {
  DEFAULT_RENDER_DISTANCE_CHUNKS,
  MAX_RENDER_DISTANCE_CHUNKS,
  MIN_RENDER_DISTANCE_CHUNKS,
} from "../constants.js";

const SETTINGS_KEY = "indev-unlimited-settings-v1";

const DEFAULT_SETTINGS = {
  renderDistance: DEFAULT_RENDER_DISTANCE_CHUNKS,
  fogEnabled: true,
};

export class SettingsManager {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const data = JSON.parse(raw);
      return {
        renderDistance: this.normalizeRenderDistance(data.renderDistance),
        fogEnabled: data.fogEnabled !== false,
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  getRenderDistance() {
    return this.data.renderDistance;
  }

  getRenderDistanceRadius() {
    return this.getRenderDistance();
  }

  setRenderDistance(value) {
    const normalized = this.normalizeRenderDistance(value);
    this.data.renderDistance = normalized;
    this.flush();
    return normalized;
  }

  getFogEnabled() {
    return this.data.fogEnabled;
  }

  setFogEnabled(enabled) {
    this.data.fogEnabled = !!enabled;
    this.flush();
    return this.data.fogEnabled;
  }

  toggleFog() {
    return this.setFogEnabled(!this.getFogEnabled());
  }

  flush() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.data));
  }

  normalizeRenderDistance(value) {
    if (typeof value === "string") {
      const legacyValues = {
        tiny: 1,
        short: 2,
        medium: 3,
        far: 4,
        extreme: 6,
      };
      if (Object.prototype.hasOwnProperty.call(legacyValues, value)) {
        return legacyValues[value];
      }
    }

    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return DEFAULT_RENDER_DISTANCE_CHUNKS;
    return Math.max(MIN_RENDER_DISTANCE_CHUNKS, Math.min(MAX_RENDER_DISTANCE_CHUNKS, Math.round(numeric)));
  }
}
