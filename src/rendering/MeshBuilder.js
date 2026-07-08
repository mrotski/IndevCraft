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

  build(chunk, lodLevel = 0) {
    if (lodLevel > 0) {
      this.buildLod(chunk, lodLevel);
      return;
    }

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
            if (isTrans) {
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

    if (meshes.length === 0) {
      chunk.dirty = false;
      return;
    }

    chunk.meshes = meshes;
    chunk.mesh = meshes[0];
    chunk.dirty = false;
  }

  buildLod(chunk, lodLevel) {
    const step = 1 << lodLevel;
    const cellsX = Math.ceil(CHUNK_SIZE / step);
    const cellsZ = Math.ceil(CHUNK_SIZE / step);
    const grid = Array.from({ length: cellsZ }, () => Array(cellsX).fill(null));

    for (let cellZ = 0; cellZ < cellsZ; cellZ++) {
      for (let cellX = 0; cellX < cellsX; cellX++) {
        grid[cellZ][cellX] = this.sampleLodCell(chunk, cellX * step, cellZ * step, step);
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

    const emitQuad = (target, vertices, normal, block, faceName, shade, lightPoint) => {
      const color = this.getFaceColor(block, faceName);
      const uv = this.textureAtlas.getUV(getBlockTextureKey(block, faceName));
      const repeatX = Math.max(1, Math.ceil(this.getLodFaceSpan(vertices, 0, 1)));
      const repeatY = Math.max(1, Math.ceil(this.getLodFaceSpan(vertices, 0, 3)));
      const faceUvs = this.getLodFaceUvs(uv, repeatX, repeatY);
      const light = this.getLodLight(chunk, lightPoint);
      const litShade = shade * (0.24 + 0.76 * (light / 15));
      const nextVertex = this.appendQuad(
        target.positions,
        target.normals,
        target.indices,
        target.colors,
        target.uvs,
        target.vertex,
        vertices,
        normal,
        color,
        litShade,
        faceUvs,
      );
      target.vertex = nextVertex;
    };

    for (let cellZ = 0; cellZ < cellsZ; cellZ++) {
      for (let cellX = 0; cellX < cellsX; cellX++) {
        const cell = grid[cellZ][cellX];
        if (!cell) continue;

        const target = BlockData[cell.block]?.transparent
          ? { positions: positionsTransparent, normals: normalsTransparent, indices: indicesTransparent, colors: colorsTransparent, uvs: uvsTransparent, vertex: vertexTransparent }
          : { positions: positionsOpaque, normals: normalsOpaque, indices: indicesOpaque, colors: colorsOpaque, uvs: uvsOpaque, vertex: vertexOpaque };

        const x0 = cell.x0;
        const x1 = cell.x1;
        const z0 = cell.z0;
        const z1 = cell.z1;
        const yTop = cell.topY;

        emitQuad(
          target,
          [
            [x0, yTop, z1],
            [x1, yTop, z1],
            [x1, yTop, z0],
            [x0, yTop, z0],
          ],
          [0, 1, 0],
          cell.block,
          "top",
          1.0,
          [cell.worldX, cell.worldY, cell.worldZ],
        );

        const neighborDefs = [
          {
            faceName: "north",
            dx: 0,
            dz: -1,
            normal: [0, 0, -1],
            makeVertices: (lower) => [[x1, lower, z0], [x0, lower, z0], [x0, yTop, z0], [x1, yTop, z0]],
          },
          {
            faceName: "south",
            dx: 0,
            dz: 1,
            normal: [0, 0, 1],
            makeVertices: (lower) => [[x0, lower, z1], [x1, lower, z1], [x1, yTop, z1], [x0, yTop, z1]],
          },
          {
            faceName: "west",
            dx: -1,
            dz: 0,
            normal: [-1, 0, 0],
            makeVertices: (lower) => [[x0, lower, z1], [x0, lower, z0], [x0, yTop, z0], [x0, yTop, z1]],
          },
          {
            faceName: "east",
            dx: 1,
            dz: 0,
            normal: [1, 0, 0],
            makeVertices: (lower) => [[x1, lower, z0], [x1, lower, z1], [x1, yTop, z1], [x1, yTop, z0]],
          },
        ];

        for (const neighborDef of neighborDefs) {
          const neighbor = this.getLodNeighbor(grid, chunk, cellX, cellZ, step, neighborDef.dx, neighborDef.dz);
          if (!neighbor || neighbor.topY >= yTop) continue;
          emitQuad(
            target,
            neighborDef.makeVertices(neighbor.topY),
            neighborDef.normal,
            cell.block,
            neighborDef.faceName,
            FACE_SHADE[neighborDef.faceName] ?? 0.7,
            [cell.worldX, cell.worldY, cell.worldZ],
          );
        }

        if (BlockData[cell.block]?.transparent) {
          vertexTransparent = target.vertex;
        } else {
          vertexOpaque = target.vertex;
        }
      }
    }

    const meshes = [];
    const createMesh = (positionsArr, normalsArr, uvsArr, colorsArr, indicesArr, material) => {
      if (positionsArr.length === 0) return null;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positionsArr, 3));
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normalsArr, 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvsArr, 2));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(colorsArr, 3));
      if (positionsArr.length / 3 > 65535 && typeof Uint32Array !== "undefined") {
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
    const opaqueMesh = createMesh(positionsOpaque, normalsOpaque, uvsOpaque, colorsOpaque, indicesOpaque, opaqueMaterial);
    if (opaqueMesh) meshes.push(opaqueMesh);

    if (positionsTransparent.length > 0) {
      const transMaterial = this.material.clone();
      transMaterial.side = THREE.DoubleSide;
      transMaterial.transparent = true;
      transMaterial.depthWrite = true;
      transMaterial.blending = THREE.NormalBlending;
      const transMesh = createMesh(positionsTransparent, normalsTransparent, uvsTransparent, colorsTransparent, indicesTransparent, transMaterial);
      if (transMesh) {
        transMesh.renderOrder = 1;
        meshes.push(transMesh);
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

  sampleLodCell(chunk, startX, startZ, step) {
    const endX = Math.min(CHUNK_SIZE, startX + step);
    const endZ = Math.min(CHUNK_SIZE, startZ + step);
    let best = null;

    for (let z = startZ; z < endZ; z++) {
      for (let x = startX; x < endX; x++) {
        for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
          const block = chunk.getBlock(x, y, z);
          if (block === Blocks.AIR) continue;
          if (!best || y > best.y || (y === best.y && this.getSurfacePriority(block) > this.getSurfacePriority(best.block))) {
            best = {
              block,
              y,
              worldX: chunk.cx * CHUNK_SIZE + x,
              worldZ: chunk.cz * CHUNK_SIZE + z,
            };
          }
          break;
        }
      }
    }

    if (!best) return null;

    return {
      block: best.block,
      topY: best.y + 1,
      worldX: best.worldX,
      worldY: best.y,
      worldZ: best.worldZ,
      x0: startX,
      x1: endX,
      z0: startZ,
      z1: endZ,
    };
  }

  getLodNeighbor(grid, chunk, cellX, cellZ, step, dx, dz) {
    const neighborX = cellX + dx;
    const neighborZ = cellZ + dz;
    if (neighborZ >= 0 && neighborZ < grid.length && neighborX >= 0 && neighborX < grid[neighborZ].length) {
      const cell = grid[neighborZ][neighborX];
      if (cell) return cell;
    }

    const worldX = chunk.cx * CHUNK_SIZE + (cellX + dx) * step;
    const worldZ = chunk.cz * CHUNK_SIZE + (cellZ + dz) * step;
    return this.sampleWorldSurface(worldX, worldZ);
  }

  sampleWorldSurface(worldX, worldZ) {
    const { cx, cz, lx, lz } = this.chunkManager.worldToLocal(worldX, worldZ);
    const chunk = this.chunkManager.chunks.get(this.chunkManager.key(cx, cz));
    if (chunk) {
      return this.sampleChunkSurface(chunk, lx, lz, worldX, worldZ);
    }

    const surface = this.chunkManager.terrain.getSurfaceInfo(worldX, worldZ);
    return {
      block: surface.block,
      topY: surface.height + 1,
      worldX: Math.floor(worldX),
      worldY: surface.height,
      worldZ: Math.floor(worldZ),
    };
  }

  sampleChunkSurface(chunk, localX, localZ, worldX, worldZ) {
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
      const block = chunk.getBlock(localX, y, localZ);
      if (block === Blocks.AIR) continue;
      return {
        block,
        topY: y + 1,
        worldX: Math.floor(worldX),
        worldY: y,
        worldZ: Math.floor(worldZ),
      };
    }
    return null;
  }

  appendQuad(positions, normals, indices, colors, uvs, vertex, vertices, normal, color, shade, faceUvs) {
    for (let index = 0; index < vertices.length; index++) {
      const point = vertices[index];
      positions.push(point[0], point[1], point[2]);
      normals.push(normal[0], normal[1], normal[2]);
      colors.push(color[0] * shade, color[1] * shade, color[2] * shade);
      uvs.push(faceUvs[index][0], faceUvs[index][1]);
    }
    indices.push(vertex, vertex + 1, vertex + 2, vertex, vertex + 2, vertex + 3);
    return vertex + 4;
  }

  getLodFaceUvs(uv, repeatX, repeatY) {
    const tileWidth = uv.u1 - uv.u0;
    const tileHeight = uv.v1 - uv.v0;
    return [
      [uv.u0, uv.v0],
      [uv.u0 + tileWidth * repeatX, uv.v0],
      [uv.u0 + tileWidth * repeatX, uv.v0 + tileHeight * repeatY],
      [uv.u0, uv.v0 + tileHeight * repeatY],
    ];
  }

  getLodFaceSpan(vertices, firstIndex, secondIndex) {
    const a = vertices[firstIndex];
    const b = vertices[secondIndex];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  getLodLight(chunk, samplePoint) {
    const worldX = samplePoint[0] + chunk.cx * CHUNK_SIZE;
    const worldY = Math.max(0, Math.floor(samplePoint[1] - 1));
    const worldZ = samplePoint[2] + chunk.cz * CHUNK_SIZE;
    return Math.max(this.chunkManager.getSunLight(worldX, worldY, worldZ), this.chunkManager.getBlockLight(worldX, worldY, worldZ));
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
