import { getBlockTextureKey } from "../blocks/BlockTypes.js";

export class BlockParticles {
  constructor(scene, textureAtlas, camera) {
    this.scene = scene;
    this.textureAtlas = textureAtlas;
    this.camera = camera;
    this.materials = new Map();
    this.particles = [];
    this.textureLoader = new THREE.TextureLoader();
  }

  burst(blockId, worldX, worldY, worldZ) {
    const textureKey = getBlockTextureKey(blockId, "top");
    const material = this.getMaterial(textureKey);
    const center = new THREE.Vector3(worldX + 0.5, worldY + 0.5, worldZ + 0.5);

    for (let index = 0; index < 18; index++) {
      const size = 0.16 + Math.random() * 0.08;
      const geometry = new THREE.PlaneGeometry(size, size);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(center);
      mesh.position.add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.75,
        (Math.random() - 0.5) * 0.75,
        (Math.random() - 0.5) * 0.75,
      ));
      mesh.lookAt(this.camera.position);
      this.scene.add(mesh);

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 3.0,
        2.0 + Math.random() * 2.2,
        (Math.random() - 0.5) * 3.0,
      );

      this.particles.push({
        mesh,
        velocity,
        age: 0,
        lifetime: 0.55 + Math.random() * 0.25,
      });
    }
  }

  update(deltaSeconds) {
    for (let index = this.particles.length - 1; index >= 0; index--) {
      const particle = this.particles[index];
      particle.age += deltaSeconds;
      particle.velocity.y -= 9.8 * deltaSeconds;
      particle.mesh.position.addScaledVector(particle.velocity, deltaSeconds);
      particle.mesh.lookAt(this.camera.position);
      const scale = Math.max(0.05, 1 - particle.age / particle.lifetime);
      particle.mesh.scale.set(scale, scale, scale);

      if (particle.age >= particle.lifetime) {
        particle.mesh.geometry.dispose();
        this.scene.remove(particle.mesh);
        this.particles.splice(index, 1);
      }
    }
  }

  getMaterial(textureKey) {
    if (this.materials.has(textureKey)) return this.materials.get(textureKey);

    const url = this.textureAtlas.getPreviewURL(textureKey);
    const texture = this.textureLoader.load(url);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.materials.set(textureKey, material);
    return material;
  }
}
