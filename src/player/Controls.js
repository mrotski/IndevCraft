export class Controls {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.yaw = 0;
    this.pitch = 0;
    this.pointerLocked = false;

    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === canvas;
    });

    document.addEventListener("mousemove", (event) => {
      if (!this.pointerLocked) return;
      const sensitivity = 0.0024;
      this.yaw += event.movementX * sensitivity;
      this.pitch += event.movementY * sensitivity;
      const limit = Math.PI / 2 - 0.01;
      this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
    });

    document.addEventListener("keydown", (event) => {
      this.keys.add(event.code);
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
        event.preventDefault();
      }
    });

    document.addEventListener("keyup", (event) => {
      this.keys.delete(event.code);
    });
  }

  isDown(code) {
    return this.keys.has(code);
  }

  getMoveVector() {
    let forward = 0;
    let right = 0;
    if (this.isDown("KeyW")) forward += 1;
    if (this.isDown("KeyS")) forward -= 1;
    if (this.isDown("KeyD")) right += 1;
    if (this.isDown("KeyA")) right -= 1;
    return { forward, right };
  }
}
