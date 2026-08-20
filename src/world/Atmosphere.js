const CYCLE_LENGTH_MS = 14 * 60 * 1000;

export class Atmosphere {
  constructor(scene, sunLight) {
    this.scene = scene;
    this.sunLight = sunLight;
    this.fogEnabled = true;

    this.daySky = new THREE.Color(0xcfd8dd);
    this.nightSky = new THREE.Color(0x09111f);
    this.dayFog = new THREE.Color(0xd6d8d6);
    this.nightFog = new THREE.Color(0x0b1324);

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
    const daylight = smoothstep(0.03, 0.88, sunFactor);
    const nightBlend = smoothstep(0.08, 0.78, moonFactor);
    const skyColor = this.nightSky.clone().lerp(this.daySky, daylight);
    skyColor.lerp(new THREE.Color(0x142438), nightBlend * 0.35);
    this.scene.background.copy(skyColor);

    if (this.fogEnabled) {
      if (!this.scene.fog) {
        this.scene.fog = new THREE.Fog(skyColor.getHex(), 28, 74);
      }
      const fogColor = this.nightFog.clone().lerp(this.dayFog, daylight);
      fogColor.lerp(new THREE.Color(0x203044), nightBlend * 0.45);
      this.scene.fog.color.copy(fogColor);
      this.scene.fog.near = lerp(22, 34, daylight);
      this.scene.fog.far = lerp(48, 78, daylight);
    }

    this.sunLight.intensity = lerp(0.12, 0.95, daylight);
    if (this.sunLight.color) {
      this.sunLight.color.set(0xfff6df).lerp(new THREE.Color(0x99b6ff), 1 - daylight);
    }
    if (this.sunLight.groundColor) {
      this.sunLight.groundColor.set(0x4a3d2c).lerp(new THREE.Color(0x111a2b), 1 - daylight);
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
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function createCelestialTexture(kind) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const center = 64;
  if (kind === "sun") {
    const glow = ctx.createRadialGradient(center, center, 12, center, center, 58);
    glow.addColorStop(0, "rgba(255, 246, 176, 0.95)");
    glow.addColorStop(0.45, "rgba(255, 213, 92, 0.75)");
    glow.addColorStop(1, "rgba(255, 160, 48, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(center, center, 58, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(center, center);
    ctx.fillStyle = "#ffda62";
    ctx.strokeStyle = "#fff2a5";
    ctx.lineWidth = 5;
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      const inner = 40 + (i % 2 === 0 ? 1 : -1);
      const outer = 56;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle + 0.08) * outer, Math.sin(angle + 0.08) * outer);
      ctx.lineTo(Math.cos(angle - 0.08) * outer, Math.sin(angle - 0.08) * outer);
      ctx.closePath();
      ctx.globalAlpha = 0.7;
      ctx.fill();
    }
    ctx.restore();

    const core = ctx.createRadialGradient(center - 8, center - 10, 8, center, center, 30);
    core.addColorStop(0, "#fff9d3");
    core.addColorStop(0.5, "#ffe27b");
    core.addColorStop(1, "#ffca41");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(center, center, 30, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
    ctx.beginPath();
    ctx.arc(54, 50, 10, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const body = ctx.createRadialGradient(52, 50, 10, center, center, 34);
    body.addColorStop(0, "#f2f2f2");
    body.addColorStop(0.7, "#cbcbcb");
    body.addColorStop(1, "#8a8a8a");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(center, center, 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.beginPath();
    ctx.arc(54, 48, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(115, 115, 115, 0.65)";
    ctx.beginPath();
    ctx.arc(50, 52, 7, 0, Math.PI * 2);
    ctx.arc(72, 58, 5, 0, Math.PI * 2);
    ctx.arc(62, 76, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(center + 2, center - 1, 24, -0.8, 2.2);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
