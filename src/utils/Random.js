export function hash32(seed, x, y = 0, z = 0) {
  let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

export function randomFloat(seed, x, y = 0, z = 0) {
  return hash32(seed, x, y, z) / 4294967295;
}

export class Random {
  constructor(seed) {
    this.state = seed >>> 0;
  }

  next() {
    this.state += 0x6d2b79f5;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  int(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  chance(probability) {
    return this.next() < probability;
  }
}

export class PerlinNoise {
  constructor(seed) {
    this.seed = seed >>> 0;
  }

  noise2(x, z) {
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const xf = x - x0;
    const zf = z - z0;
    const u = fade(xf);
    const v = fade(zf);

    const aa = grad2(hash32(this.seed, x0, 0, z0), xf, zf);
    const ba = grad2(hash32(this.seed, x0 + 1, 0, z0), xf - 1, zf);
    const ab = grad2(hash32(this.seed, x0, 0, z0 + 1), xf, zf - 1);
    const bb = grad2(hash32(this.seed, x0 + 1, 0, z0 + 1), xf - 1, zf - 1);

    return lerp(lerp(aa, ba, u), lerp(ab, bb, u), v);
  }

  noise3(x, y, z) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const z0 = Math.floor(z);
    const xf = x - x0;
    const yf = y - y0;
    const zf = z - z0;
    const u = fade(xf);
    const v = fade(yf);
    const w = fade(zf);

    const n000 = grad3(hash32(this.seed, x0, y0, z0), xf, yf, zf);
    const n100 = grad3(hash32(this.seed, x0 + 1, y0, z0), xf - 1, yf, zf);
    const n010 = grad3(hash32(this.seed, x0, y0 + 1, z0), xf, yf - 1, zf);
    const n110 = grad3(hash32(this.seed, x0 + 1, y0 + 1, z0), xf - 1, yf - 1, zf);
    const n001 = grad3(hash32(this.seed, x0, y0, z0 + 1), xf, yf, zf - 1);
    const n101 = grad3(hash32(this.seed, x0 + 1, y0, z0 + 1), xf - 1, yf, zf - 1);
    const n011 = grad3(hash32(this.seed, x0, y0 + 1, z0 + 1), xf, yf - 1, zf - 1);
    const n111 = grad3(hash32(this.seed, x0 + 1, y0 + 1, z0 + 1), xf - 1, yf - 1, zf - 1);

    const x00 = lerp(n000, n100, u);
    const x10 = lerp(n010, n110, u);
    const x01 = lerp(n001, n101, u);
    const x11 = lerp(n011, n111, u);
    return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w);
  }
}

function fade(value) {
  return value * value * value * (value * (value * 6 - 15) + 10);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function grad2(hash, x, z) {
  switch (hash & 3) {
    case 0:
      return x + z;
    case 1:
      return -x + z;
    case 2:
      return x - z;
    default:
      return -x - z;
  }
}

function grad3(hash, x, y, z) {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}
