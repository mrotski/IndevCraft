export class PauseMenu {
  constructor({ saveManager, settingsManager, onBack, onSave, onLoad, onRenderDistanceChange, onFogChange }) {
    this.saveManager = saveManager;
    this.settingsManager = settingsManager;
    this.onBack = onBack;
    this.onSave = onSave;
    this.onLoad = onLoad;
    this.onRenderDistanceChange = onRenderDistanceChange;
    this.onFogChange = onFogChange;
    this.root = document.getElementById("pauseMenu");
    this.mainPanel = document.getElementById("pauseMain");
    this.settingsPanel = document.getElementById("pauseSettings");
    this.savePanel = document.getElementById("pauseSave");
    this.loadPanel = document.getElementById("pauseLoad");
    this.saveInput = document.getElementById("worldNameInput");
    this.worldList = document.getElementById("worldList");
    this.renderDistanceSlider = document.getElementById("renderDistanceSlider");
    this.renderDistanceValue = document.getElementById("renderDistanceValue");
    this.fogToggle = document.getElementById("fogToggle");
    this.open = false;

    document.getElementById("backToGame").addEventListener("click", () => this.hide());
    document.getElementById("openSettings").addEventListener("click", () => this.showSettingsPanel());
    document.getElementById("openSaveWorld").addEventListener("click", () => this.showSavePanel());
    document.getElementById("openLoadWorld").addEventListener("click", () => this.showLoadPanel());
    document.getElementById("backFromSettings").addEventListener("click", () => this.showMainPanel());
    document.getElementById("confirmSaveWorld").addEventListener("click", () => this.saveWorld());
    document.getElementById("cancelSaveWorld").addEventListener("click", () => this.showMainPanel());
    document.getElementById("backFromLoad").addEventListener("click", () => this.showMainPanel());
    this.renderDistanceSlider.addEventListener("input", () => this.setRenderDistance(this.renderDistanceSlider.value));
    this.fogToggle.addEventListener("click", () => this.toggleFog());
  }

  isOpen() {
    return this.open;
  }

  show() {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    this.open = true;
    this.root.classList.add("open");
    this.showMainPanel();
  }

  hide() {
    this.open = false;
    this.root.classList.remove("open");
    this.onBack();
  }

  toggle() {
    if (this.open) {
      this.hide();
    } else {
      this.show();
    }
  }

  showMainPanel() {
    this.setPanel(this.mainPanel);
  }

  showSettingsPanel() {
    this.setPanel(this.settingsPanel);
    this.renderSettings();
  }

  showSavePanel() {
    this.setPanel(this.savePanel);
    this.saveInput.value = this.saveManager.activeName;
    this.saveInput.focus();
    this.saveInput.select();
  }

  showLoadPanel() {
    this.setPanel(this.loadPanel);
    this.renderWorldList();
  }

  saveWorld() {
    const name = this.saveInput.value.trim();
    const savedName = this.onSave(name);
    if (savedName) {
      this.saveInput.value = savedName;
      this.showMainPanel();
    }
  }

  renderWorldList() {
    this.worldList.innerHTML = "";
    const worlds = this.saveManager.listWorlds();
    if (!worlds.length) {
      const empty = document.createElement("div");
      empty.className = "world-empty";
      empty.textContent = "No saved worlds yet.";
      this.worldList.append(empty);
      return;
    }

    for (const world of worlds) {
      const button = document.createElement("button");
      button.className = "world-entry";
      const date = world.savedAt ? new Date(world.savedAt).toLocaleString() : "Never";
      const position = world.player?.position
        ? world.player.position.map((value) => Math.round(value)).join(" / ")
        : "No position";
      button.innerHTML = `<strong>${escapeHtml(world.name)}</strong><span>Seed ${world.seed} - ${date} - ${position}</span>`;
      button.addEventListener("click", () => this.onLoad(world.name));
      this.worldList.append(button);
    }
  }

  renderSettings() {
    const renderDistance = this.settingsManager?.getRenderDistance?.() ?? 6;
    this.renderDistanceSlider.value = String(renderDistance);
    this.renderDistanceValue.textContent = String(renderDistance);

    const fogEnabled = this.settingsManager?.getFogEnabled?.() ?? true;
    this.fogToggle.textContent = `Fog: ${fogEnabled ? "On" : "Off"}`;
    this.fogToggle.classList.toggle("selected", fogEnabled);
  }

  setRenderDistance(value) {
    const next = this.settingsManager?.setRenderDistance?.(value);
    this.onRenderDistanceChange?.(next ?? Number(value));
    this.renderSettings();
  }

  toggleFog() {
    const enabled = this.settingsManager?.toggleFog?.();
    this.onFogChange?.(enabled ?? true);
    this.renderSettings();
  }

  setPanel(activePanel) {
    for (const panel of [this.mainPanel, this.settingsPanel, this.savePanel, this.loadPanel]) {
      panel.classList.toggle("active", panel === activePanel);
    }
  }
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]);
}
