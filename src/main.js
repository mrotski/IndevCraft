import { Blocks, isSolid } from "./blocks/BlockTypes.js";
import { WORLD_HEIGHT } from "./constants.js";
import { SaveManager } from "./storage/SaveManager.js";
import { SettingsManager } from "./storage/SettingsManager.js";
import { BlockParticles } from "./rendering/BlockParticles.js";
import { loadTextureAtlas } from "./rendering/TextureAtlas.js";
import { ChunkManager } from "./world/ChunkManager.js";
import { Atmosphere } from "./world/Atmosphere.js";
import { Controls } from "./player/Controls.js";
import { Player } from "./player/Player.js";
import { Chat } from "./ui/Chat.js";
import { HUD } from "./ui/HUD.js";
import { CreativeInventory } from "./ui/CreativeInventory.js";
import { PauseMenu } from "./ui/PauseMenu.js";

export async function startGame() {
  const canvas = document.getElementById("gameCanvas");
  const loading = document.getElementById("loading");

  if (!window.THREE) {
    loading.innerHTML = "<strong>Three.js failed to load.</strong><span>Check your network connection and reload.</span>";
    throw new Error("Three.js unavailable");
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x6faddb);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 64, 0);

  const skyLight = new THREE.HemisphereLight(0xffffff, 0x443322, 0.9);
  scene.add(skyLight);

  const saveManager = new SaveManager();
  if (!saveManager.data) {
    const seed = Math.floor(Math.random() * 0xffffffff);
    saveManager.create(seed);
  }

  const settingsManager = new SettingsManager();
  const hotbarItems = saveManager.getHotbar();

  const textureAtlas = await loadTextureAtlas();
  const chunkManager = new ChunkManager(scene, saveManager, saveManager.seed, textureAtlas);
  chunkManager.renderDistance = settingsManager.getRenderDistanceRadius();
  const savedPlayer = saveManager.getPlayer();
  const savedChunk = savedPlayer?.position
    ? chunkManager.worldToChunk(savedPlayer.position[0], savedPlayer.position[2])
    : { cx: 0, cz: 0 };
  chunkManager.queueNearbyChunks(savedChunk.cx, savedChunk.cz);
  chunkManager.generatePending(25);
  chunkManager.rebuildDirtyMeshes(25);

  const controls = new Controls(canvas);
  const worldTimeState = {
    value: saveManager.getWorldTime(),
  };
  const hasValidSavedPosition =
    savedPlayer &&
    savedPlayer.position.length === 3 &&
    savedPlayer.position[1] > 2 &&
    savedPlayer.position[1] < WORLD_HEIGHT - 2 &&
    canPlayerOccupy(new THREE.Vector3(...savedPlayer.position), chunkManager);
  const startPosition = hasValidSavedPosition
    ? new THREE.Vector3(...savedPlayer.position)
    : chunkManager.findSpawn();

  if (hasValidSavedPosition && savedPlayer?.rotation) {
    controls.pitch = savedPlayer.rotation[0];
    controls.yaw = savedPlayer.rotation[1];
  }

  const player = new Player(camera, canvas, chunkManager, controls, startPosition);
  const atmosphere = new Atmosphere(scene, skyLight);
  atmosphere.setFogEnabled(settingsManager.getFogEnabled());
  atmosphere.update(player.position, worldTimeState.value, 0);

  let pauseMenu = null;
  let creativeInventory = null;
  let chat = null;
  const hud = new HUD(saveManager.seed, textureAtlas, hotbarItems, () => pauseMenu?.isOpen() || chat?.isOpen() || creativeInventory?.isOpen());
  const blockParticles = new BlockParticles(scene, textureAtlas, camera);
  const syncHotbar = () => {
    saveManager.setHotbar(hotbarItems);
    hud.setHotbarItems(hotbarItems);
    creativeInventory?.setHotbarItems(hotbarItems);
  };
  const syncInputState = () => {
    controls.inputEnabled = controls.pointerLocked && !(pauseMenu?.isOpen() || chat?.isOpen() || creativeInventory?.isOpen());
  };
  const openInventory = () => {
    if (pauseMenu?.isOpen() || chat?.isOpen()) return;
    creativeInventory?.show();
    syncInputState();
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  };
  const closeInventory = () => {
    creativeInventory?.hide();
    syncInputState();
    if (!pauseMenu?.isOpen() && !chat?.isOpen() && !document.pointerLockElement) {
      canvas.requestPointerLock();
    }
  };
  chat = new Chat({
    onCommand(command) {
      return runCommand(command, player, chunkManager, saveWorld, setWorldTime);
    },
    onShow: syncInputState,
    onHide: syncInputState,
  });
  creativeInventory = new CreativeInventory({
    textureAtlas,
    onSelectSlot(index) {
      hud.setSelectedIndex(index);
    },
    onAssignBlock(blockId) {
      const index = hud.getSelectedIndex();
      hotbarItems[index] = blockId;
      syncHotbar();
      saveWorld();
    },
  });
  hud.setSelectionChangeHandler((index) => creativeInventory.setSelectedIndex(index));
  syncHotbar();
  creativeInventory.setSelectedIndex(hud.getSelectedIndex());

  pauseMenu = new PauseMenu({
    saveManager,
    settingsManager,
    onBack() {
      if (!document.pointerLockElement) {
        canvas.requestPointerLock();
      }
    },
    onSave(name) {
      saveWorld();
      return saveManager.saveNamed(name);
    },
    onLoad(name) {
      saveWorld();
      if (!saveManager.loadNamed(name)) return;
      window.location.reload();
    },
    onRenderDistanceChange(preset) {
      const radius = Number.isFinite(Number(preset)) ? Number(preset) : settingsManager.getRenderDistanceRadius();
      chunkManager.renderDistance = radius;
      chunkManager.prepareAreaAround(player.position.x, player.position.z, 96);
    },
    onFogChange(enabled) {
      atmosphere.setFogEnabled(enabled);
    },
  });

  let lastPointerLocked = document.pointerLockElement === canvas;
  document.addEventListener("pointerlockchange", () => {
    const nowLocked = document.pointerLockElement === canvas;
    if (lastPointerLocked && !nowLocked && !pauseMenu.isOpen() && !chat?.isOpen() && !creativeInventory.isOpen()) {
      pauseMenu.show();
    }
    lastPointerLocked = nowLocked;
    syncInputState();
  });

  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("pointerdown", (event) => {
    if (chat?.isOpen() || pauseMenu.isOpen() || creativeInventory.isOpen()) return;
    event.preventDefault();
    if (!controls.pointerLocked) {
      canvas.requestPointerLock();
    }
    if (event.button !== 0 && event.button !== 2) return;
    const hit = chunkManager.raycast(player.camera.position, player.getViewDirection(), 8);
    if (!hit) return;

    if (event.button === 0) {
      blockParticles.burst(hit.block, hit.x, hit.y, hit.z);
      chunkManager.setBlock(hit.x, hit.y, hit.z, Blocks.AIR);
    } else if (event.button === 2 && hit.place) {
      const { x, y, z } = hit.place;
      const selectedBlock = hud.getSelectedBlock();
      if (selectedBlock == null) return;
      if (!player.intersectsBlock(x, y, z)) {
        chunkManager.setBlock(x, y, z, selectedBlock);
      }
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.code === "Escape") {
      if (chat?.isOpen()) {
        event.preventDefault();
        chat.hide();
        syncInputState();
        return;
      }
      if (creativeInventory.isOpen()) {
        event.preventDefault();
        closeInventory();
        return;
      }
      if (pauseMenu.isOpen()) {
        event.preventDefault();
        pauseMenu.hide();
        syncInputState();
        return;
      }
      event.preventDefault();
      pauseMenu.show();
      syncInputState();
      return;
    }

    if (event.code === "KeyE" && !pauseMenu.isOpen() && !chat?.isOpen()) {
      event.preventDefault();
      if (creativeInventory.isOpen()) {
        closeInventory();
      } else {
        openInventory();
      }
      return;
    }

    if (pauseMenu.isOpen() || chat.isOpen() || creativeInventory.isOpen()) return;

    if (event.code === "F1") {
      event.preventDefault();
      hud.toggleHidden();
      return;
    }
    if (event.code === "F3") {
      event.preventDefault();
      hud.toggleDebugGui();
      return;
    }
    if (event.code === "KeyF") {
      saveWorld();
      return;
    }
    if (event.code === "KeyR") {
      event.preventDefault();
      player.position.copy(chunkManager.findSpawn());
      player.velocity.set(0, 0, 0);
      saveWorld();
    }
  });

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  window.addEventListener("resize", onResize);
  window.addEventListener("beforeunload", () => saveWorld());

  let lastFrameTime = 0;
  let renderedFrames = 0;

  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const deltaSeconds = lastFrameTime > 0 ? Math.min((now - lastFrameTime) / 1000, 0.05) : 1 / 60;
    const fps = lastFrameTime > 0 ? Math.round(1000 / (now - lastFrameTime)) : 60;
    lastFrameTime = now;

    player.update(deltaSeconds);
    blockParticles.update(deltaSeconds);
    chunkManager.update(player.position, deltaSeconds);
    worldTimeState.value += deltaSeconds * 1000;
    atmosphere.update(player.position, worldTimeState.value, deltaSeconds);
    hud.update(fps, player, chunkManager);
    renderer.render(scene, player.camera);

    renderedFrames++;
    if (renderedFrames >= 2) {
      loading.classList.add("hidden");
    }
  }

  animate();

  function saveWorld() {
    saveManager.setHotbar(hotbarItems);
    saveManager.setPlayer(player.position, new THREE.Vector2(controls.pitch, controls.yaw));
    saveManager.setWorldTime(worldTimeState.value);
    saveManager.flush();
  }

  function setWorldTime(worldTimeMs) {
    worldTimeState.value = Number.isFinite(worldTimeMs) ? worldTimeMs : 0;
    atmosphere.update(player.position, worldTimeState.value, 0);
  }
}

function runCommand(command, player, chunkManager, saveWorld, setWorldTime) {
  const parts = command.slice(1).trim().split(/\s+/);
  const name = parts.shift()?.toLowerCase();

  if (name === "tp") {
    const values = parts.map(Number);
    if (parts.length !== values.length || values.some((value) => Number.isNaN(value))) {
      return "Usage: /tp <x> <y> <z> or /tp <x> <z>";
    }

    if (values.length === 2) {
      const [x, z] = values;
      chunkManager.prepareAreaAround(x, z);
      player.position.copy(chunkManager.findSurfacePosition(x, z));
    } else if (values.length === 3) {
      const [x, y, z] = values;
      chunkManager.prepareAreaAround(x, z);
      player.position.set(x, y, z);
    } else {
      return "Usage: /tp <x> <y> <z> or /tp <x> <z>";
    }

    player.velocity.set(0, 0, 0);
    saveWorld();
    return `Teleported to ${player.position.x.toFixed(1)} ${player.position.y.toFixed(1)} ${player.position.z.toFixed(1)}`;
  }

  if (name === "time") {
    const subcommand = parts.shift()?.toLowerCase();
    if (subcommand !== "set" || parts.length !== 1) {
      return "Usage: /time set day|night|dawn|midnight";
    }

    const preset = parts[0].toLowerCase();
    const cycleLength = 14 * 60 * 1000;
    const timeMap = {
      midnight: 0,
      dawn: cycleLength * 0.25,
      day: cycleLength * 0.5,
      night: cycleLength * 0.75,
    };

    if (!(preset in timeMap)) {
      return "Usage: /time set day|night|dawn|midnight";
    }

    setWorldTime(timeMap[preset]);
    saveWorld();
    return `Set time to ${preset}`;
  }

  return `Unknown command: /${name ?? ""}`;
}

function canPlayerOccupy(position, chunkManager) {
  const halfWidth = 0.31;
  const height = 1.82;
  const minX = Math.floor(position.x - halfWidth);
  const maxX = Math.floor(position.x + halfWidth);
  const minY = Math.floor(position.y);
  const maxY = Math.floor(position.y + height);
  const minZ = Math.floor(position.z - halfWidth);
  const maxZ = Math.floor(position.z + halfWidth);

  for (let y = minY; y <= maxY; y++) {
    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        if (isSolid(chunkManager.getBlock(x, y, z))) {
          return false;
        }
      }
    }
  }
  return true;
}
