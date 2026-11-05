"use client";

import { useEffect, useRef, useState } from "react";
import type { IChartApi, IPriceLine, ISeriesApi, ISeriesMarkersPluginApi, ISeriesPrimitive, MouseEventParams, SeriesAttachedParameter, SeriesMarker, SeriesType, Time, UTCTimestamp } from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";
import s from "./desk.module.css";

/* ─── TESLA TRADER v8 · АМЬД ЧАРТ (2026-11-06) ───────────────────────────────
   Лаа, индикатор, шинжилгээний зураглал нэг чарт дээр. Секунд тутмын tick сүүлийн лааг шууд хөдөлгөж, ханшийн
   самбартай яг ижил үнэ үзүүлнэ. Шинжилгээ дуусахад шошго → трендийн шугам → бүс → түвшин → таамгийн зам дарааллаар
   зурагдана (prefers-reduced-motion үед шууд). Шошгонуудыг canvas primitive-ээр зурдаг тул чарт дагаад хөдөлнө. */

export type Bar = [number, number, number, number, number];
export type ChartLine = { name: string; dots?: boolean; v: (number | null)[] };
export type ChartInd = { id: string; label: string; pane: "price" | "sub"; ref?: number[]; read?: string; vote?: number; lines: ChartLine[] };
export type ChartData = { key: string; bars: Bar[]; inds: ChartInd[]; serverNow?: number };
export type Tick = { px: number; bid: number; ask: number; chg: number; t: number };
export type Plan = { strat: string; dir: number; lo: number; hi: number; entry: number; sl: number; tp1: number; tp2: number; rr: number; rr2: number; rsiConfirm: boolean; live: boolean; basis: string };
export type Pt = { t: number; p: number };
export type Draw = { marks: { t: number; above: boolean; text: string; kind: "up" | "dn" | "warn" | "mute" }[]; trends: { name: string; a: Pt; b: Pt; end: Pt }[]; path: Pt[]; alt: Pt[]; step: number; future: number; neck: { p: number; name: string } | null };

const UP = "#2DFFB3", DN = "#FF3D6E", CY = "#22E6FF", VI = "#B026FF", AM = "#FFD23F", TX = "#A8A3C2", MU = "#8A84AD";
export const PALETTE = ["#B026FF", "#22E6FF", "#FFD23F", "#FF8A3D", "#FF5EDB", "#9BFF5E", "#6E8BFF", "#7DF9FF"];
export const SUB_LINE = ["#22E6FF", "#FF5EDB", "#FFD23F"];
const FONT = 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace';
export const TF_MIN: Record<string, number> = { "1m": 1, "5m": 5, "15m": 15, "30m": 30, "1H": 60, "4H": 240, "1D": 1440, "1W": 10080 };
const MON = Date.UTC(2024, 0, 1);
export const bucket = (t: number, tf: string) => { const w = TF_MIN[tf] * 60000; return tf === "1W" ? MON + Math.floor((t - MON) / w) * w : Math.floor(t / w) * w; };
const sec = (t: number) => Math.floor(t / 1000) as UTCTimestamp;
const ubFmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { ...o, timeZone: "Asia/Ulaanbaatar" });
const F_FULL = ubFmt({ day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }), F_TIME = ubFmt({ hour: "2-digit", minute: "2-digit", hour12: false }), F_DAY = ubFmt({ day: "2-digit", month: "short" }), F_MON = ubFmt({ month: "short", year: "2-digit" });
const stamp = (v: unknown) => (typeof v === "number" ? v * 1000 : 0);
const money = (v: number, d: number) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

/* бүс, шугамын нэр, зорилтот хугацааны тэмдэг — канвас дээр */
type Over = { zone: { from: number; lo: number; hi: number; up: boolean; a: number } | null; tags: { t: number; p: number; text: string; a: number }[]; target: { t: number; text: string } | null };
class Overlay implements ISeriesPrimitive<Time> {
  d: Over = { zone: null, tags: [], target: null };
  private c: SeriesAttachedParameter<Time, SeriesType> | null = null;
  attached(p: SeriesAttachedParameter<Time, SeriesType>) { this.c = p; }
  detached() { this.c = null; }
  update() { this.c?.requestUpdate(); }
  private x(t: number) { return this.c?.chart.timeScale().timeToCoordinate(sec(t) as Time) ?? null; }
  private y(p: number) { return this.c?.series.priceToCoordinate(p) ?? null; }
  private under = { zOrder: () => "bottom" as const, renderer: () => ({ draw: (g: CanvasRenderingTarget2D) => g.useMediaCoordinateSpace(({ context: x, mediaSize: m }) => {
    const z = this.d.zone; if (!z || !z.a) return;
    const a = this.y(z.hi), b = this.y(z.lo), l = this.x(z.from); if (a === null || b === null) return;
    const L = l ?? 0, c = z.up ? "45,255,179" : "255,61,110";
    x.fillStyle = `rgba(${c},${0.13 * z.a})`; x.fillRect(L, a, m.width - L, Math.max(2, b - a));
    x.strokeStyle = `rgba(${c},${0.45 * z.a})`; x.lineWidth = 1; x.setLineDash([]); x.beginPath(); x.moveTo(L, a); x.lineTo(m.width, a); x.moveTo(L, b); x.lineTo(m.width, b); x.stroke();
    const t = this.d.target; if (t) { const q = this.x(t.t); if (q !== null) { x.strokeStyle = "rgba(34,230,255,.55)"; x.setLineDash([4, 4]); x.beginPath(); x.moveTo(q, 0); x.lineTo(q, m.height); x.stroke(); x.setLineDash([]); } }
  }) }) };
  private over = { zOrder: () => "top" as const, renderer: () => ({ draw: (g: CanvasRenderingTarget2D) => g.useMediaCoordinateSpace(({ context: x, mediaSize: m }) => {
    x.font = `700 10.5px ${FONT}`;
    for (const q of this.d.tags) {
      const a = this.x(q.t), b = this.y(q.p); if (a === null || b === null || !q.a) continue;
      const w = x.measureText(q.text).width + 12, l = Math.max(4, Math.min(m.width - w - 4, a - w / 2)), top = b - 9;
      x.globalAlpha = q.a; x.fillStyle = "rgba(13,11,23,.88)"; x.strokeStyle = "rgba(168,163,194,.55)"; x.lineWidth = 1; x.beginPath(); x.roundRect(l, top, w, 18, 3); x.fill(); x.stroke();
      x.fillStyle = "#EFEDF8"; x.textBaseline = "middle"; x.fillText(q.text, l + 6, top + 9.5); x.globalAlpha = 1;
    }
  }) }) };
  paneViews() { return [this.under, this.over]; }
  timeAxisViews() { const t = this.d.target; if (!t) return []; const q = this.x(t.t); if (q === null) return []; return [{ coordinate: () => q, text: () => t.text, textColor: () => "#06050C", backColor: () => CY }]; }
}

/* доод самбарын нэр + сүүлийн утга */
class PaneTitle implements ISeriesPrimitive<Time> {
  constructor(private text: string, private col: string) {}
  private c: SeriesAttachedParameter<Time, SeriesType> | null = null;
  attached(p: SeriesAttachedParameter<Time, SeriesType>) { this.c = p; }
  detached() { this.c = null; }
  set(t: string) { if (t !== this.text) { this.text = t; this.c?.requestUpdate(); } }
  private v = { zOrder: () => "top" as const, renderer: () => ({ draw: (g: CanvasRenderingTarget2D) => g.useMediaCoordinateSpace(({ context: x }) => { x.font = `700 11px ${FONT}`; x.textBaseline = "top"; x.fillStyle = this.col; x.fillText(this.text, 8, 7); }) }) };
  paneViews() { return [this.v]; }
}

type Rt = {
  chart: IChartApi; candle: ISeriesApi<"Candlestick">; ghost: ISeriesApi<"Line">; path: ISeriesApi<"Line">; alt: ISeriesApi<"Line">; pulse: ISeriesApi<"Line">; marks: ISeriesMarkersPluginApi<Time>; over: Overlay;
  bars: { time: UTCTimestamp; open: number; high: number; low: number; close: number }[]; key: string; sig: string; ind: { series: ISeriesApi<"Line">[]; title: PaneTitle | null; id: string }[]; trends: ISeriesApi<"Line">[]; lines: IPriceLine[];
};
const smooth = (k: number) => 1 - (1 - k) ** 3;
/* шинжилгээний зураглалыг бүгдийг цэвэрлэнэ — хугацаа солиход хуучин цэгүүд цагийн тэнхлэгт үлдэж харагдацыг хазайлгахгүй */
function wipe(r: Rt) {
  r.marks.setMarkers([]); r.path.setData([]); r.alt.setData([]);
  r.trends.forEach((x) => r.chart.removeSeries(x)); r.trends = [];
  r.lines.forEach((x) => r.candle.removePriceLine(x)); r.lines = [];
  r.over.d = { zone: null, tags: [], target: null }; r.over.update();
}

export default function DeskChart({ tf, digits, viewKey, data, tick, draw, plan, runKey, scanning, scanText, height, loadErr }: { tf: string; digits: number; viewKey: string; data: ChartData | null; tick: Tick | null; draw: Draw | null; plan: Plan | null; runKey: string; scanning: boolean; scanText: string; height: number; loadErr: string }) {
  const box = useRef<HTMLDivElement>(null), rt = useRef<Rt | null>(null), [L, setL] = useState<typeof import("lightweight-charts") | null>(null);
  const [leg, setLeg] = useState<{ o: number; h: number; l: number; c: number; t: number; hover: boolean } | null>(null), hoverRef = useRef(false);
  /* viewKey = хэрэгсэл + хугацаа. Индикатор нэмэхэд ижил хэвээр тул zoom, зураглал дахин эхлэхгүй */
  const ready = !!data && data.key.startsWith(`${viewKey}:`);

  useEffect(() => { let on = true; import("lightweight-charts").then((m) => { if (on) setL(m); }); return () => { on = false; }; }, []);

  /* чарт нэг удаа үүснэ */
  useEffect(() => {
    if (!L || !box.current) return;
    const grid = "rgba(150,120,255,.07)", edge = "rgba(176,38,255,.3)";
    const chart = L.createChart(box.current, {
      autoSize: true,
      layout: { background: { type: L.ColorType.Solid, color: "transparent" }, textColor: TX, fontFamily: FONT, fontSize: 11, attributionLogo: true, panes: { separatorColor: "rgba(176,38,255,.34)", separatorHoverColor: "rgba(34,230,255,.2)", enableResize: true } },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      crosshair: { mode: L.CrosshairMode.Normal, vertLine: { color: "rgba(34,230,255,.5)", labelBackgroundColor: VI }, horzLine: { color: "rgba(34,230,255,.5)", labelBackgroundColor: VI } },
      rightPriceScale: { borderColor: edge, scaleMargins: { top: 0.07, bottom: 0.06 } },
      timeScale: { borderColor: edge, timeVisible: true, secondsVisible: false, rightOffset: 7, barSpacing: 8, minBarSpacing: 1.2, tickMarkFormatter: (v: Time, k: number) => { const d = new Date(stamp(v)); return k <= 0 ? F_MON.format(d) : k <= 2 ? F_DAY.format(d) : F_TIME.format(d); } },
      localization: { timeFormatter: (v: Time) => F_FULL.format(new Date(stamp(v))) },
    });
    const candle = chart.addSeries(L.CandlestickSeries, { upColor: UP, downColor: DN, borderUpColor: UP, borderDownColor: DN, wickUpColor: UP, wickDownColor: DN, title: "Live", priceLineStyle: L.LineStyle.Dotted });
    const line = (o: object) => chart.addSeries(L.LineSeries, { lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false, ...o });
    const ghost = line({ visible: false, autoscaleInfoProvider: () => null }), alt = line({ color: "rgba(168,163,194,.55)", lineWidth: 1, lineStyle: L.LineStyle.SparseDotted });
    const path = line({ color: CY, lineWidth: 2, lineStyle: L.LineStyle.Dashed, lastPriceAnimation: L.LastPriceAnimationMode.Continuous });
    const pulse = line({ color: "transparent", lineWidth: 1, lastPriceAnimation: L.LastPriceAnimationMode.Continuous, autoscaleInfoProvider: () => null });
    const over = new Overlay(); candle.attachPrimitive(over);
    const marks = L.createSeriesMarkers(candle, []);
    rt.current = { chart, candle, ghost, path, alt, pulse, marks, over, bars: [], key: "", sig: "", ind: [], trends: [], lines: [] };
    const onMove = (p: MouseEventParams<Time>) => { const r = rt.current; if (!r) return; const q = p.seriesData.get(candle) as { open: number; high: number; low: number; close: number } | undefined; hoverRef.current = !!(q && p.point); if (q && typeof p.time === "number") setLeg({ o: q.open, h: q.high, l: q.low, c: q.close, t: p.time * 1000, hover: true }); else setLeg(null); };
    chart.subscribeCrosshairMove(onMove);
    return () => { chart.unsubscribeCrosshairMove(onMove); rt.current = null; chart.remove(); };
  }, [L]);

  useEffect(() => { rt.current?.candle.applyOptions({ priceFormat: { type: "price", precision: digits, minMove: 10 ** -digits } }); }, [L, digits]);

  /* лаа ба индикаторууд */
  useEffect(() => {
    const r = rt.current;
    if (!r || !L || !data || !data.key.startsWith(`${viewKey}:`)) return;
    const fresh = r.key !== viewKey, prev = r.bars[r.bars.length - 1], sig = data.inds.map((q) => q.label).join("|"), rebuild = fresh || sig !== r.sig;
    if (fresh) { wipe(r); r.ghost.setData([]); r.pulse.setData([]); r.bars = []; }
    if (rebuild) {
      r.ind.forEach((q) => q.series.forEach((x) => r.chart.removeSeries(x)));
      r.ind = []; r.sig = sig;
      for (let k = r.chart.panes().length - 1; k > 0; k--) r.chart.removePane(k);
    }
    const bars = data.bars.map(([t, o, h, l, c]) => ({ time: sec(t), open: o, high: h, low: l, close: c })), last = bars[bars.length - 1];
    if (!fresh && prev && last && prev.time === last.time) { last.high = Math.max(last.high, prev.high); last.low = Math.min(last.low, prev.low); }
    r.candle.setData(bars); r.bars = bars; r.key = viewKey;
    if (last) r.pulse.setData([{ time: last.time, value: last.close }]);
    const step = bars.length > 6 ? Math.min(...[1, 2, 3, 4, 5].map((k) => bars[bars.length - k].time - bars[bars.length - k - 1].time)) : TF_MIN[tf] * 60;
    if (last) r.ghost.setData(Array.from({ length: 70 }, (_, k) => ({ time: (last.time + (k + 1) * step) as UTCTimestamp })));

    if (rebuild) {
      let pane = 0, col = 0;
      for (const q of data.inds) {
        const sub = q.pane === "sub", c = PALETTE[col++ % PALETTE.length]; if (sub) pane++;
        const series = q.lines.map((l, m) => {
          const a = r.chart.addSeries(L.LineSeries, { color: sub ? SUB_LINE[m % 3] : c, lineWidth: l.dots ? 1 : (q.lines.length > 1 && m !== 1 ? 1 : 2), lineVisible: !l.dots, pointMarkersVisible: !!l.dots, pointMarkersRadius: 1.4, lastValueVisible: sub && m === 0, priceLineVisible: false, crosshairMarkerVisible: false, priceFormat: { type: "price", precision: sub ? 2 : digits, minMove: sub ? 0.01 : 10 ** -digits } }, sub ? pane : 0);
          if (sub && m === 0) (q.ref || []).forEach((v) => a.createPriceLine({ price: v, color: "rgba(168,163,194,.32)", lineWidth: 1, lineStyle: L.LineStyle.Dashed, axisLabelVisible: false, title: "" }));
          return a;
        });
        let title: PaneTitle | null = null;
        if (sub) { title = new PaneTitle(q.label, "#EFEDF8"); series[0].attachPrimitive(title); }
        r.ind.push({ series, title, id: q.id });
      }
      const ps = r.chart.panes(), H = Math.max(300, height - (ps.length - 1) * 78);
      ps.forEach((p, k) => p.setStretchFactor(k ? 78 : H));
    }
    data.inds.forEach((q, k) => {
      const x = r.ind[k]; if (!x) return;
      q.lines.forEach((l, m) => x.series[m]?.setData(bars.flatMap((b, i) => { const v = l.v[i]; return typeof v === "number" && Number.isFinite(v) ? [{ time: b.time, value: v }] : []; })));
      x.title?.set(`${q.label}${q.read ? ` · ${q.read}` : ""}`);
    });
    if (fresh) { const n = bars.length, w = box.current?.clientWidth ?? 800; r.chart.timeScale().setVisibleLogicalRange({ from: n - (w < 560 ? 58 : 120), to: n + 7 }); r.chart.priceScale("right").applyOptions({ autoScale: true }); }
  }, [L, data, viewKey, tf, digits, height]);

  /* tick: сүүлийн лааг шууд хөдөлгөнө, цаг шилжвэл шинэ лаа нээнэ */
  useEffect(() => {
    const r = rt.current;
    if (!r || !tick || !(tick.px > 0) || !r.bars.length || r.key !== viewKey) return;
    const k = sec(bucket(tick.t, tf)), l = r.bars[r.bars.length - 1], px = tick.px;
    if (k < l.time) return;
    if (k === l.time) { l.high = Math.max(l.high, px); l.low = Math.min(l.low, px); l.close = px; r.candle.update({ ...l }); }
    else { const b = { time: k, open: l.close, high: Math.max(l.close, px), low: Math.min(l.close, px), close: px }; r.bars.push(b); r.candle.update(b); }
    r.pulse.update({ time: r.bars[r.bars.length - 1].time, value: px });
    if (!hoverRef.current) { const b = r.bars[r.bars.length - 1]; setLeg({ o: b.open, h: b.high, l: b.low, c: b.close, t: b.time * 1000, hover: false }); }
  }, [tick, viewKey, tf]);

  /* шинжилгээг дарааллаар зурах */
  useEffect(() => {
    const r = rt.current;
    if (!r || !L || !ready) return;
    wipe(r);
    if (!draw) return;
    const calm = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, timers: ReturnType<typeof setTimeout>[] = [], raf: number[] = [];
    let at = 0;
    const later = (d: number, f: () => void) => { at += calm ? 0 : d; timers.push(setTimeout(f, at)); };
    const tween = (ms: number, f: (k: number) => void) => { if (calm) { f(1); return; } const t0 = performance.now(), go = (t: number) => { const k = Math.min(1, (t - t0) / ms); f(smooth(k)); if (k < 1) raf.push(requestAnimationFrame(go)); }; raf.push(requestAnimationFrame(go)); };
    const times = new Map(r.bars.map((b, k) => [b.time as number, k])), lastT = r.bars[r.bars.length - 1].time, step = Math.round(draw.step / 1000) || TF_MIN[tf] * 60;

    /* 1 · шошгууд */
    const kindCol = { up: UP, dn: DN, warn: AM, mute: TX } as const;
    const list: SeriesMarker<Time>[] = draw.marks.filter((m) => times.has(sec(m.t))).map((m) => ({ time: sec(m.t) as Time, position: m.above ? "aboveBar" : "belowBar", color: kindCol[m.kind], shape: /BOS|CHoCH|Rejection/.test(m.text) ? (m.above ? "arrowDown" : "arrowUp") : "circle", size: /BOS|CHoCH/.test(m.text) ? 1.1 : 0.6, text: m.text }));
    list.forEach((_, k) => later(70, () => r.marks.setMarkers(list.slice(0, k + 1))));

    /* 2 · трендийн шугамууд */
    draw.trends.forEach((q) => later(180, () => {
      const a = times.get(sec(q.a.t)), e = times.get(sec(q.end.t)) ?? r.bars.length - 1; if (a === undefined || e <= a) return;
      const pts = r.bars.slice(a, e + 1).map((b, k) => ({ time: b.time as Time, value: q.a.p + ((q.end.p - q.a.p) * k) / (e - a) }));
      const x = r.chart.addSeries(L.LineSeries, { color: "rgba(226,222,245,.62)", lineWidth: 1, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false, autoscaleInfoProvider: () => null });
      r.trends.push(x);
      tween(420, (k) => x.setData(pts.slice(0, Math.max(2, Math.ceil(pts.length * k)))));
      r.over.d.tags.push({ t: r.bars[Math.round(a + (e - a) * 0.62)].time * 1000, p: q.a.p + (q.end.p - q.a.p) * 0.62, text: q.name, a: 0 });
      const tag = r.over.d.tags[r.over.d.tags.length - 1];
      tween(420, (k) => { tag.a = k; r.over.update(); });
    }));

    /* 3 · бүс ба түвшин */
    if (plan) later(320, () => {
      r.over.d.zone = { from: r.bars[Math.max(0, r.bars.length - 26)].time * 1000, lo: plan.lo, hi: plan.hi, up: plan.dir > 0, a: 0 };
      tween(380, (k) => { if (r.over.d.zone) r.over.d.zone.a = k; r.over.update(); });
    });
    const rows = plan ? [{ p: plan.hi, t: "Бүс дээд", c: TX, hide: true }, { p: plan.lo, t: "Бүс доод", c: TX, hide: true }, { p: plan.entry, t: "Орох", c: CY }, { p: plan.sl, t: "SL", c: DN }, { p: plan.tp1, t: "TP1", c: UP }, { p: plan.tp2, t: "TP2", c: UP }] : [];
    rows.forEach((q) => later(110, () => r.lines.push(r.candle.createPriceLine({ price: q.p, color: q.c, lineWidth: 1, lineStyle: L.LineStyle.Dashed, lineVisible: !q.hide, axisLabelVisible: true, title: q.t, axisLabelColor: q.hide ? "#2A2444" : q.c, axisLabelTextColor: q.hide ? "#EFEDF8" : "#06050C" }))));
    if (draw.neck) later(80, () => r.lines.push(r.candle.createPriceLine({ price: draw.neck!.p, color: AM, lineWidth: 1, lineStyle: L.LineStyle.Dotted, axisLabelVisible: true, title: draw.neck!.name })));

    /* 4 · таамгийн зам: цэг бүрийг tick дагаж сүүлийн лаанаас эхлүүлнэ */
    if (draw.path.length > 2) later(220, () => {
      const base = draw.path[0].t, nOf = (t: number) => Math.round((t - base) / draw.step), px = r.bars[r.bars.length - 1].close;
      const dense = (pts: { n: number; v: number }[]) => { const o: { time: Time; value: number }[] = []; for (let j = 1; j < pts.length; j++) { const a = pts[j - 1], b = pts[j], m = Math.max(1, b.n - a.n); for (let k = j === 1 ? 0 : 1; k <= m; k++) o.push({ time: (lastT + (a.n + k) * step) as Time, value: a.v + ((b.v - a.v) * k) / m }); } return o; };
      const main = dense([{ n: 0, v: px }, { n: nOf(draw.path[1].t), v: draw.path[1].p }, { n: nOf(draw.path[2].t), v: draw.path[2].p }]);
      const alt = draw.alt.length > 1 ? dense([{ n: nOf(draw.alt[0].t), v: draw.alt[0].p }, { n: nOf(draw.alt[1].t), v: draw.alt[1].p }]) : [];
      r.path.applyOptions({ color: plan && plan.dir > 0 ? UP : plan ? DN : CY });
      const endN = nOf(draw.path[2].t), endT = (lastT + endN * step) * 1000;
      r.over.d.target = { t: endT, text: F_FULL.format(new Date(endT)) }; r.over.update();
      tween(900, (k) => { r.path.setData(main.slice(0, Math.max(2, Math.ceil(main.length * k)))); if (k > 0.45) r.alt.setData(alt.slice(0, Math.max(2, Math.ceil(alt.length * ((k - 0.45) / 0.55))))); });
      const n = r.bars.length, w = box.current?.clientWidth ?? 800;
      r.chart.timeScale().setVisibleLogicalRange({ from: n - (w < 560 ? 42 : 90), to: n + Math.min(60, endN + 5) });
    });
    return () => { timers.forEach(clearTimeout); raf.forEach(cancelAnimationFrame); };
  }, [L, ready, runKey, draw, plan, tf]);

  const shown = leg ?? (() => { const b = ready ? data!.bars[data!.bars.length - 1] : null; return b ? { o: b[1], h: b[2], l: b[3], c: b[4], t: b[0], hover: false } : null; })();
  const pct = shown ? ((shown.c - shown.o) / shown.o) * 100 : 0;
  return (
    <div className={s.frame} data-scan={scanning || undefined} data-wait={!ready || undefined} style={{ height }}>
      <div ref={box} className={s.canvas} />
      {!ready && <div className={s.loading} role="status">{loadErr || `${tf} лаа ачаалж байна…`}</div>}
      {shown && <div className={s.legend} data-d={shown.c >= shown.o ? "up" : "dn"} data-hover={shown.hover || undefined}><span>{shown.hover ? F_FULL.format(new Date(shown.t)) : "Одоогийн лаа"}</span><span>O <b>{money(shown.o, digits)}</b></span><span>H <b>{money(shown.h, digits)}</b></span><span>L <b>{money(shown.l, digits)}</b></span><span>C <b>{money(shown.c, digits)}</b></span><strong>{pct >= 0 ? "+" : ""}{pct.toFixed(2)}%</strong></div>}
      {scanning && <div className={s.scanTxt} role="status">{scanText}</div>}
      <i className={s.c1} /><i className={s.c2} /><i className={s.c3} /><i className={s.c4} />
    </div>
  );
}
