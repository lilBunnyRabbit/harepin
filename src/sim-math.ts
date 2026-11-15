// fdlibm (musl) ports: engines disagree on Math.sin and friends (docs/plan/sim-performance.md §3), while +, -, *, / and sqrt are exact IEEE-754 everywhere.

const BITS = new Float64Array(1);
const WORDS = new Uint32Array(BITS.buffer);

function high(x: number): number {
  BITS[0] = x;
  return WORDS[1];
}

function low(x: number): number {
  BITS[0] = x;
  return WORDS[0];
}

function from_words(hi: number, lo: number): number {
  WORDS[1] = hi;
  WORDS[0] = lo;
  return BITS[0];
}

function clear_low(x: number): number {
  BITS[0] = x;
  WORDS[0] = 0;
  return BITS[0];
}

const TO_INT = 6755399441055744;
const PIO4 = 7.85398163397448278999e-1;
const INV_PIO2 = 6.36619772367581382433e-1;
const PIO2_1 = 1.57079632673412561417;
const PIO2_1T = 6.07710050650619224932e-11;
const PIO2_2 = 6.07710050630396597660e-11;
const PIO2_2T = 2.02226624879595063154e-21;
const PIO2_3 = 2.02226624871116645580e-21;
const PIO2_3T = 8.47842766036889956997e-32;

let rem_y0 = 0;
let rem_y1 = 0;

// musl switches to Payne-Hanek past 2^20 * pi/2; past it this stays deterministic, only less accurate.
function rem_pio2(x: number, ix: number): number {
  let fn = x * INV_PIO2 + TO_INT - TO_INT;
  let r = x - fn * PIO2_1;
  let w = fn * PIO2_1T;
  if (r - w < -PIO4) {
    fn--;
    r = x - fn * PIO2_1;
    w = fn * PIO2_1T;
  } else if (r - w > PIO4) {
    fn++;
    r = x - fn * PIO2_1;
    w = fn * PIO2_1T;
  }
  rem_y0 = r - w;
  const ex = ix >>> 20;
  let ey = (high(rem_y0) >>> 20) & 0x7ff;
  if (ex - ey > 16) {
    let t = r;
    w = fn * PIO2_2;
    r = t - w;
    w = fn * PIO2_2T - (t - r - w);
    rem_y0 = r - w;
    ey = (high(rem_y0) >>> 20) & 0x7ff;
    if (ex - ey > 31) {
      t = r;
      w = fn * PIO2_3;
      r = t - w;
      w = fn * PIO2_3T - (t - r - w);
      rem_y0 = r - w;
    }
  }
  rem_y1 = r - rem_y0 - w;
  return fn - 4 * Math.floor(fn / 4);
}

const S1 = -1.66666666666666324348e-1;
const S2 = 8.33333333332248946124e-3;
const S3 = -1.98412698298579493134e-4;
const S4 = 2.75573137070700676789e-6;
const S5 = -2.50507602534068634195e-8;
const S6 = 1.58969099521155010221e-10;

function k_sin(x: number, y: number, iy: number): number {
  const z = x * x;
  const w = z * z;
  const r = S2 + z * (S3 + z * S4) + z * w * (S5 + z * S6);
  const v = z * x;
  if (iy === 0) return x + v * (S1 + z * r);
  return x - (z * (0.5 * y - v * r) - y - v * S1);
}

const C1 = 4.16666666666666019037e-2;
const C2 = -1.38888888888741095749e-3;
const C3 = 2.48015872894767294178e-5;
const C4 = -2.75573143513906633035e-7;
const C5 = 2.08757232129817482790e-9;
const C6 = -1.13596475577881948265e-11;

function k_cos(x: number, y: number): number {
  const z = x * x;
  let w = z * z;
  const r = z * (C1 + z * (C2 + z * C3)) + w * w * (C4 + z * (C5 + z * C6));
  const hz = 0.5 * z;
  w = 1 - hz;
  return w + (1 - w - hz + (z * r - x * y));
}

const T = [
  3.33333333333334091986e-1, 1.33333333333201242699e-1, 5.39682539762260521377e-2, 2.18694882948595424599e-2, 8.86323982359930005737e-3, 3.59207910759131235356e-3,
  1.45620945432529025516e-3, 5.88041240820264096874e-4, 2.46463134818469906812e-4, 7.81794442939557092300e-5, 7.14072491382608190305e-5, -1.85586374855275456654e-5,
  2.59073051863633712884e-5,
];
const PIO4_LO = 3.06161699786838301793e-17;

function k_tan(x: number, y: number, odd: number): number {
  const hx = high(x);
  const big = (hx & 0x7fffffff) >= 0x3fe59428;
  const negative = hx >>> 31 === 1;
  if (big) {
    if (negative) {
      x = -x;
      y = -y;
    }
    x = PIO4 - x + (PIO4_LO - y);
    y = 0;
  }
  const z = x * x;
  let w = z * z;
  let r = T[1] + w * (T[3] + w * (T[5] + w * (T[7] + w * (T[9] + w * T[11]))));
  let v = z * (T[2] + w * (T[4] + w * (T[6] + w * (T[8] + w * (T[10] + w * T[12])))));
  let s = z * x;
  r = y + z * (s * (r + v) + y) + s * T[0];
  w = x + r;
  if (big) {
    s = 1 - 2 * odd;
    v = s - 2 * (x + (r - (w * w) / (w + s)));
    return negative ? -v : v;
  }
  if (!odd) return w;
  const w0 = clear_low(w);
  v = r - (w0 - x);
  const a = -1 / w;
  const a0 = clear_low(a);
  return a0 + a * (1 + a0 * w0 + a0 * v);
}

export function sin(x: number): number {
  const ix = high(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) {
    if (ix < 0x3e500000) return x;
    return k_sin(x, 0, 0);
  }
  if (ix >= 0x7ff00000) return NaN;
  switch (rem_pio2(x, ix)) {
    case 0:
      return k_sin(rem_y0, rem_y1, 1);
    case 1:
      return k_cos(rem_y0, rem_y1);
    case 2:
      return -k_sin(rem_y0, rem_y1, 1);
    default:
      return -k_cos(rem_y0, rem_y1);
  }
}

export function cos(x: number): number {
  const ix = high(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) {
    if (ix < 0x3e46a09e) return 1;
    return k_cos(x, 0);
  }
  if (ix >= 0x7ff00000) return NaN;
  switch (rem_pio2(x, ix)) {
    case 0:
      return k_cos(rem_y0, rem_y1);
    case 1:
      return -k_sin(rem_y0, rem_y1, 1);
    case 2:
      return -k_cos(rem_y0, rem_y1);
    default:
      return k_sin(rem_y0, rem_y1, 1);
  }
}

export function tan(x: number): number {
  const ix = high(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) {
    if (ix < 0x3e400000) return x;
    return k_tan(x, 0, 0);
  }
  if (ix >= 0x7ff00000) return NaN;
  const n = rem_pio2(x, ix);
  return k_tan(rem_y0, rem_y1, n & 1);
}

const ATAN_HI = [4.63647609000806093515e-1, 7.85398163397448278999e-1, 9.82793723247329054082e-1, 1.57079632679489655800];
const ATAN_LO = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17];
const AT = [
  3.33333333333329318027e-1, -1.99999999998764832476e-1, 1.42857142725034663711e-1, -1.11111104054623557880e-1, 9.09088713343650656196e-2, -7.69187620504482999495e-2,
  6.66107313738753120669e-2, -5.83357013379057348645e-2, 4.97687799461593236017e-2, -3.65315727442169155270e-2, 1.62858201153657823623e-2,
];

export function atan(x: number): number {
  const hx = high(x);
  const ix = hx & 0x7fffffff;
  const negative = hx >>> 31 === 1;
  if (ix >= 0x44100000) {
    if (x !== x) return x;
    return negative ? -ATAN_HI[3] : ATAN_HI[3];
  }
  let id: number;
  if (ix < 0x3fdc0000) {
    if (ix < 0x3e400000) return x;
    id = -1;
  } else {
    x = Math.abs(x);
    if (ix < 0x3ff30000) {
      if (ix < 0x3fe60000) {
        id = 0;
        x = (2 * x - 1) / (2 + x);
      } else {
        id = 1;
        x = (x - 1) / (x + 1);
      }
    } else if (ix < 0x40038000) {
      id = 2;
      x = (x - 1.5) / (1 + 1.5 * x);
    } else {
      id = 3;
      x = -1 / x;
    }
  }
  const z = x * x;
  const w = z * z;
  const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
  const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
  if (id < 0) return x - x * (s1 + s2);
  const r = ATAN_HI[id] - (x * (s1 + s2) - ATAN_LO[id] - x);
  return negative ? -r : r;
}

const PI = 3.1415926535897931160;
const PI_LO = 1.2246467991473531772e-16;
const PIO2 = 1.57079632679489655800;

export function atan2(y: number, x: number): number {
  if (x !== x || y !== y) return x + y;
  let ix = high(x);
  const lx = low(x);
  let iy = high(y);
  const ly = low(y);
  if (ix === 0x3ff00000 && lx === 0) return atan(y);
  const m = (iy >>> 31) | ((ix >>> 30) & 2);
  ix &= 0x7fffffff;
  iy &= 0x7fffffff;
  if ((iy | ly) === 0) {
    if (m < 2) return y;
    return m === 2 ? PI : -PI;
  }
  if ((ix | lx) === 0) return m & 1 ? -PIO2 : PIO2;
  if (ix === 0x7ff00000) {
    if (iy === 0x7ff00000) return [PIO4, -PIO4, 3 * PIO4, -3 * PIO4][m];
    return [0, -0, PI, -PI][m];
  }
  if (ix + (64 << 20) < iy || iy === 0x7ff00000) return m & 1 ? -PIO2 : PIO2;
  const z = m & 2 && iy + (64 << 20) < ix ? 0 : atan(Math.abs(y / x));
  switch (m) {
    case 0:
      return z;
    case 1:
      return -z;
    case 2:
      return PI - (z - PI_LO);
    default:
      return z - PI_LO - PI;
  }
}

const PIO2_HI = 1.57079632679489655800;
const PIO2_LO = 6.12323399573676603587e-17;
const PS0 = 1.66666666666666657415e-1;
const PS1 = -3.25565818622400915405e-1;
const PS2 = 2.01212532134862925881e-1;
const PS3 = -4.00555345006794114027e-2;
const PS4 = 7.91534994289814532176e-4;
const PS5 = 3.47933107596021167570e-5;
const QS1 = -2.40339491173441421878;
const QS2 = 2.02094576023350569471;
const QS3 = -6.88283971605453293030e-1;
const QS4 = 7.70381505559019352791e-2;

function asin_r(z: number): number {
  const p = z * (PS0 + z * (PS1 + z * (PS2 + z * (PS3 + z * (PS4 + z * PS5)))));
  const q = 1 + z * (QS1 + z * (QS2 + z * (QS3 + z * QS4)));
  return p / q;
}

export function asin(x: number): number {
  const hx = high(x);
  const ix = hx & 0x7fffffff;
  if (ix >= 0x3ff00000) {
    if (ix === 0x3ff00000 && low(x) === 0) return x * PIO2_HI;
    return NaN;
  }
  if (ix < 0x3fe00000) {
    if (ix < 0x3e500000) return x;
    return x + x * asin_r(x * x);
  }
  const z = (1 - Math.abs(x)) * 0.5;
  const s = Math.sqrt(z);
  const r = asin_r(z);
  let out: number;
  if (ix >= 0x3fef3333) out = PIO2_HI - (2 * (s + s * r) - PIO2_LO);
  else {
    const f = clear_low(s);
    const c = (z - f * f) / (s + f);
    out = 0.5 * PIO2_HI - (2 * s * r - (PIO2_LO - 2 * c) - (0.5 * PIO2_HI - 2 * f));
  }
  return hx >>> 31 ? -out : out;
}

export function acos(x: number): number {
  const hx = high(x);
  const ix = hx & 0x7fffffff;
  if (ix >= 0x3ff00000) {
    if (ix === 0x3ff00000 && low(x) === 0) return hx >>> 31 ? 2 * PIO2_HI : 0;
    return NaN;
  }
  if (ix < 0x3fe00000) {
    if (ix <= 0x3c600000) return PIO2_HI;
    return PIO2_HI - (x - (PIO2_LO - x * asin_r(x * x)));
  }
  if (hx >>> 31) {
    const z = (1 + x) * 0.5;
    const s = Math.sqrt(z);
    const w = asin_r(z) * s - PIO2_LO;
    return 2 * (PIO2_HI - (s + w));
  }
  const z = (1 - x) * 0.5;
  const s = Math.sqrt(z);
  const df = clear_low(s);
  const c = (z - df * df) / (s + df);
  const w = asin_r(z) * s + c;
  return 2 * (df + w);
}

const LN2_HI = 6.93147180369123816490e-1;
const LN2_LO = 1.90821492927058770002e-10;
const INV_LN2 = 1.44269504088896338700;
const P1 = 1.66666666666666019037e-1;
const P2 = -2.77777777770155933842e-3;
const P3 = 6.61375632143793436117e-5;
const P4 = -1.65339022054652515390e-6;
const P5 = 4.13813679705723846039e-8;
const TWO_1023 = 8.98846567431158e307;
const TWO_M969 = 2.004168360008973e-292;

function scalbn(y: number, n: number): number {
  if (n > 1023) {
    y *= TWO_1023;
    n -= 1023;
    if (n > 1023) {
      y *= TWO_1023;
      n -= 1023;
      if (n > 1023) n = 1023;
    }
  } else if (n < -1022) {
    y *= TWO_M969;
    n += 969;
    if (n < -1022) {
      y *= TWO_M969;
      n += 969;
      if (n < -1022) n = -1022;
    }
  }
  return y * from_words((0x3ff + n) << 20, 0);
}

export function exp(x: number): number {
  const hx_signed = high(x);
  const negative = hx_signed >>> 31;
  const hx = hx_signed & 0x7fffffff;
  if (hx >= 0x4086232b) {
    if (x !== x) return x;
    if (x > 709.782712893383973096) return Infinity;
    if (x < -745.13321910194110842) return 0;
  }
  let k = 0;
  let hi = 0;
  let lo = 0;
  if (hx > 0x3fd62e42) {
    k = hx >= 0x3ff0a2b2 ? Math.trunc(INV_LN2 * x + (negative ? -0.5 : 0.5)) : 1 - negative - negative;
    hi = x - k * LN2_HI;
    lo = k * LN2_LO;
    x = hi - lo;
  } else if (hx > 0x3e300000) {
    hi = x;
  } else return 1 + x;
  const xx = x * x;
  const c = x - xx * (P1 + xx * (P2 + xx * (P3 + xx * (P4 + xx * P5))));
  const y = 1 + ((x * c) / (2 - c) - lo + hi);
  return k === 0 ? y : scalbn(y, k);
}

const LG1 = 6.666666666666735130e-1;
const LG2 = 3.999999999940941908e-1;
const LG3 = 2.857142874366239149e-1;
const LG4 = 2.222219843214978396e-1;
const LG5 = 1.818357216161805012e-1;
const LG6 = 1.531383769920937332e-1;
const LG7 = 1.479819860511658591e-1;
const TWO_54 = 18014398509481984;

export function log(x: number): number {
  let hx = high(x);
  let k = 0;
  if (hx < 0x00100000 || hx >>> 31) {
    if (x === 0) return -Infinity;
    if (hx >>> 31) return NaN;
    k -= 54;
    x *= TWO_54;
    hx = high(x);
  } else if (hx >= 0x7ff00000) return x;
  else if (hx === 0x3ff00000 && low(x) === 0) return 0;
  hx += 0x3ff00000 - 0x3fe6a09e;
  k += (hx >>> 20) - 0x3ff;
  hx = (hx & 0x000fffff) + 0x3fe6a09e;
  x = from_words(hx, low(x));
  const f = x - 1;
  const hfsq = 0.5 * f * f;
  const s = f / (2 + f);
  const z = s * s;
  const w = z * z;
  const t1 = w * (LG2 + w * (LG4 + w * LG6));
  const t2 = z * (LG1 + w * (LG3 + w * (LG5 + w * LG7)));
  const r = t2 + t1;
  return s * (hfsq + r) + k * LN2_LO - hfsq + f + k * LN2_HI;
}

const B1 = 715094163;
const B2 = 696219795;
const CP0 = 1.87595182427177009643;
const CP1 = -1.88497979543377169875;
const CP2 = 1.621429720105354466140;
const CP3 = -0.758397934778766047437;
const CP4 = 0.145996192886612446982;

export function cbrt(x: number): number {
  const sign = high(x) & 0x80000000;
  let hx = high(x) & 0x7fffffff;
  if (hx >= 0x7ff00000) return x + x;
  if (hx < 0x00100000) {
    hx = high(x * TWO_54) & 0x7fffffff;
    if (hx === 0) return x;
    hx = Math.floor(hx / 3) + B2;
  } else hx = Math.floor(hx / 3) + B1;
  let t = from_words((sign | hx) >>> 0, 0);
  let r = t * t * (t / x);
  t = t * (CP0 + r * (CP1 + r * CP2) + r * r * r * (CP3 + r * CP4));
  BITS[0] = t;
  let lo = WORDS[0] + 0x80000000;
  let hi = WORDS[1];
  if (lo >= 0x100000000) {
    lo -= 0x100000000;
    hi = (hi + 1) >>> 0;
  }
  t = from_words(hi, (lo & 0xc0000000) >>> 0);
  const s = t * t;
  r = x / s;
  const w = t + t;
  r = (r - t) / (w + r);
  return t + t * r;
}

/** `Math.hypot` differs between engines; the car's inputs never come near overflow, and sqrt is exact everywhere. */
export function hypot(a: number, b: number): number {
  return Math.sqrt(a * a + b * b);
}

export function hypot3(a: number, b: number, c: number): number {
  return Math.sqrt(a * a + b * b + c * c);
}

interface QuatLike {
  set(x: number, y: number, z: number, w: number): unknown;
}

interface AxisLike {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** three's `Quaternion.setFromAxisAngle` in its own operation order, on the deterministic sin and cos. */
export function axis_angle<Q extends QuatLike>(q: Q, axis: AxisLike, angle: number): Q {
  const half = angle / 2;
  const s = sin(half);
  q.set(axis.x * s, axis.y * s, axis.z * s, cos(half));
  return q;
}
