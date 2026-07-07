import { BlockData, getBlockTextureKey, getCreativeInventoryBlocks } from "../blocks/BlockTypes.js";

const HOTBAR_SLOTS = 9;

export class CreativeInventory {
  constructor({ textureAtlas, onSelectSlot, onAssignBlock }) {
    this.textureAtlas = textureAtlas;
    this.onSelectSlot = onSelectSlot;
    this.onAssignBlock = onAssignBlock;
    this.root = document.getElementById("creativeInventory");
    this.grid = document.getElementById("creativeGrid");
    this.hotbar = document.getElementById("creativeHotbar");
    this.hotbarItems = Array(HOTBAR_SLOTS).fill(null);
    this.selectedIndex = 0;
    this.open = false;

    this.createGrid();
    this.createHotbar();
    this.hide();
  }

  isOpen() {
    return this.open;
  }

  show() {
    this.open = true;
    this.root.classList.add("open");
    this.root.setAttribute("aria-hidden", "false");
    document.body.classList.add("inventory-open");
    this.refreshSelection();
    this.refreshHotbar();
  }

  hide() {
    this.open = false;
    this.root.classList.remove("open");
    this.root.setAttribute("aria-hidden", "true");
    document.body.classList.remove("inventory-open");
  }

  toggle() {
    if (this.open) {
      this.hide();
    } else {
      this.show();
    }
  }

  setHotbarItems(hotbarItems) {
    this.hotbarItems = this.normalizeHotbar(hotbarItems);
    this.refreshHotbar();
  }

  setSelectedIndex(index) {
    this.selectedIndex = Math.max(0, Math.min(HOTBAR_SLOTS - 1, Number(index) || 0));
    this.refreshSelection();
  }

  normalizeHotbar(hotbar) {
    const slots = Array(HOTBAR_SLOTS).fill(null);
    if (!Array.isArray(hotbar)) return slots;
    for (let index = 0; index < HOTBAR_SLOTS; index++) {
      const value = Number(hotbar[index]);
      slots[index] = Number.isFinite(value) && value > 0 ? value : null;
    }
    return slots;
  }

  createGrid() {
    this.grid.innerHTML = "";
    for (const blockId of getCreativeInventoryBlocks()) {
      const data = BlockData[blockId];
      const button = document.createElement("button");
      button.type = "button";
      button.className = "creative-item";
      button.title = data?.name ?? `Block ${blockId}`;
      button.dataset.blockId = String(blockId);

      const swatch = document.createElement("span");
      swatch.className = "creative-swatch";
      const textureKey = getBlockTextureKey(blockId, "top");
      swatch.style.backgroundImage = `url("${this.textureAtlas.getPreviewURL(textureKey)}")`;

      const label = document.createElement("span");
      label.className = "creative-name";
      label.textContent = data?.name ?? `Block ${blockId}`;

      button.append(swatch, label);
      button.addEventListener("click", () => {
        this.onAssignBlock?.(blockId);
        this.refreshHotbar();
      });
      this.grid.append(button);
    }
  }

  createHotbar() {
    this.hotbar.innerHTML = "";
    for (let index = 0; index < HOTBAR_SLOTS; index++) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "creative-slot";
      button.dataset.index = String(index);

      const key = document.createElement("span");
      key.className = "creative-key";
      key.textContent = String(index + 1);

      const swatch = document.createElement("span");
      swatch.className = "creative-swatch";

      const label = document.createElement("span");
      label.className = "creative-slot-name";

      button.append(key, swatch, label);
      button.addEventListener("click", () => {
        this.onSelectSlot?.(index);
      });
      this.hotbar.append(button);
    }
    this.refreshHotbar();
    this.refreshSelection();
  }

  refreshHotbar() {
    [...this.hotbar.children].forEach((slot, index) => {
      const blockId = this.hotbarItems[index];
      const swatch = slot.querySelector(".creative-swatch");
      const label = slot.querySelector(".creative-slot-name");
      slot.classList.toggle("empty", blockId == null);
      slot.title = blockId == null ? `Slot ${index + 1}: Empty` : `Slot ${index + 1}: ${BlockData[blockId]?.name ?? blockId}`;

      if (blockId == null) {
        swatch.style.backgroundImage = "none";
        label.textContent = "Empty";
      } else {
        const textureKey = getBlockTextureKey(blockId, "top");
        swatch.style.backgroundImage = `url("${this.textureAtlas.getPreviewURL(textureKey)}")`;
        label.textContent = BlockData[blockId]?.name ?? String(blockId);
      }
    });
  }

  refreshSelection() {
    [...this.hotbar.children].forEach((slot, index) => {
      slot.classList.toggle("selected", index === this.selectedIndex);
    });
  }
}
