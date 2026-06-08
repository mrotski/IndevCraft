import { WORLD_HEIGHT } from "../constants.js";
import { Blocks, isSolid } from "../blocks/BlockTypes.js";

const PLAYER_WIDTH = 0.62;
const PLAYER_HEIGHT = 1.82;
const EYE_HEIGHT = 1.62;

export class Player {
  constructor(scene, canvas, chunkManager, controls, startPosition) {
    this.scene = scene;
    this.canvas = canvas;
    this.chunkManager = chunkManager;
    this.controls = controls;
    this.position = startPosition.clone();
    this.velocity = new BABYLON.Vector3(0, 0, 0);
    this.onGround = false;
    this.unstuckCooldown = 0;

    this.camera = new BABYLON.FreeCamera("player-camera", this.position.clone(), scene);
    this.camera.minZ = 0.03;
    this.camera.maxZ = 650;
    this.camera.fov = 1.05;
    this.camera.inertia = 0;
    this.camera.attachControl(canvas, false);
    this.camera.inputs.clear();
    this.updateCamera();
  }

  update(deltaSeconds) {
    this.updateRotation();
    this.unstuckCooldown = Math.max(0, this.unstuckCooldown - deltaSeconds);
    if (!this.canOccupy(this.position) && this.unstuckCooldown === 0) {
      this.unstuck();
    }
    this.updateMovement(deltaSeconds);
    this.updateCamera();
  }

  updateRotation() {
    this.camera.rotation.x = this.controls.pitch;
    this.camera.rotation.y = this.controls.yaw;
    this.camera.rotation.z = 0;
  }

  updateMovement(deltaSeconds) {
    const move = this.controls.getMoveVector();
    const length = Math.hypot(move.forward, move.right);
    const inWater = this.isInWater(this.position);
    const speed = inWater ? 2.4 : this.controls.isDown("ShiftLeft") || this.controls.isDown("ShiftRight") ? 6.2 : 4.2;

    let desiredX = 0;
    let desiredZ = 0;
    if (length > 0) {
      const forward = move.forward / length;
      const right = move.right / length;
      const sin = Math.sin(this.controls.yaw);
      const cos = Math.cos(this.controls.yaw);
      desiredX = (sin * forward + cos * right) * speed;
      desiredZ = (cos * forward - sin * right) * speed;
    }

    this.velocity.x = desiredX;
    this.velocity.z = desiredZ;

    if (inWater) {
      if (this.controls.isDown("Space")) {
        this.velocity.y = 4.5;
      } else if (this.controls.isDown("ShiftLeft") || this.controls.isDown("ShiftRight")) {
        this.velocity.y = -2.2;
      } else {
        this.velocity.y = Math.max(this.velocity.y - 8 * deltaSeconds, -1.2);
      }
    } else {
      this.velocity.y -= 24 * deltaSeconds;
      if (this.onGround && this.controls.isDown("Space")) {
        this.velocity.y = 8.3;
        this.onGround = false;
      }
    }

    this.moveAxis("x", this.velocity.x * deltaSeconds);
    this.moveAxis("z", this.velocity.z * deltaSeconds);
    this.moveAxis("y", this.velocity.y * deltaSeconds);

    if (this.position.y < 2 && !this.isInWater(this.position)) {
      this.position.copyFrom(this.chunkManager.findSpawn());
      this.velocity.y = 0;
    }
  }

  moveAxis(axis, amount) {
    if (amount === 0) return;
    const next = this.position.clone();
    next[axis] += amount;
    if (this.canOccupy(next)) {
      this.position.copyFrom(next);
      if (axis === "y") this.onGround = false;
      return;
    }
    if (axis === "y") {
      if (amount < 0) this.onGround = true;
      this.velocity.y = 0;
    }
  }

  canOccupy(position) {
    const half = PLAYER_WIDTH / 2;
    const minX = Math.floor(position.x - half);
    const maxX = Math.floor(position.x + half);
    const minY = Math.floor(position.y);
    const maxY = Math.floor(position.y + PLAYER_HEIGHT);
    const minZ = Math.floor(position.z - half);
    const maxZ = Math.floor(position.z + half);

    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          if (isSolid(this.chunkManager.getBlock(x, y, z))) return false;
        }
      }
    }
    return true;
  }

  isInWater(position) {
    const half = PLAYER_WIDTH / 2;
    const minX = Math.floor(position.x - half);
    const maxX = Math.floor(position.x + half);
    const minY = Math.floor(position.y);
    const maxY = Math.floor(position.y + PLAYER_HEIGHT - 0.1);
    const minZ = Math.floor(position.z - half);
    const maxZ = Math.floor(position.z + half);

    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          if (this.chunkManager.getBlock(x, y, z) === Blocks.WATER) return true;
        }
      }
    }
    return false;
  }

  unstuck() {
    for (let offsetY = 1; offsetY < 24; offsetY++) {
      const candidate = this.position.add(new BABYLON.Vector3(0, offsetY, 0));
      if (this.canOccupy(candidate)) {
        this.position.copyFrom(candidate);
        this.velocity.set(0, 0, 0);
        this.unstuckCooldown = 0.5;
        return;
      }
    }

    this.position.copyFrom(this.chunkManager.findSpawn());
    this.velocity.set(0, 0, 0);
    this.unstuckCooldown = 0.5;
  }

  intersectsBlock(x, y, z) {
    const half = PLAYER_WIDTH / 2;
    return (
      x + 1 > this.position.x - half &&
      x < this.position.x + half &&
      y + 1 > this.position.y &&
      y < this.position.y + PLAYER_HEIGHT &&
      z + 1 > this.position.z - half &&
      z < this.position.z + half
    );
  }

  updateCamera() {
    this.camera.position.set(this.position.x, this.position.y + EYE_HEIGHT, this.position.z);
  }

  getViewDirection() {
    const horizontal = Math.cos(this.controls.pitch);
    return new BABYLON.Vector3(
      Math.sin(this.controls.yaw) * horizontal,
      -Math.sin(this.controls.pitch),
      Math.cos(this.controls.yaw) * horizontal,
    ).normalize();
  }
}
