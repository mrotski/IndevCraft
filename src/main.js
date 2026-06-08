import { Blocks, isSolid } from "./blocks/BlockTypes.js";
import { TARGET_FPS, WORLD_HEIGHT } from "./constants.js";
import { SaveManager } from "./storage/SaveManager.js";
import { BlockParticles } from "./rendering/BlockParticles.js";
import { loadTextureAtlas } from "./rendering/TextureAtlas.js";
import { ChunkManager } from "./world/ChunkManager.js";
import { Controls } from "./player/Controls.js";
import { Player } from "./player/Player.js";
import { Chat } from "./ui/Chat.js";
import { HUD } from "./ui/HUD.js";
import { PauseMenu } from "./ui/PauseMenu.js";

export async function startGame() {
  const canvas = document.getElementById("gameCanvas");
  const loading = document.getElementById("loading");

  if (!window.BABYLON) {
    loading.innerHTML = "<strong>Babylon.js failed to load.</strong><span>Check your network connection and reload.</span>";
    throw new Error("Babylon.js unavailable");
  }

  const engine = new BABYLON.Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: false,
    antialias: false,
    powerPreference: "high-performance",
  });

  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.43, 0.65, 0.85, 1);
  scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR;
  scene.fogColor = new BABYLON.Color3(0.43, 0.65, 0.85);
  scene.fogStart = 34;
  scene.fogEnd = 150;
  scene.collisionsEnabled = false;
  scene.skipPointerMovePicking = true;

  const sun = new BABYLON.HemisphericLight("indev-sky-light", new BABYLON.Vector3(0.25, 1, 0.15), scene);
  sun.intensity = 0.82;
  sun.groundColor = new BABYLON.Color3(0.28, 0.25, 0.23);

  const saveManager = new SaveManager();
  if (!saveManager.data) {
    const seed = Math.floor(Math.random() * 0xffffffff);
    saveManager.create(seed);
  }

  const textureAtlas = await loadTextureAtlas(scene);
  const worldOrigin = new BABYLON.Vector3(0, 0, 0);
  const chunkManager = new ChunkManager(scene, saveManager, saveManager.seed, textureAtlas, worldOrigin);
  const savedPlayer = saveManager.getPlayer();
  const savedChunk = savedPlayer?.position
    ? chunkManager.worldToChunk(savedPlayer.position[0], savedPlayer.position[2])
    : { cx: 0, cz: 0 };
  chunkManager.queueNearbyChunks(savedChunk.cx, savedChunk.cz);
  chunkManager.generatePending(25);
  chunkManager.rebuildDirtyMeshes(25);

  const pauseMenu = new PauseMenu({
    saveManager,
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
  });

  const controls = new Controls(canvas);
  let lastPointerLocked = document.pointerLockElement === canvas;
  document.addEventListener("pointerlockchange", () => {
    const nowLocked = document.pointerLockElement === canvas;
    if (lastPointerLocked && !nowLocked && !pauseMenu.isOpen() && !chat.isOpen()) {
      pauseMenu.show();
    }
    lastPointerLocked = nowLocked;
  });
  const hasValidSavedPosition =
    savedPlayer &&
    savedPlayer.position.length === 3 &&
    savedPlayer.position[1] > 2 &&
    savedPlayer.position[1] < WORLD_HEIGHT - 2 &&
    canPlayerOccupy(new BABYLON.Vector3(...savedPlayer.position), chunkManager);
  const startPosition = hasValidSavedPosition
    ? new BABYLON.Vector3(...savedPlayer.position)
    : chunkManager.findSpawn();

  if (hasValidSavedPosition && savedPlayer?.rotation) {
    controls.pitch = savedPlayer.rotation[0];
    controls.yaw = savedPlayer.rotation[1];
  }

  const player = new Player(scene, canvas, chunkManager, controls, startPosition, worldOrigin);
  const hud = new HUD(saveManager.seed, textureAtlas);
  const blockParticles = new BlockParticles(scene, textureAtlas);
  const chat = new Chat({
    onCommand(command) {
      return runCommand(command, player, chunkManager, saveWorld);
    },
  });

  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("pointerdown", (event) => {
    if (chat.isOpen()) return;
    event.preventDefault();
    if (!controls.pointerLocked) {
      canvas.requestPointerLock();
    }
    if (event.button !== 0 && event.button !== 2) return;
    const hit = chunkManager.raycast(player.getEyePosition(), player.getViewDirection(), 8);
    if (!hit) return;

    if (event.button === 0) {
      blockParticles.burst(hit.block, hit.x, hit.y, hit.z);
      chunkManager.setBlock(hit.x, hit.y, hit.z, Blocks.AIR);
    } else if (event.button === 2 && hit.place) {
      const { x, y, z } = hit.place;
      if (!player.intersectsBlock(x, y, z)) {
        chunkManager.setBlock(x, y, z, hud.getSelectedBlock());
      }
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.code === "Escape") {
      if (chat.isOpen()) {
        event.preventDefault();
        chat.hide();
        return;
      }
      if (pauseMenu.isOpen()) {
        event.preventDefault();
        pauseMenu.hide();
        return;
      }
      event.preventDefault();
      pauseMenu.show();
      return;
    }

    if (pauseMenu.isOpen() || chat.isOpen()) return;

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
      player.position.copyFrom(chunkManager.findSpawn());
      player.velocity.set(0, 0, 0);
      saveWorld();
    }
  });

  window.addEventListener("resize", () => engine.resize());
  window.addEventListener("beforeunload", () => saveWorld());

  let renderedFrames = 0;
  let lastFrameTime = 0;
  const targetFrameMs = 1000 / TARGET_FPS;
  const originStep = 128;
  const targetOrigin = new BABYLON.Vector3(0, 0, 0);

  function recenterWorldOrigin() {
    targetOrigin.x = Math.floor(player.position.x / originStep) * originStep;
    targetOrigin.y = Math.floor(player.position.y / originStep) * originStep;
    targetOrigin.z = Math.floor(player.position.z / originStep) * originStep;
    const delta = targetOrigin.subtract(worldOrigin);
    if (delta.lengthSquared() === 0) return;
    worldOrigin.copyFrom(targetOrigin);
    chunkManager.shiftWorldOrigin(delta);
    player.updateCamera();
  }

  engine.runRenderLoop(() => {
    const now = performance.now();
    if (lastFrameTime > 0 && now - lastFrameTime < targetFrameMs) return;
    const deltaSeconds = lastFrameTime > 0 ? Math.min((now - lastFrameTime) / 1000, 0.05) : targetFrameMs / 1000;
    lastFrameTime = now;
    player.update(deltaSeconds);
    recenterWorldOrigin();
    blockParticles.update(deltaSeconds);
    chunkManager.update(player.position);
    hud.update(scene, player, chunkManager);
    scene.render();

    renderedFrames++;
    if (renderedFrames >= 2) {
      loading.classList.add("hidden");
    }
  });

  function saveWorld() {
    saveManager.setPlayer(player.position, new BABYLON.Vector2(controls.pitch, controls.yaw));
    saveManager.flush();
  }
}

function runCommand(command, player, chunkManager, saveWorld) {
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
      player.position.copyFrom(chunkManager.findSurfacePosition(x, z));
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
