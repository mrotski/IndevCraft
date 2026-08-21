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
    return new THREE.MeshBasicMaterial({
      map: this.textureAtlas.texture,
      vertexColors: true,
      transparent: true,
      alphaTest: 0.05,
      side: THREE.FrontSide,
    });
  }

  build(chunk) {
    const positionsOpaque = [];
    const indicesOpaque = [];
    const normalsOpaque = [];
    const colorsOpaque = [];
    const uvsOpaque = [];
    let vertexOpaque = 0;

    const positionsTransparent = [];
    const indicesTransparent = [];
    const normalsTransparent = [];
    const colorsTransparent = [];
    const uvsTransparent = [];
    let vertexTransparent = 0;

    const positionsWater = [];
    const indicesWater = [];
    const normalsWater = [];
    const colorsWater = [];
    const uvsWater = [];
    let vertexWater = 0;

    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const block = chunk.getBlock(x, y, z);
          if (block === Blocks.AIR) continue;

          const data = BlockData[block];
          const isTrans = !!data?.transparent;

          if (data.crossed) {
            if (isTrans) {
              vertexTransparent = this.addCrossedBlock(
                chunk,
                x,
                y,
                z,
                block,
                positionsTransparent,
                normalsTransparent,
                indicesTransparent,
                colorsTransparent,
                uvsTransparent,
                vertexTransparent,
              );
            } else {
              vertexOpaque = this.addCrossedBlock(
                chunk,
                x,
                y,
                z,
                block,
                positionsOpaque,
                normalsOpaque,
                indicesOpaque,
                colorsOpaque,
                uvsOpaque,
                vertexOpaque,
              );
            }
            continue;
          }

          for (const face of FACE_DIRECTIONS) {
            if (!this.shouldRenderFace(chunk, x, y, z, face)) continue;
            if (block === Blocks.WATER) {
              vertexWater = this.addFace(
                chunk,
                x,
                y,
                z,
                block,
                face,
                positionsWater,
                normalsWater,
                indicesWater,
                colorsWater,
                uvsWater,
                vertexWater,
              );
            } else if (isTrans) {
              vertexTransparent = this.addFace(
                chunk,
                x,
                y,
                z,
                block,
                face,
                positionsTransparent,
                normalsTransparent,
                indicesTransparent,
                colorsTransparent,
                uvsTransparent,
                vertexTransparent,
              );
            } else {
              vertexOpaque = this.addFace(
                chunk,
                x,
                y,
                z,
                block,
                face,
                positionsOpaque,
                normalsOpaque,
                indicesOpaque,
                colorsOpaque,
                uvsOpaque,
                vertexOpaque,
              );
            }
          }
        }
      }
    }

    if (chunk.meshes) {
      for (const mesh of chunk.meshes) {
        if (mesh.geometry && mesh.geometry.dispose) mesh.geometry.dispose();
        if (mesh.material && mesh.material.dispose) mesh.material.dispose();
        if (mesh.parent && typeof mesh.parent.remove === "function") mesh.parent.remove(mesh);
      }
      chunk.meshes = null;
      chunk.mesh = null;
    }

    const meshes = [];

    const addMeshFromArrays = (positionsArr, normalsArr, uvsArr, colorsArr, indicesArr, material) => {
      if (positionsArr.length === 0) return null;
      const vertexCountLocal = positionsArr.length / 3;
      if (normalsArr.length / 3 !== vertexCountLocal || colorsArr.length / 3 !== vertexCountLocal || uvsArr.length / 2 !== vertexCountLocal) {
        console.error("MeshBuilder: attribute length mismatch (chunk)", {
          positions: positionsArr.length,
          normals: normalsArr.length,
          colors: colorsArr.length,
          uvs: uvsArr.length,
          indices: indicesArr.length,
        });
        return null;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positionsArr, 3));
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normalsArr, 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvsArr, 2));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(colorsArr, 3));
      if (vertexCountLocal > 65535 && typeof Uint32Array !== "undefined") {
        geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indicesArr), 1));
      } else {
        geometry.setIndex(indicesArr);
      }

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(chunk.cx * CHUNK_SIZE, 0, chunk.cz * CHUNK_SIZE);
      this.scene.add(mesh);
      return mesh;
    };

    const opaqueMaterial = this.material.clone();
    opaqueMaterial.side = THREE.FrontSide;
    opaqueMaterial.transparent = false;
    opaqueMaterial.depthWrite = true;

    const opaqueMesh = addMeshFromArrays(
      positionsOpaque,
      normalsOpaque,
      uvsOpaque,
      colorsOpaque,
      indicesOpaque,
      opaqueMaterial,
    );
    if (opaqueMesh) meshes.push(opaqueMesh);

    if (positionsTransparent.length > 0) {
      const transMaterial = this.material.clone();
      transMaterial.side = THREE.DoubleSide;
      transMaterial.transparent = true;
      transMaterial.depthWrite = true;
      transMaterial.blending = THREE.NormalBlending;

      const transMesh = addMeshFromArrays(
        positionsTransparent,
        normalsTransparent,
        uvsTransparent,
        colorsTransparent,
        indicesTransparent,
        transMaterial,
      );
      if (transMesh) {
        transMesh.renderOrder = 1;
        meshes.push(transMesh);
      }
    }

    if (positionsWater.length > 0) {
      const waterMaterial = this.material.clone();
      waterMaterial.side = THREE.DoubleSide;
      waterMaterial.transparent = true;
      waterMaterial.depthWrite = false;
      waterMaterial.blending = THREE.NormalBlending;

      const waterMesh = addMeshFromArrays(
        positionsWater,
        normalsWater,
        uvsWater,
        colorsWater,
        indicesWater,
        waterMaterial,
      );
      if (waterMesh) {
        waterMesh.renderOrder = 2;
        meshes.push(waterMesh);
      }
    }

    if (meshes.length === 0) {
      chunk.dirty = false;
      return;
    }

    chunk.meshes = meshes;
    chunk.mesh = meshes[0];
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
    const faceUvs = [
      [uv.u1, uv.v0],
      [uv.u0, uv.v0],
      [uv.u0, uv.v1],
      [uv.u1, uv.v1],
    ];

    for (let index = 0; index < vertices.length; index++) {
      const point = vertices[index];
      positions.push(x + point[0], y + point[1], z + point[2]);
      normals.push(face.normal[0], face.normal[1], face.normal[2]);
      colors.push(color[0] * shade, color[1] * shade, color[2] * shade);
      uvs.push(faceUvs[index][0], faceUvs[index][1]);
    }

    // Standard winding (0,1,2) and (0,2,3)
    indices.push(vertex, vertex + 1, vertex + 2, vertex, vertex + 2, vertex + 3);
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
      [uv.u0, uv.v0],
      [uv.u1, uv.v0],
      [uv.u1, uv.v1],
      [uv.u0, uv.v1],
    ];
    const shade = 0.88 * (0.35 + 0.65 * (this.getFaceLight(chunk, x, y, z, [0, 1, 0]) / 15));

    for (const quad of quads) {
      for (let index = 0; index < quad.length; index++) {
        const point = quad[index];
        positions.push(x + point[0], y + point[1], z + point[2]);
        normals.push(0, 1, 0);
        colors.push(color[0] * shade, color[1] * shade, color[2] * shade);
        uvs.push(faceUvs[index][0], faceUvs[index][1]);
      }
      // Standard winding per quad
      indices.push(vertex, vertex + 1, vertex + 2, vertex, vertex + 2, vertex + 3);
      vertex += 4;
    }
    return vertex;
  }

  getSurfacePriority(block) {
    if (block === Blocks.WATER) return 1;
    if (block === Blocks.SAND) return 2;
    if (block === Blocks.DIRT) return 3;
    if (block === Blocks.GRASS) return 4;
    return 5;
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
