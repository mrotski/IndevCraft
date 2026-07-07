import { DEFAULT_RENDER_DISTANCE_PRESET, RENDER_DISTANCE_PRESETS } from "../constants.js";

const SETTINGS_KEY = "indev-unlimited-settings-v1";

const DEFAULT_SETTINGS = {
  renderDistance: DEFAULT_RENDER_DISTANCE_PRESET,
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

  getRenderDistancePreset() {
    return this.data.renderDistance;
  }

  getRenderDistanceRadius() {
    return RENDER_DISTANCE_PRESETS[this.getRenderDistancePreset()] ?? RENDER_DISTANCE_PRESETS[DEFAULT_RENDER_DISTANCE_PRESET];
  }

  setRenderDistance(preset) {
    const normalized = this.normalizeRenderDistance(preset);
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

  normalizeRenderDistance(preset) {
    return Object.prototype.hasOwnProperty.call(RENDER_DISTANCE_PRESETS, preset)
      ? preset
      : DEFAULT_RENDER_DISTANCE_PRESET;
  }
}
