const CYCLE_LENGTH_MS = 14 * 60 * 1000;

export class Atmosphere {
  constructor(scene, sunLight) {
    this.scene = scene;
    this.sunLight = sunLight;
    this.fogEnabled = true;

    this.daySky = new THREE.Color(0x6faddb);
    this.nightSky = new THREE.Color(0x081326);
    this.dayFog = new THREE.Color(0x6faddb);
    this.nightFog = new THREE.Color(0x0b1327);

    this.cloudTexture = createCloudTexture();
    this.cloudTexture.wrapS = THREE.RepeatWrapping;
    this.cloudTexture.wrapT = THREE.RepeatWrapping;
    this.cloudTexture.magFilter = THREE.NearestFilter;
    this.cloudTexture.minFilter = THREE.NearestFilter;
    this.cloudTexture.generateMipmaps = false;

    this.cloudMaterial = new THREE.MeshBasicMaterial({
      map: this.cloudTexture,
      transparent: false,
      depthWrite: true,
      side: THREE.DoubleSide,
    });

    this.cloudPlane = new THREE.Mesh(new THREE.PlaneGeometry(420, 420, 1, 1), this.cloudMaterial);
    this.cloudPlane.rotation.x = -Math.PI / 2;
    this.cloudPlane.position.y = 92;
    this.scene.add(this.cloudPlane);

    this.sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: createCelestialTexture("sun"),
      transparent: true,
      depthWrite: false,
    }));
    this.sunSprite.scale.set(18, 18, 1);
    this.scene.add(this.sunSprite);

    this.moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: createCelestialTexture("moon"),
      transparent: true,
      depthWrite: false,
    }));
    this.moonSprite.scale.set(14, 14, 1);
    this.scene.add(this.moonSprite);

  }

  setFogEnabled(enabled) {
    this.fogEnabled = !!enabled;
    if (!this.fogEnabled) {
      this.scene.fog = null;
    }
  }

  update(playerPosition, worldTimeMs, deltaSeconds) {
    const cycleMs = ((worldTimeMs % CYCLE_LENGTH_MS) + CYCLE_LENGTH_MS) % CYCLE_LENGTH_MS;
    const phase = cycleMs / CYCLE_LENGTH_MS;
    const sunAngle = phase * Math.PI * 2 - Math.PI / 2;
    const sunFactor = Math.max(0, Math.sin(sunAngle));
    const moonFactor = Math.max(0, Math.sin(sunAngle + Math.PI));
    const daylight = Math.pow(sunFactor, 0.8);

    const skyColor = this.nightSky.clone().lerp(this.daySky, daylight);
    this.scene.background.copy(skyColor);

    if (this.fogEnabled) {
      if (!this.scene.fog) {
        this.scene.fog = new THREE.Fog(skyColor.getHex(), 28, 74);
      }
      this.scene.fog.color.copy(skyColor);
      this.scene.fog.near = lerp(24, 34, daylight);
      this.scene.fog.far = lerp(52, 74, daylight);
    }

    this.sunLight.intensity = lerp(0.18, 0.9, daylight);
    if (this.sunLight.color) {
      this.sunLight.color.set(0xffffff).lerp(new THREE.Color(0xb4c8ff), 1 - daylight);
    }
    if (this.sunLight.groundColor) {
      this.sunLight.groundColor.set(0x443322).lerp(new THREE.Color(0x17141f), 1 - daylight);
    }

    const radius = 132;
    const heightScale = 88;
    const sunOffset = new THREE.Vector3(
      Math.cos(sunAngle) * radius,
      Math.sin(sunAngle) * heightScale + 18,
      Math.sin(sunAngle * 0.45) * 18,
    );
    const moonOffset = new THREE.Vector3(
      Math.cos(sunAngle + Math.PI) * radius,
      Math.sin(sunAngle + Math.PI) * heightScale + 16,
      Math.sin((sunAngle + Math.PI) * 0.45) * 18,
    );

    this.sunSprite.visible = sunFactor > 0.02;
    this.moonSprite.visible = moonFactor > 0.02;
    this.sunSprite.material.opacity = 0.25 + 0.75 * sunFactor;
    this.moonSprite.material.opacity = 0.25 + 0.75 * moonFactor;
    this.sunSprite.position.copy(playerPosition).add(sunOffset);
    this.moonSprite.position.copy(playerPosition).add(moonOffset);

    const cloudDrift = worldTimeMs * 0.00002;
    this.cloudPlane.position.set(playerPosition.x + cloudDrift, 92, playerPosition.z + cloudDrift * 0.35);
    const cloudTint = lerp(0.45, 1.0, daylight);
    this.cloudMaterial.color.setRGB(cloudTint, cloudTint, cloudTint);
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function createCloudTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = "#9fd4ff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff";
  const clusters = [
    [36, 64, 32], [88, 44, 30], [146, 70, 28], [210, 58, 34],
    [52, 166, 30], [116, 140, 34], [184, 172, 28], [220, 178, 26],
    [24, 226, 22], [92, 216, 30], [158, 218, 34], [214, 226, 22],
  ];
  for (const [x, y, size] of clusters) {
    drawPuff(ctx, x, y, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function drawPuff(ctx, x, y, size) {
  const radii = [1.0, 0.78, 0.62];
  for (let i = 0; i < radii.length; i++) {
    ctx.beginPath();
    ctx.ellipse(x + size * i * 0.36, y + (i === 1 ? -size * 0.12 : 0), size * radii[i], size * radii[i] * 0.58, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function createCelestialTexture(kind) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const center = 64;
  if (kind === "sun") {
    ctx.fillStyle = "#ffd95a";
    ctx.beginPath();
    ctx.arc(center, center, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffef9c";
    ctx.lineWidth = 6;
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const inner = 38;
      const outer = 52;
      ctx.beginPath();
      ctx.moveTo(center + Math.cos(angle) * inner, center + Math.sin(angle) * inner);
      ctx.lineTo(center + Math.cos(angle) * outer, center + Math.sin(angle) * outer);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = "#d8d8d8";
    ctx.beginPath();
    ctx.arc(center, center, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b8b8b8";
    ctx.beginPath();
    ctx.arc(54, 48, 6, 0, Math.PI * 2);
    ctx.arc(73, 63, 5, 0, Math.PI * 2);
    ctx.arc(61, 79, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
