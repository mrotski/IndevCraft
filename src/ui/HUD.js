import { CHUNK_SIZE } from "../constants.js";
import { BlockData, getBlockTextureKey } from "../blocks/BlockTypes.js";

export class HUD {
  constructor(seed, textureAtlas, hotbarItems = Array(9).fill(null), isInputBlocked = () => false) {
    this.seed = seed;
    this.textureAtlas = textureAtlas;
    this.root = document.getElementById("hud");
    this.debug = document.getElementById("debug");
    this.hotbar = document.getElementById("hotbar");
    this.hotbarItems = this.normalizeHotbar(hotbarItems);
    this.selectedIndex = 0;
    this.onSelectionChange = null;
    this.isInputBlocked = isInputBlocked;
    this.lastDebugRefresh = 0;
    this.lastDisplayedFps = 0;
    this.createHotbar();

    document.addEventListener("keydown", (event) => {
      if (this.isInputBlocked()) return;
      const number = Number(event.key);
      if (number >= 1 && number <= this.hotbarItems.length) {
        this.setSelectedIndex(number - 1);
      }
    });

    document.addEventListener("wheel", (event) => {
      if (this.isInputBlocked()) return;
      const count = this.hotbarItems.length;
      const next = (this.selectedIndex + Math.sign(event.deltaY) + count) % count;
      this.setSelectedIndex(next);
    });
  }

  normalizeHotbar(hotbar) {
    const slots = Array(9).fill(null);
    if (!Array.isArray(hotbar)) return slots;
    for (let index = 0; index < slots.length; index++) {
      const value = Number(hotbar[index]);
      slots[index] = Number.isFinite(value) && value > 0 ? value : null;
    }
    return slots;
  }

  setSelectionChangeHandler(handler) {
    this.onSelectionChange = handler;
  }

  setHotbarItems(hotbarItems) {
    this.hotbarItems = this.normalizeHotbar(hotbarItems);
    this.createHotbar();
  }

  setSelectedIndex(index) {
    const next = Math.max(0, Math.min(this.hotbarItems.length - 1, Number(index) || 0));
    if (next === this.selectedIndex) {
      this.updateHotbarSelection();
      return;
    }
    this.selectedIndex = next;
    this.updateHotbarSelection();
    this.onSelectionChange?.(this.selectedIndex);
  }

  getSelectedIndex() {
    return this.selectedIndex;
  }

  createHotbar() {
    this.hotbar.innerHTML = "";
    this.hotbarItems.forEach((blockId, index) => {
      const slot = document.createElement("div");
      slot.className = "slot";
      slot.classList.toggle("empty", blockId == null);
      slot.title = blockId == null ? "Empty" : BlockData[blockId].name;

      const key = document.createElement("span");
      key.className = "key";
      key.textContent = String(index + 1);

      const swatch = document.createElement("span");
      swatch.className = "swatch";
      if (blockId != null) {
        const textureKey = getBlockTextureKey(blockId, "top");
        swatch.style.backgroundImage = `url("${this.textureAtlas.getPreviewURL(textureKey)}")`;
      } else {
        swatch.style.backgroundImage = "none";
      }

      slot.append(key, swatch);
      this.hotbar.append(slot);
    });
    this.updateHotbarSelection();
  }

  updateHotbarSelection() {
    [...this.hotbar.children].forEach((slot, index) => {
      slot.classList.toggle("selected", index === this.selectedIndex);
    });
  }

  getSelectedBlock() {
    return this.hotbarItems[this.selectedIndex] ?? null;
  }

  toggleDebugGui() {
    if (this.root.classList.contains("gui-hidden")) {
      this.root.classList.remove("gui-hidden");
    }
    this.root.classList.toggle("gui-debug-hidden");
  }

  toggleHidden() {
    this.root.classList.toggle("gui-hidden");
  }

  update(fps, player, chunkManager) {
    const now = performance.now();
    if (now - this.lastDebugRefresh < 400) {
      return;
    }
    this.lastDebugRefresh = now;
    this.lastDisplayedFps = fps;

    const position = player.position;
    const chunkX = Math.floor(position.x / CHUNK_SIZE);
    const chunkZ = Math.floor(position.z / CHUNK_SIZE);
    const selectedBlock = this.getSelectedBlock();
    const blockName = selectedBlock == null ? "Empty" : BlockData[selectedBlock].name;
    this.debug.innerHTML = [
      `FPS: ${Math.round(this.lastDisplayedFps)}`,
      `XYZ: ${position.x.toFixed(1)} / ${position.y.toFixed(1)} / ${position.z.toFixed(1)}`,
    ].join("<br>");
  }
}
