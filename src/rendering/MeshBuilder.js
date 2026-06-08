import { CHUNK_SIZE, FACE_DIRECTIONS, WORLD_HEIGHT } from "../constants.js";
import { BlockData, Blocks, getBlockTextureKey, occludesFaces } from "../blocks/BlockTypes.js";

const FACE_VERTICES = {
  north: [
    [1, 0, 0],
    [0, 0, 0],
    [0, 1, 0],
    [1, 1, 0],
  ],
  south: [
    [0, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 1, 1],
  ],
  west: [
    [0, 0, 0],
    [0, 0, 1],
    [0, 1, 1],
    [0, 1, 0],
  ],
  east: [
    [1, 0, 1],
    [1, 0, 0],
    [1, 1, 0],
    [1, 1, 1],
  ],
  top: [
    [0, 1, 1],
    [1, 1, 1],
    [1, 1, 0],
    [0, 1, 0],
  ],
  bottom: [
    [0, 0, 0],
    [1, 0, 0],
    [1, 0, 1],
    [0, 0, 1],
  ],
};

const FACE_SHADE = {
  top: 1.0,
  south: 0.82,
  east: 0.76,
  west: 0.66,
  north: 0.58,
  bottom: 0.45,
};

export class MeshBuilder {
  constructor(scene, chunkManager, textureAtlas) {
    this.scene = scene;
    this.chunkManager = chunkManager;
    this.textureAtlas = textureAtlas;
    this.material = this.createMaterial();
  }

  createMaterial() {
    const material = new BABYLON.StandardMaterial("classic-voxel-material", this.scene);
    material.diffuseColor = BABYLON.Color3.White();
    material.diffuseTexture = this.textureAtlas.texture;
    material.diffuseTexture.hasAlpha = true;
    material.useAlphaFromDiffuseTexture = true;
    material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
    material.needAlphaBlending = true;
    material.specularColor = BABYLON.Color3.Black();
    material.emissiveColor = new BABYLON.Color3(0.02, 0.02, 0.02);
    material.backFaceCulling = true;
    material.disableLighting = false;
    return material;
  }

  build(chunk) {
    const positions = [];
    const indices = [];
    const normals = [];
    const colors = [];
    const uvs = [];
    let vertex = 0;

    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const block = chunk.getBlock(x, y, z);
          if (block === Blocks.AIR) continue;
          const data = BlockData[block];
          if (data.crossed) {
            vertex = this.addCrossedBlock(chunk, x, y, z, block, positions, normals, indices, colors, uvs, vertex);
            continue;
          }
          for (const face of FACE_DIRECTIONS) {
            if (!this.shouldRenderFace(chunk, x, y, z, face)) continue;
            vertex = this.addFace(chunk, x, y, z, block, face, positions, normals, indices, colors, uvs, vertex);
          }
        }
      }
    }

    if (chunk.mesh) chunk.mesh.dispose();
    const mesh = new BABYLON.Mesh(`chunk-${chunk.cx}-${chunk.cz}`, this.scene);
    mesh.position.set(
      chunk.cx * CHUNK_SIZE - this.chunkManager.worldOrigin.x,
      -this.chunkManager.worldOrigin.y,
      chunk.cz * CHUNK_SIZE - this.chunkManager.worldOrigin.z,
    );
    mesh.material = this.material;
    mesh.hasVertexAlpha = true;
    mesh.alwaysSelectAsActiveMesh = false;

    const vertexData = new BABYLON.VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.colors = colors;
    vertexData.uvs = uvs;
    vertexData.applyToMesh(mesh, true);

    chunk.mesh = mesh;
    chunk.dirty = false;
  }

  shouldRenderFace(chunk, x, y, z, face) {
    const worldX = chunk.cx * CHUNK_SIZE + x;
    const worldZ = chunk.cz * CHUNK_SIZE + z;
    const neighbor = this.chunkManager.getBlock(
      worldX + face.offset[0],
      y + face.offset[1],
      worldZ + face.offset[2],
    );
    return !occludesFaces(neighbor);
  }

  addFace(chunk, x, y, z, block, face, positions, normals, indices, colors, uvs, vertex) {
    const vertices = FACE_VERTICES[face.name];
    const color = this.getFaceColor(block, face.name);
    const uv = this.textureAtlas.getUV(getBlockTextureKey(block, face.name));
    const light = this.getFaceLight(chunk, x, y, z, face.offset);
    const shade = FACE_SHADE[face.name] * (0.24 + 0.76 * (light / 15));
    const alpha = BlockData[block].alpha ?? 1;
    const faceUvs = [
      [uv.u1, uv.v1],
      [uv.u0, uv.v1],
      [uv.u0, uv.v0],
      [uv.u1, uv.v0],
    ];

    for (let index = 0; index < vertices.length; index++) {
      const point = vertices[index];
      positions.push(x + vertexOffset(point[0]), y + vertexOffset(point[1]), z + vertexOffset(point[2]));
      normals.push(face.normal[0], face.normal[1], face.normal[2]);
      colors.push(color[0] * shade, color[1] * shade, color[2] * shade, alpha);
      uvs.push(faceUvs[index][0], faceUvs[index][1]);
    }
    indices.push(vertex, vertex + 2, vertex + 1, vertex, vertex + 3, vertex + 2);
    return vertex + 4;
  }

  addCrossedBlock(chunk, x, y, z, block, positions, normals, indices, colors, uvs, vertex) {
    const quads = [
      [
        [0.12, 0, 0.12],
        [0.88, 0, 0.88],
        [0.88, 0.9, 0.88],
        [0.12, 0.9, 0.12],
      ],
      [
        [0.88, 0, 0.12],
        [0.12, 0, 0.88],
        [0.12, 0.9, 0.88],
        [0.88, 0.9, 0.12],
      ],
    ];
    const color = this.getFaceColor(block, "top");
    const uv = this.textureAtlas.getUV(getBlockTextureKey(block, "top"));
    const faceUvs = [
      [uv.u0, uv.v1],
      [uv.u1, uv.v1],
      [uv.u1, uv.v0],
      [uv.u0, uv.v0],
    ];
    const shade = 0.88 * (0.35 + 0.65 * (this.getFaceLight(chunk, x, y, z, [0, 1, 0]) / 15));

    for (const quad of quads) {
      for (let index = 0; index < quad.length; index++) {
        const point = quad[index];
        positions.push(x + point[0], y + point[1], z + point[2]);
        normals.push(0, 1, 0);
        colors.push(color[0] * shade, color[1] * shade, color[2] * shade, 1);
        uvs.push(faceUvs[index][0], faceUvs[index][1]);
      }
      indices.push(vertex, vertex + 2, vertex + 1, vertex, vertex + 3, vertex + 2);
      indices.push(vertex + 1, vertex + 2, vertex, vertex + 2, vertex + 3, vertex);
      vertex += 4;
    }
    return vertex;
  }

  getFaceColor(block, faceName) {
    const data = BlockData[block];
    if (block === Blocks.GRASS && faceName !== "top") return data.sideColor;
    if (block === Blocks.WOOD && (faceName === "top" || faceName === "bottom")) return data.topColor;
    return data.color;
  }

  getFaceLight(chunk, x, y, z, offset) {
    const worldX = chunk.cx * CHUNK_SIZE + x + offset[0];
    const worldY = y + offset[1];
    const worldZ = chunk.cz * CHUNK_SIZE + z + offset[2];
    return Math.max(this.chunkManager.getSunLight(worldX, worldY, worldZ), this.chunkManager.getBlockLight(worldX, worldY, worldZ));
  }
}
