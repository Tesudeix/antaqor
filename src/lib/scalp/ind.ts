/* ─── Tesla Trader · Scalp — индикаторын цуваа (2026-11-04) ──────────────────
   Бүгд массив буцаана (лаа бүрт нэг утга) — backtest болон бодит цаг НЭГ кодоор ажиллана.
   Халаалтын (warm-up) хэсэгт NaN. Индикатор бүр ижил OHLC-оос гардаг тул «олон индикатор
   = олон нотолгоо» биш — neff() хэдэн бие даасан дохио үлддэгийг тоолно. */

export type Bar = { t: number; o: number; h: number; l: number; c: number; v: number };

const N = NaN;

export function ema(v: number[], n: number): number[] {
  const k = 2 / (n + 1), out: number[] = new Array(v.length);
  let prev = N;
  for (let i = 0; i < v.length; i++) {
    const x = v[i];
    prev = Number.isNaN(prev) ? x : x * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Wilder-ийн гөлгөршүүлэлт (RSI, ATR, ADX) — эхний n-ийг энгийн дунджаар үүсгэнэ */
export function rma(v: number[], n: number): number[] {
  const out: number[] = new Array(v.length).fill(N);
  let s = 0, cnt = 0, prev = N;
  for (let i = 0; i < v.length; i++) {
    const x = v[i];
    if (Number.isNaN(x)) continue;
    if (Number.isNaN(prev)) { s += x; cnt++; if (cnt === n) { prev = s / n; out[i] = prev; } continue; }
    prev = (prev * (n - 1) + x) / n;
    out[i] = prev;
  }
  return out;
}

export function sma(v: number[], n: number): number[] {
  const out: number[] = new Array(v.length).fill(N);
  let s = 0;
  for (let i = 0; i < v.length; i++) {
    s += v[i];
    if (i >= n) s -= v[i - n];
    if (i >= n - 1) out[i] = s / n;
  }
  return out;
}

export function tr(b: Bar[]): number[] {
  return b.map((x, i) => (i === 0 ? x.h - x.l : Math.max(x.h - x.l, Math.abs(x.h - b[i - 1].c), Math.abs(x.l - b[i - 1].c))));
}
export const atr = (b: Bar[], n = 14) => rma(tr(b), n);

export function rsi(c: number[], n = 14): number[] {
  const up: number[] = [N], dn: number[] = [N];
  for (let i = 1; i < c.length; i++) { const d = c[i] - c[i - 1]; up.push(Math.max(d, 0)); dn.push(Math.max(-d, 0)); }
  const u = rma(up, n), d = rma(dn, n);
  return u.map((x, i) => (Number.isNaN(x) ? N : d[i] === 0 ? 100 : 100 - 100 / (1 + x / d[i])));
}

export function adx(b: Bar[], n = 14) {
  const pdm: number[] = [N], mdm: number[] = [N], t = tr(b);
  t[0] = N;
  for (let i = 1; i < b.length; i++) {
    const up = b[i].h - b[i - 1].h, dn = b[i - 1].l - b[i].l;
    pdm.push(up > dn && up > 0 ? up : 0); mdm.push(dn > up && dn > 0 ? dn : 0);
  }
  const at = rma(t, n), p = rma(pdm, n), m = rma(mdm, n);
  const pdi = p.map((x, i) => (at[i] ? (100 * x) / at[i] : N)), mdi = m.map((x, i) => (at[i] ? (100 * x) / at[i] : N));
  const dx = pdi.map((x, i) => (Number.isNaN(x) || x + mdi[i] === 0 ? (Number.isNaN(x) ? N : 0) : (100 * Math.abs(x - mdi[i])) / (x + mdi[i])));
  return { adx: rma(dx, n), pdi, mdi };
}

/** Kaufman-ий үр ашгийн харьцаа: |цэвэр хөдөлгөөн| / Σ|алхам| — 1 = цэвэр тренд, 0 = цэвэр шуугиан */
export function er(c: number[], n = 12): number[] {
  return c.map((x, i) => {
    if (i < n) return N;
    let path = 0;
    for (let k = i - n + 1; k <= i; k++) path += Math.abs(c[k] - c[k - 1]);
    return path ? Math.abs(x - c[i - n]) / path : 0;
  });
}

export function boll(c: number[], n = 20, k = 2) {
  const mid = sma(c, n), sd: number[] = new Array(c.length).fill(N);
  for (let i = n - 1; i < c.length; i++) {
    let s = 0;
    for (let j = i - n + 1; j <= i; j++) s += (c[j] - mid[i]) ** 2;
    sd[i] = Math.sqrt(s / n);
  }
  return { mid, sd, up: mid.map((m, i) => m + k * sd[i]), lo: mid.map((m, i) => m - k * sd[i]) };
}

export function keltner(b: Bar[], n = 20, m = 1.5) {
  const mid = ema(b.map((x) => x.c), n), a = atr(b, n);
  return { up: mid.map((x, i) => x + m * a[i]), lo: mid.map((x, i) => x - m * a[i]) };
}

/** Удаан %K (n, d-ээр гөлгөршүүлсэн) */
export function stoch(b: Bar[], n = 14, d = 3): number[] {
  const k = b.map((x, i) => {
    if (i < n - 1) return N;
    let hi = -Infinity, lo = Infinity;
    for (let j = i - n + 1; j <= i; j++) { hi = Math.max(hi, b[j].h); lo = Math.min(lo, b[j].l); }
    return hi === lo ? 50 : (100 * (x.c - lo)) / (hi - lo);
  });
  return sma(k.map((x) => (Number.isNaN(x) ? 50 : x)), d).map((x, i) => (Number.isNaN(k[i]) ? N : x));
}

export function willr(b: Bar[], n = 14): number[] {
  return b.map((x, i) => {
    if (i < n - 1) return N;
    let hi = -Infinity, lo = Infinity;
    for (let j = i - n + 1; j <= i; j++) { hi = Math.max(hi, b[j].h); lo = Math.min(lo, b[j].l); }
    return hi === lo ? -50 : (-100 * (hi - x.c)) / (hi - lo);
  });
}

export function cci(b: Bar[], n = 20): number[] {
  const tp = b.map((x) => (x.h + x.l + x.c) / 3), m = sma(tp, n);
  return tp.map((x, i) => {
    if (i < n - 1) return N;
    let md = 0;
    for (let j = i - n + 1; j <= i; j++) md += Math.abs(tp[j] - m[i]);
    md /= n;
    return md ? (x - m[i]) / (0.015 * md) : 0;
  });
}

export function macd(c: number[], f = 12, s = 26, g = 9) {
  const a = ema(c, f), b = ema(c, s), line = a.map((x, i) => x - b[i]), signal = ema(line, g);
  return { line, signal, hist: line.map((x, i) => (i < s ? N : x - signal[i])) };
}

export const roc = (c: number[], n = 10) => c.map((x, i) => (i < n ? N : x - c[i - n]));

/** Supertrend: dir +1 өсөх, −1 унах */
export function supertrend(b: Bar[], n = 10, m = 3) {
  const a = atr(b, n), dir: number[] = new Array(b.length).fill(N), line: number[] = new Array(b.length).fill(N);
  let up = N, dn = N, d = 1;
  for (let i = 0; i < b.length; i++) {
    if (Number.isNaN(a[i])) continue;
    const hl = (b[i].h + b[i].l) / 2, bu = hl - m * a[i], bd = hl + m * a[i];
    up = Number.isNaN(up) || b[i - 1].c < up ? bu : Math.max(bu, up);
    dn = Number.isNaN(dn) || b[i - 1].c > dn ? bd : Math.min(bd, dn);
    if (d === 1 && b[i].c < up) d = -1; else if (d === -1 && b[i].c > dn) d = 1;
    dir[i] = d; line[i] = d === 1 ? up : dn;
  }
  return { dir, line };
}

/** Шугаман регрессийн налуу (нэг лаанд ногдох үнийн өөрчлөлт) */
export function slope(c: number[], n = 20): number[] {
  const sx = (n * (n - 1)) / 2, sxx = ((n - 1) * n * (2 * n - 1)) / 6, den = n * sxx - sx * sx;
  return c.map((_, i) => {
    if (i < n - 1) return N;
    let sy = 0, sxy = 0;
    for (let k = 0; k < n; k++) { const y = c[i - n + 1 + k]; sy += y; sxy += k * y; }
    return (n * sxy - sx * sy) / den;
  });
}

export function obv(b: Bar[]): number[] {
  let s = 0;
  return b.map((x, i) => (i === 0 ? 0 : (s += x.c > b[i - 1].c ? x.v : x.c < b[i - 1].c ? -x.v : 0)));
}

export function mfi(b: Bar[], n = 14): number[] {
  const tp = b.map((x) => (x.h + x.l + x.c) / 3);
  return b.map((_, i) => {
    if (i < n) return N;
    let pos = 0, neg = 0;
    for (let j = i - n + 1; j <= i; j++) { const f = tp[j] * b[j].v; if (tp[j] > tp[j - 1]) pos += f; else if (tp[j] < tp[j - 1]) neg += f; }
    return pos + neg === 0 ? 50 : (100 * pos) / (pos + neg);
  });
}

/* ── 2026-11-05: алтны квант хөдөлгүүрт нэмсэн ── */
const wma = (v: number[], n: number): number[] => {
  const d = (n * (n + 1)) / 2;
  return v.map((_, i) => { if (i < n - 1) return N; let s = 0; for (let k = 0; k < n; k++) s += v[i - k] * (n - k); return s / d; });
};
/** Hull MA: wma(2·wma(n/2) − wma(n), √n) — хоцрогдол бага */
export function hull(c: number[], n = 21): number[] {
  const a = wma(c, Math.floor(n / 2)), b = wma(c, n);
  return wma(a.map((x, i) => (Number.isNaN(x) || Number.isNaN(b[i]) ? c[i] : 2 * x - b[i])), Math.floor(Math.sqrt(n))).map((x, i) => (i < n + Math.sqrt(n) ? N : x));
}
/** Kaufman адаптив MA */
export function kama(c: number[], n = 10, f = 2, s = 30): number[] {
  const fs = 2 / (f + 1), ss = 2 / (s + 1), e = er(c, n), out: number[] = new Array(c.length).fill(N);
  let k = N;
  for (let i = 0; i < c.length; i++) {
    if (Number.isNaN(e[i])) continue;
    const sc = (e[i] * (fs - ss) + ss) ** 2;
    k = Number.isNaN(k) ? c[i] : k + sc * (c[i] - k);
    out[i] = k;
  }
  return out;
}
/** Aroon осциллятор (−100..100) */
export function aroon(b: Bar[], n = 25): number[] {
  return b.map((_, i) => {
    if (i < n) return N;
    let hi = -Infinity, lo = Infinity, hk = 0, lk = 0;
    for (let k = i - n; k <= i; k++) { if (b[k].h >= hi) { hi = b[k].h; hk = k; } if (b[k].l <= lo) { lo = b[k].l; lk = k; } }
    return (100 * (n - (i - hk))) / n - (100 * (n - (i - lk))) / n;
  });
}
/** Donchian сувагт байрлал (−0.5..0.5) */
export function donchPos(b: Bar[], n = 20): number[] {
  return b.map((x, i) => {
    if (i < n - 1) return N;
    let hi = -Infinity, lo = Infinity;
    for (let k = i - n + 1; k <= i; k++) { hi = Math.max(hi, b[k].h); lo = Math.min(lo, b[k].l); }
    return hi === lo ? 0 : (x.c - lo) / (hi - lo) - 0.5;
  });
}
/** Vortex: VI+ − VI− */
export function vortex(b: Bar[], n = 14): number[] {
  const t = tr(b);
  return b.map((_, i) => {
    if (i < n) return N;
    let vp = 0, vm = 0, st = 0;
    for (let k = i - n + 1; k <= i; k++) { vp += Math.abs(b[k].h - b[k - 1].l); vm += Math.abs(b[k].l - b[k - 1].h); st += t[k]; }
    return st ? (vp - vm) / st : 0;
  });
}
/** TRIX: гурван дахин EMA-ийн өөрчлөлт (%) */
export function trix(c: number[], n = 15): number[] {
  const e = ema(ema(ema(c, n), n), n);
  return e.map((x, i) => (i < 3 * n ? N : ((x - e[i - 1]) / e[i - 1]) * 1e4));
}
/** Ehlers Fisher transform */
export function fisher(b: Bar[], n = 10): number[] {
  const out: number[] = new Array(b.length).fill(N);
  let v = 0, f = 0;
  for (let i = n - 1; i < b.length; i++) {
    let hi = -Infinity, lo = Infinity;
    for (let k = i - n + 1; k <= i; k++) { const m = (b[k].h + b[k].l) / 2; hi = Math.max(hi, m); lo = Math.min(lo, m); }
    const m = (b[i].h + b[i].l) / 2;
    v = 0.33 * 2 * ((hi === lo ? 0.5 : (m - lo) / (hi - lo)) - 0.5) + 0.67 * v;
    v = Math.max(-0.999, Math.min(0.999, v));
    f = 0.5 * Math.log((1 + v) / (1 - v)) + 0.5 * f;
    out[i] = f;
  }
  return out;
}
/** Ultimate oscillator (7/14/28) */
export function ultimate(b: Bar[]): number[] {
  const bp: number[] = [0], trr: number[] = [0];
  for (let i = 1; i < b.length; i++) { const lo = Math.min(b[i].l, b[i - 1].c); bp.push(b[i].c - lo); trr.push(Math.max(b[i].h, b[i - 1].c) - lo); }
  const avg = (i: number, n: number) => { let s = 0, t = 0; for (let k = i - n + 1; k <= i; k++) { s += bp[k]; t += trr[k]; } return t ? s / t : 0.5; };
  return b.map((_, i) => (i < 29 ? N : (100 * (4 * avg(i, 7) + 2 * avg(i, 14) + avg(i, 28))) / 7));
}
/** Choppiness index (0..100): өндөр = хажуу тийш, бага = тренд */
export function chop(b: Bar[], n = 14): number[] {
  const t = tr(b);
  return b.map((_, i) => {
    if (i < n) return N;
    let s = 0, hi = -Infinity, lo = Infinity;
    for (let k = i - n + 1; k <= i; k++) { s += t[k]; hi = Math.max(hi, b[k].h); lo = Math.min(lo, b[k].l); }
    return hi > lo ? (100 * Math.log10(s / (hi - lo))) / Math.log10(n) : 50;
  });
}
/** Chaikin money flow */
export function cmf(b: Bar[], n = 20): number[] {
  const mfv = b.map((x) => (x.h > x.l ? ((x.c - x.l - (x.h - x.c)) / (x.h - x.l)) * x.v : 0));
  return b.map((_, i) => { if (i < n - 1) return N; let s = 0, v = 0; for (let k = i - n + 1; k <= i; k++) { s += mfv[k]; v += b[k].v; } return v ? s / v : 0; });
}
/** Hurst exponent (rescaled range, нэг цонх) — >0.5 үргэлжлэх, <0.5 буцах хандлага */
export function hurstAt(c: number[], i: number, n = 128): number {
  if (i < n) return N;
  const r: number[] = [];
  for (let k = i - n + 1; k <= i; k++) r.push(Math.log(c[k] / c[k - 1]));
  const rs = (seg: number[]) => {
    const m = seg.reduce((a, b) => a + b, 0) / seg.length;
    let cum = 0, mx = -Infinity, mn = Infinity, ss = 0;
    for (const x of seg) { cum += x - m; mx = Math.max(mx, cum); mn = Math.min(mn, cum); ss += (x - m) ** 2; }
    const sd = Math.sqrt(ss / seg.length);
    return sd ? (mx - mn) / sd : 0;
  };
  const pts: [number, number][] = [];
  for (const sz of [8, 16, 32, 64, 128]) {
    if (sz > n) break;
    let acc = 0, cnt = 0;
    for (let s = 0; s + sz <= n; s += sz) { const v = rs(r.slice(s, s + sz)); if (v > 0) { acc += v; cnt++; } }
    if (cnt) pts.push([Math.log(sz), Math.log(acc / cnt)]);
  }
  if (pts.length < 3) return N;
  const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length, my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  return pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0) / pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0);
}
/** Шугаман регрессийн R² (трендийн «цэвэр» байдал) */
export function rsq(c: number[], n = 20): number[] {
  return c.map((_, i) => {
    if (i < n - 1) return N;
    let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
    for (let k = 0; k < n; k++) { const y = c[i - n + 1 + k]; sx += k; sy += y; sxx += k * k; syy += y * y; sxy += k * y; }
    const cov = n * sxy - sx * sy, vx = n * sxx - sx * sx, vy = n * syy - sy * sy;
    return vx && vy ? (cov * cov) / (vx * vy) : 0;
  });
}

/** v[i]-ийн сүүлийн `look` утга доторх байр (0..1). Хэлбэлзэл «ер бусын их/бага» эсэхийг харьцангуйгаар хэмжинэ. */
export function pctRank(v: number[], i: number, look: number): number {
  const x = v[i];
  if (Number.isNaN(x)) return N;
  let below = 0, cnt = 0;
  for (let k = Math.max(0, i - look + 1); k <= i; k++) { if (Number.isNaN(v[k])) continue; cnt++; if (v[k] < x) below++; }
  return cnt ? below / cnt : N;
}

/* ── бие даасан дохионы тоо ──
   Корреляцийн матрицын хувийн утгуудаар (Jacobi) participation ratio = (Σλ)² / Σλ².
   12 индикатор бүгд адилхан хөдөлдөг бол ≈1, бүрэн бие даасан бол ≈12. */
export function neff(series: number[][]): number {
  const m = series.length;
  if (m < 2) return m;
  const len = series[0].length;
  const z = series.map((s) => {
    const mu = s.reduce((a, b) => a + b, 0) / len, sd = Math.sqrt(s.reduce((a, b) => a + (b - mu) ** 2, 0) / len) || 1;
    return s.map((x) => (x - mu) / sd);
  });
  const A = z.map((a) => z.map((b) => a.reduce((s, x, k) => s + x * b[k], 0) / len));
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let p = 0; p < m; p++) for (let q = p + 1; q < m; q++) off += A[p][q] ** 2;
    if (off < 1e-10) break;
    for (let p = 0; p < m; p++) for (let q = p + 1; q < m; q++) {
      if (Math.abs(A[p][q]) < 1e-12) continue;
      const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < m; k++) {
        const akp = A[k][p], akq = A[k][q];
        A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < m; k++) {
        const apk = A[p][k], aqk = A[q][k];
        A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk;
      }
    }
  }
  const ev = A.map((r, i) => Math.max(0, r[i]));
  const s1 = ev.reduce((a, b) => a + b, 0), s2 = ev.reduce((a, b) => a + b * b, 0);
  return s2 ? (s1 * s1) / s2 : m;
}
