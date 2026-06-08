import { getBlockTextureKey } from "../blocks/BlockTypes.js";

export class BlockParticles {
  constructor(scene, textureAtlas) {
    this.scene = scene;
    this.textureAtlas = textureAtlas;
    this.materials = new Map();
    this.particles = [];
  }

  burst(blockId, worldX, worldY, worldZ) {
    const textureKey = getBlockTextureKey(blockId, "top");
    const material = this.getMaterial(textureKey);
    const center = new BABYLON.Vector3(worldX + 0.5, worldY + 0.5, worldZ + 0.5);

    for (let index = 0; index < 18; index++) {
      const mesh = BABYLON.MeshBuilder.CreatePlane(
        `break-particle-${index}`,
        { size: 0.16 + Math.random() * 0.08 },
        this.scene,
      );
      mesh.material = material;
      mesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
      mesh.position.copyFrom(center);
      mesh.position.addInPlace(new BABYLON.Vector3(
        (Math.random() - 0.5) * 0.75,
        (Math.random() - 0.5) * 0.75,
        (Math.random() - 0.5) * 0.75,
      ));

      const velocity = new BABYLON.Vector3(
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
      particle.mesh.position.addInPlace(particle.velocity.scale(deltaSeconds));
      particle.mesh.scaling.setAll(Math.max(0.05, 1 - particle.age / particle.lifetime));

      if (particle.age >= particle.lifetime) {
        particle.mesh.dispose();
        this.particles.splice(index, 1);
      }
    }
  }

  getMaterial(textureKey) {
    if (this.materials.has(textureKey)) return this.materials.get(textureKey);

    const material = new BABYLON.StandardMaterial(`particle-${textureKey}`, this.scene);
    material.diffuseTexture = new BABYLON.Texture(
      this.textureAtlas.getPreviewURL(textureKey),
      this.scene,
      false,
      false,
      BABYLON.Texture.NEAREST_SAMPLINGMODE,
    );
    material.diffuseTexture.hasAlpha = true;
    material.useAlphaFromDiffuseTexture = true;
    material.transparencyMode = BABYLON.Material.MATERIAL_ALPHATEST;
    material.alphaCutOff = 0.12;
    material.specularColor = BABYLON.Color3.Black();
    material.emissiveColor = new BABYLON.Color3(0.08, 0.08, 0.08);
    material.backFaceCulling = false;
    this.materials.set(textureKey, material);
    return material;
  }
}
