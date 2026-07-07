import { CHUNK_SIZE, FACE_DIRECTIONS, WORLD_HEIGHT } from "../constants.js";
import { BlockData, Blocks, getBlockTextureKey, occludesFaces } from "../blocks/BlockTypes.js";

export class MeshBuilderThree {
  constructor(scene, chunkManager, textureAtlas) {
    this.scene = scene;
    this.chunkManager = chunkManager;
    this.textureAtlas = textureAtlas;
  }

  build(chunk) {
    const positions = [];
    const normals = [];
    const uvs = [];
    const colors = [];
    const indices = [];
    let vertex = 0;

    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const block = chunk.getBlock(x, y, z);
          if (block === Blocks.AIR) continue;
          const data = BlockData[block];
          if (data.crossed) {
            // skip crossed for prototype
            continue;
          }
          for (const face of FACE_DIRECTIONS) {
            if (!this.shouldRenderFace(chunk, x, y, z, face)) continue;
            const verts = faceVertices(face.name);
            const color = this.getFaceColor(block, face.name);
            const uv = this.textureAtlas.getUV(getBlockTextureKey(block, face.name));
            const faceUvs = [
              [uv.u1, uv.v0],
              [uv.u0, uv.v0],
              [uv.u0, uv.v1],
              [uv.u1, uv.v1],
            ];

            for (let i = 0; i < verts.length; i++) {
              const p = verts[i];
              positions.push(x + p[0], y + p[1], z + p[2]);
              normals.push(face.normal[0], face.normal[1], face.normal[2]);
              uvs.push(faceUvs[i][0], faceUvs[i][1]);
              colors.push(color[0], color[1], color[2]);
            }
            indices.push(vertex, vertex + 2, vertex + 1, vertex, vertex + 3, vertex + 2);
            vertex += 4;
          }
        }
      }
    }

    // dispose previous mesh
    if (chunk.mesh && chunk.mesh._threeMesh) {
      const m = chunk.mesh._threeMesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) m.material.dispose();
      if (m.parent) m.parent.remove(m);
      chunk.mesh = null;
    }

    if (positions.length === 0) {
      chunk.dirty = false;
      return;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);

    const material = new THREE.MeshBasicMaterial({
      map: this.textureAtlas.texture,
      vertexColors: true,
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
      alphaTest: 0.05,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(chunk.cx * CHUNK_SIZE, 0, chunk.cz * CHUNK_SIZE);
    this.scene.add(mesh);

    chunk.mesh = { _threeMesh: mesh };
    chunk.dirty = false;
  }

  shouldRenderFace(chunk, x, y, z, face) {
    const worldX = chunk.cx * CHUNK_SIZE + x;
    const worldZ = chunk.cz * CHUNK_SIZE + z;
    const neighbor = this.chunkManager.getBlock(worldX + face.offset[0], y + face.offset[1], worldZ + face.offset[2]);
    return !occludesFaces(neighbor);
  }

  getFaceColor(block, faceName) {
    const data = BlockData[block];
    if (block === Blocks.GRASS && faceName !== "top") return data.sideColor;
    if (block === Blocks.WOOD && (faceName === "top" || faceName === "bottom")) return data.topColor;
    return data.color;
  }
}

function faceVertices(name) {
  // re-create a simple mapping from FACE_VERTICES in original file
  const map = {
    north: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]],
    south: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
    west: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]],
    east: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]],
    top: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]],
    bottom: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
  };
  return map[name] || map.top;
}
