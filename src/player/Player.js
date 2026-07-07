import { WORLD_HEIGHT } from "../constants.js";
import { Blocks, isSolid } from "../blocks/BlockTypes.js";

const PLAYER_WIDTH = 0.62;
const PLAYER_HEIGHT = 1.82;
const EYE_HEIGHT = 1.62;

export class Player {
  constructor(camera, canvas, chunkManager, controls, startPosition) {
    this.canvas = canvas;
    this.chunkManager = chunkManager;
    this.controls = controls;
    this.position = startPosition.clone();
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.onGround = false;
    this.unstuckCooldown = 0;

    this.camera = camera;
    this.camera.near = 0.03;
    this.camera.far = 650;
    this.camera.updateProjectionMatrix();
    this.updateCamera();
  }

  update(deltaSeconds) {
    this.unstuckCooldown = Math.max(0, this.unstuckCooldown - deltaSeconds);
    if (!this.canOccupy(this.position) && this.unstuckCooldown === 0) {
      this.unstuck();
    }
    this.updateMovement(deltaSeconds);
    this.updateCamera();
    this.updateRotation();
  }

  updateRotation() {
    const direction = this.getViewDirection();
    // Keep the camera aligned with the same forward vector used for movement and raycasts.
    this.camera.lookAt(this.camera.position.clone().add(direction));
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
      // Three.js cameras face -Z by default, so keep world movement on the same basis.
      desiredX = (sin * forward + cos * right) * speed;
      desiredZ = (-cos * forward + sin * right) * speed;
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
      this.position.copy(this.chunkManager.findSpawn());
      this.velocity.set(0, 0, 0);
    }
  }

  moveAxis(axis, amount) {
    if (amount === 0) return;
    const next = this.position.clone();
    next[axis] += amount;
    if (this.canOccupy(next)) {
      this.position.copy(next);
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
      const candidate = this.position.clone().add(new THREE.Vector3(0, offsetY, 0));
      if (this.canOccupy(candidate)) {
        this.position.copy(candidate);
        this.velocity.set(0, 0, 0);
        this.unstuckCooldown = 0.5;
        return;
      }
    }

    this.position.copy(this.chunkManager.findSpawn());
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
    const pitch = this.controls.pitch;
    const horizontal = Math.cos(pitch);
    return new THREE.Vector3(
      Math.sin(this.controls.yaw) * horizontal,
      -Math.sin(pitch),
      -Math.cos(this.controls.yaw) * horizontal,
    ).normalize();
  }
}
