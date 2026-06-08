import { CHUNK_SIZE, TARGET_FPS } from "../constants.js";
import { BlockData, getBlockTextureKey, HOTBAR_BLOCKS } from "../blocks/BlockTypes.js";

export class HUD {
  constructor(seed, textureAtlas) {
    this.seed = seed;
    this.textureAtlas = textureAtlas;
    this.root = document.getElementById("hud");
    this.debug = document.getElementById("debug");
    this.hotbar = document.getElementById("hotbar");
    this.selectedIndex = 0;
    this.createHotbar();

    document.addEventListener("keydown", (event) => {
      const number = Number(event.key);
      if (number >= 1 && number <= HOTBAR_BLOCKS.length) {
        this.selectedIndex = number - 1;
        this.updateHotbarSelection();
      }
    });

    document.addEventListener("wheel", (event) => {
      this.selectedIndex = (this.selectedIndex + Math.sign(event.deltaY) + HOTBAR_BLOCKS.length) % HOTBAR_BLOCKS.length;
      this.updateHotbarSelection();
    });
  }

  createHotbar() {
    this.hotbar.innerHTML = "";
    HOTBAR_BLOCKS.forEach((blockId, index) => {
      const slot = document.createElement("div");
      slot.className = "slot";
      slot.title = BlockData[blockId].name;

      const key = document.createElement("span");
      key.className = "key";
      key.textContent = String(index + 1);

      const swatch = document.createElement("span");
      swatch.className = "swatch";
      const textureKey = getBlockTextureKey(blockId, "top");
      swatch.style.backgroundImage = `url("${this.textureAtlas.getPreviewURL(textureKey)}")`;

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
    return HOTBAR_BLOCKS[this.selectedIndex];
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

  update(scene, player, chunkManager) {
    const position = player.position;
    const chunkX = Math.floor(position.x / CHUNK_SIZE);
    const chunkZ = Math.floor(position.z / CHUNK_SIZE);
    const blockName = BlockData[this.getSelectedBlock()].name;
    this.debug.innerHTML = [
      `FPS: ${Math.min(TARGET_FPS, Math.round(scene.getEngine().getFps()))}`,
      `XYZ: ${position.x.toFixed(1)} / ${position.y.toFixed(1)} / ${position.z.toFixed(1)}`,
      `Chunk: ${chunkX}, ${chunkZ}`,
      `Loaded chunks: ${chunkManager.chunks.size}`,
      `Seed: ${this.seed}`,
      `Selected: ${blockName}`,
    ].join("<br>");
  }
}
