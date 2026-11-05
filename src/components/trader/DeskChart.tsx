"use client";

import { useEffect, useRef, useState } from "react";
import type { IChartApi, IPriceLine, ISeriesApi, ISeriesMarkersPluginApi, ISeriesPrimitive, MouseEventParams, SeriesAttachedParameter, SeriesMarker, SeriesType, Time, UTCTimestamp } from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";
import s from "./desk.module.css";

/* ─── TESLA TRADER v9 · ЧАРТ (2026-11-06) ────────────────────────────────────
   Анхдагчаар лаа, дэмжлэг/эсэргүүцэл, хэмжсэн 80% хөдөлгөөний конус л харагдана. Таамгийн «зам» хассан: зохиомол
   шугамын оронд шалгасан бүс. Бүтцийн тэмдэг, төлөвлөгөөний түвшин хэрэглэгч асаасан эсвэл батлагдсан үед л гарна.
   Tick сүүлийн лааг шууд хөдөлгөнө. Дөрвөн өнгө: slate, paper, rise, fall. */

export type Bar = [number, number, number, number, number];
export type ChartLine = { name: string; dots?: boolean; v: (number | null)[] };
export type ChartInd = { id: string; label: string; pane: "price" | "sub"; ref?: number[]; read?: string; vote?: number; lines: ChartLine[] };
export type ChartData = { key: string; bars: Bar[]; inds: ChartInd[]; serverNow?: number };
export type Tick = { px: number; bid: number; ask: number; chg: number; t: number };
export type Plan = { strat: string; dir: number; lo: number; hi: number; entry: number; sl: number; tp1: number; tp2: number; rr: number };
export type Pt = { t: number; p: number };
export type Draw = { marks: { t: number; above: boolean; text: string; kind: "up" | "dn" | "warn" | "mute" }[]; trends: { name: string; a: Pt; b: Pt; end: Pt }[]; neck: { p: number; name: string } | null };
export type Layer = { unit: number | null; horizon: number; sup: number | null; res: number | null; plan: Plan | null; marks: Draw | null };

const SLATE = "#1B2028", INK = "#E8E6E1", UP = "#22A5A3", DN = "#E8655A", TINT = "#3B424C";
const ink = (a: number) => `rgba(232,230,225,${a})`;
const FONT = "Manrope, system-ui, sans-serif";
export const TF_MIN: Record<string, number> = { "1m": 1, "5m": 5, "15m": 15, "30m": 30, "1H": 60, "4H": 240, "1D": 1440, "1W": 10080 };
const MON = Date.UTC(2024, 0, 1);
export const bucket = (t: number, tf: string) => { const w = TF_MIN[tf] * 60000; return tf === "1W" ? MON + Math.floor((t - MON) / w) * w : Math.floor(t / w) * w; };
const sec = (t: number) => Math.floor(t / 1000) as UTCTimestamp;
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { ...o, timeZone: "Asia/Ulaanbaatar" });
const F_FULL = fmt({ day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }), F_TIME = fmt({ hour: "2-digit", minute: "2-digit", hour12: false }), F_DAY = fmt({ day: "2-digit", month: "short" }), F_MON = fmt({ month: "short", year: "2-digit" });
const stamp = (v: unknown) => (typeof v === "number" ? v * 1000 : 0);
const money = (v: number, d: number) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

/* конусын дүүргэлт, төлөвлөгөөний бүс, трендийн нэр */
type Over = { cone: { t: number; lo: number; hi: number }[]; zone: { from: number; lo: number; hi: number; up: boolean } | null; tags: { t: number; p: number; text: string }[] };
class Overlay implements ISeriesPrimitive<Time> {
  d: Over = { cone: [], zone: null, tags: [] };
  private c: SeriesAttachedParameter<Time, SeriesType> | null = null;
  attached(p: SeriesAttachedParameter<Time, SeriesType>) { this.c = p; }
  detached() { this.c = null; }
  update() { this.c?.requestUpdate(); }
  private x(t: number) { return this.c?.chart.timeScale().timeToCoordinate(sec(t) as Time) ?? null; }
  private y(p: number) { return this.c?.series.priceToCoordinate(p) ?? null; }
  private under = { zOrder: () => "bottom" as const, renderer: () => ({ draw: (g: CanvasRenderingTarget2D) => g.useMediaCoordinateSpace(({ context: x, mediaSize: m }) => {
    const c = this.d.cone;
    if (c.length > 1) {
      const at = (t: number, p: number): [number, number] | null => { const a = this.x(t), b = this.y(p); return a === null || b === null ? null : [a, b]; };
      const pts = [...c.map((q) => at(q.t, q.hi)), ...[...c].reverse().map((q) => at(q.t, q.lo))].filter((q): q is [number, number] => !!q);
      if (pts.length > 3) { x.fillStyle = ink(0.08); x.beginPath(); pts.forEach(([a, b], k) => (k ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); x.fill(); }
    }
    const z = this.d.zone; if (!z) return;
    const a = this.y(z.hi), b = this.y(z.lo), l = this.x(z.from) ?? 0; if (a === null || b === null) return;
    x.fillStyle = z.up ? "rgba(34,165,163,.14)" : "rgba(232,101,90,.14)"; x.fillRect(l, a, m.width - l, Math.max(2, b - a));
  }) }) };
  private over = { zOrder: () => "top" as const, renderer: () => ({ draw: (g: CanvasRenderingTarget2D) => g.useMediaCoordinateSpace(({ context: x, mediaSize: m }) => {
    x.font = `600 11px ${FONT}`;
    for (const q of this.d.tags) {
      const a = this.x(q.t), b = this.y(q.p); if (a === null || b === null) continue;
      const w = x.measureText(q.text).width + 12, l = Math.max(4, Math.min(m.width - w - 4, a - w / 2));
      x.fillStyle = SLATE; x.fillRect(l, b - 9, w, 18); x.fillStyle = ink(0.8); x.textBaseline = "middle"; x.fillText(q.text, l + 6, b + 0.5);
    }
  }) }) };
  paneViews() { return [this.under, this.over]; }
}

/* доод самбарын нэр */
class PaneTitle implements ISeriesPrimitive<Time> {
  constructor(private text: string) {}
  private c: SeriesAttachedParameter<Time, SeriesType> | null = null;
  attached(p: SeriesAttachedParameter<Time, SeriesType>) { this.c = p; }
  detached() { this.c = null; }
  set(t: string) { if (t !== this.text) { this.text = t; this.c?.requestUpdate(); } }
  private v = { zOrder: () => "top" as const, renderer: () => ({ draw: (g: CanvasRenderingTarget2D) => g.useMediaCoordinateSpace(({ context: x }) => { x.font = `600 11px ${FONT}`; x.textBaseline = "top"; x.fillStyle = ink(0.8); x.fillText(this.text, 8, 7); }) }) };
  paneViews() { return [this.v]; }
}

type Rt = {
  chart: IChartApi; candle: ISeriesApi<"Candlestick">; ghost: ISeriesApi<"Line">; hi: ISeriesApi<"Line">; lo: ISeriesApi<"Line">; now: ISeriesApi<"Line">; marks: ISeriesMarkersPluginApi<Time>; over: Overlay;
  bars: { time: UTCTimestamp; open: number; high: number; low: number; close: number }[]; key: string; sig: string; ind: { series: ISeriesApi<"Line">[]; title: PaneTitle | null }[]; trends: ISeriesApi<"Line">[]; lines: IPriceLine[]; step: number;
};
function wipe(r: Rt) {
  r.marks.setMarkers([]); r.hi.setData([]); r.lo.setData([]);
  r.trends.forEach((x) => r.chart.removeSeries(x)); r.trends = [];
  r.lines.forEach((x) => r.candle.removePriceLine(x)); r.lines = [];
  r.over.d = { cone: [], zone: null, tags: [] }; r.over.update();
}

export default function DeskChart({ tf, digits, viewKey, data, tick, layer, layerSig, subs, loadErr }: { tf: string; digits: number; viewKey: string; data: ChartData | null; tick: Tick | null; layer: Layer | null; layerSig: string; subs: number; loadErr: string }) {
  const box = useRef<HTMLDivElement>(null), rt = useRef<Rt | null>(null), [L, setL] = useState<typeof import("lightweight-charts") | null>(null);
  const [leg, setLeg] = useState<{ o: number; h: number; l: number; c: number; t: number } | null>(null);
  /* viewKey = хэрэгсэл + хугацаа. Индикатор нэмэхэд өөрчлөгдөхгүй тул zoom алдагдахгүй */
  const ready = !!data && data.key.startsWith(`${viewKey}:`);

  useEffect(() => { let on = true; import("lightweight-charts").then((m) => { if (on) setL(m); }); return () => { on = false; }; }, []);

  useEffect(() => {
    if (!L || !box.current) return;
    const chart = L.createChart(box.current, {
      autoSize: true,
      layout: { background: { type: L.ColorType.Solid, color: "transparent" }, textColor: ink(0.62), fontFamily: FONT, fontSize: 11, attributionLogo: true, panes: { separatorColor: ink(0.1), separatorHoverColor: ink(0.05), enableResize: true } },
      grid: { vertLines: { visible: false }, horzLines: { color: ink(0.05) } },
      crosshair: { mode: L.CrosshairMode.Normal, vertLine: { color: ink(0.3), labelBackgroundColor: TINT }, horzLine: { color: ink(0.3), labelBackgroundColor: TINT } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.06, bottom: 0.05 } },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, rightOffset: 4, barSpacing: 8, minBarSpacing: 1.2, tickMarkFormatter: (v: Time, k: number) => { const d = new Date(stamp(v)); return k <= 0 ? F_MON.format(d) : k <= 2 ? F_DAY.format(d) : F_TIME.format(d); } },
      localization: { timeFormatter: (v: Time) => F_FULL.format(new Date(stamp(v))) },
    });
    const candle = chart.addSeries(L.CandlestickSeries, { upColor: UP, downColor: DN, borderVisible: false, wickUpColor: UP, wickDownColor: DN, lastValueVisible: false, priceLineVisible: false });
    const line = (o: object) => chart.addSeries(L.LineSeries, { lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false, ...o });
    const ghost = line({ visible: false, autoscaleInfoProvider: () => null }), hi = line({ color: ink(0.3), lineWidth: 1, lineStyle: L.LineStyle.Dashed }), lo = line({ color: ink(0.3), lineWidth: 1, lineStyle: L.LineStyle.Dashed });
    /* live шошго: өнгө нь лаанаас хамаарч анивчихгүй, нүд амраана */
    const now = line({ color: INK, lineVisible: false, lastValueVisible: true, priceLineVisible: true, priceLineColor: ink(0.35), priceLineStyle: L.LineStyle.Dotted, priceLineWidth: 1, autoscaleInfoProvider: () => null });
    const over = new Overlay(); candle.attachPrimitive(over);
    rt.current = { chart, candle, ghost, hi, lo, now, marks: L.createSeriesMarkers(candle, []), over, bars: [], key: "", sig: "", ind: [], trends: [], lines: [], step: 60 };
    const onMove = (p: MouseEventParams<Time>) => { const q = p.seriesData.get(candle) as { open: number; high: number; low: number; close: number } | undefined; setLeg(q && p.point && typeof p.time === "number" ? { o: q.open, h: q.high, l: q.low, c: q.close, t: p.time * 1000 } : null); };
    chart.subscribeCrosshairMove(onMove);
    return () => { chart.unsubscribeCrosshairMove(onMove); rt.current = null; chart.remove(); };
  }, [L]);

  useEffect(() => { const f = { type: "price" as const, precision: digits, minMove: 10 ** -digits }; rt.current?.candle.applyOptions({ priceFormat: f }); rt.current?.now.applyOptions({ priceFormat: f }); }, [L, digits]);

  /* лаа, хэрэглэгчийн зурсан индикатор */
  useEffect(() => {
    const r = rt.current;
    if (!r || !L || !data || !data.key.startsWith(`${viewKey}:`)) return;
    const fresh = r.key !== viewKey, prev = r.bars[r.bars.length - 1], sig = data.inds.map((q) => q.label).join("|"), rebuild = fresh || sig !== r.sig;
    if (fresh) { wipe(r); r.ghost.setData([]); r.now.setData([]); r.bars = []; }
    if (rebuild) { r.ind.forEach((q) => q.series.forEach((x) => r.chart.removeSeries(x))); r.ind = []; r.sig = sig; for (let k = r.chart.panes().length - 1; k > 0; k--) r.chart.removePane(k); }
    const bars = data.bars.map(([t, o, h, l, c]) => ({ time: sec(t), open: o, high: h, low: l, close: c })), last = bars[bars.length - 1];
    if (!fresh && prev && last && prev.time === last.time) { last.high = Math.max(last.high, prev.high); last.low = Math.min(last.low, prev.low); }
    r.candle.setData(bars); r.bars = bars; r.key = viewKey;
    if (last) r.now.setData([{ time: last.time, value: last.close }]);
    r.step = bars.length > 6 ? Math.min(...[1, 2, 3, 4, 5].map((k) => bars[bars.length - k].time - bars[bars.length - k - 1].time)) : TF_MIN[tf] * 60;
    if (last) r.ghost.setData(Array.from({ length: 40 }, (_, k) => ({ time: (last.time + (k + 1) * r.step) as UTCTimestamp })));
    if (rebuild) {
      let pane = 0, price = 0;
      for (const q of data.inds) {
        const sub = q.pane === "sub"; if (sub) pane++;
        const style = sub ? L.LineStyle.Solid : [L.LineStyle.Solid, L.LineStyle.Dashed, L.LineStyle.Dotted][price++ % 3];
        const series = q.lines.map((l, m) => {
          const a = r.chart.addSeries(L.LineSeries, { color: ink(q.lines.length > 1 && m !== (sub ? 0 : 1) ? 0.4 : 0.85), lineWidth: l.dots ? 1 : 2, lineStyle: style, lineVisible: !l.dots, pointMarkersVisible: !!l.dots, pointMarkersRadius: 1.4, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false, priceFormat: { type: "price", precision: sub ? 2 : digits, minMove: sub ? 0.01 : 10 ** -digits } }, sub ? pane : 0);
          if (sub && m === 0) (q.ref || []).forEach((v) => a.createPriceLine({ price: v, color: ink(0.2), lineWidth: 1, lineStyle: L.LineStyle.Dashed, axisLabelVisible: false, title: "" }));
          return a;
        });
        let title: PaneTitle | null = null;
        if (sub) { title = new PaneTitle(q.label); series[0].attachPrimitive(title); }
        r.ind.push({ series, title });
      }
      const ps = r.chart.panes(), H = Math.max(260, (box.current?.clientHeight ?? 560) - (ps.length - 1) * 78);
      ps.forEach((p, k) => p.setStretchFactor(k ? 78 : H));
    }
    data.inds.forEach((q, k) => {
      const x = r.ind[k]; if (!x) return;
      q.lines.forEach((l, m) => x.series[m]?.setData(bars.flatMap((b, i) => { const v = l.v[i]; return typeof v === "number" && Number.isFinite(v) ? [{ time: b.time, value: v }] : []; })));
      x.title?.set(`${q.label}${q.read ? `  ${q.read}` : ""}`);
    });
    if (fresh) { const n = bars.length, w = box.current?.clientWidth ?? 800; r.chart.timeScale().setVisibleLogicalRange({ from: n - (w < 560 ? 56 : 110), to: n + 15 }); r.chart.priceScale("right").applyOptions({ autoScale: true }); }
  }, [L, data, viewKey, tf, digits, subs]);

  useEffect(() => {
    const r = rt.current;
    if (!r || !tick || !(tick.px > 0) || !r.bars.length || r.key !== viewKey) return;
    const k = sec(bucket(tick.t, tf)), l = r.bars[r.bars.length - 1], px = tick.px;
    if (k < l.time) return;
    if (k === l.time) { l.high = Math.max(l.high, px); l.low = Math.min(l.low, px); l.close = px; r.candle.update({ ...l }); }
    else { const b = { time: k, open: l.close, high: Math.max(l.close, px), low: Math.min(l.close, px), close: px }; r.bars.push(b); r.candle.update(b); }
    r.now.update({ time: r.bars[r.bars.length - 1].time, value: px });
  }, [tick, viewKey, tf]);

  /* дэмжлэг, эсэргүүцэл, конус; хүсвэл бүтэц ба төлөвлөгөө */
  useEffect(() => {
    const r = rt.current;
    if (!r || !L || !ready || !r.bars.length) return;
    wipe(r);
    if (!layer) return;
    const last = r.bars[r.bars.length - 1], px = last.close, tag = (p: number, title: string, color: string, label: string, text: string, style = L.LineStyle.Dotted) => r.lines.push(r.candle.createPriceLine({ price: p, color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title, axisLabelColor: label, axisLabelTextColor: text }));
    if (layer.unit) {
      const pts = Array.from({ length: layer.horizon + 1 }, (_, j) => ({ time: (last.time + j * r.step) as Time, hi: px + layer.unit! * Math.sqrt(j), lo: px - layer.unit! * Math.sqrt(j) }));
      r.hi.setData(pts.map((q) => ({ time: q.time, value: q.hi }))); r.lo.setData(pts.map((q) => ({ time: q.time, value: q.lo })));
      r.over.d.cone = pts.map((q) => ({ t: (q.time as number) * 1000, lo: q.lo, hi: q.hi }));
    }
    const wide = (box.current?.clientWidth ?? 800) >= 300;
    if (layer.res) tag(layer.res, wide ? "Эсэргүүцэл" : "", ink(0.5), TINT, INK);
    if (layer.sup) tag(layer.sup, wide ? "Дэмжлэг" : "", ink(0.5), TINT, INK);
    const m = layer.marks;
    if (m) {
      const times = new Set(r.bars.map((b) => b.time as number)), col = { up: UP, dn: DN, warn: INK, mute: ink(0.6) } as const;
      const list: SeriesMarker<Time>[] = m.marks.filter((q) => times.has(sec(q.t))).map((q) => ({ time: sec(q.t) as Time, position: q.above ? "aboveBar" : "belowBar", color: col[q.kind], shape: /BOS|CHoCH|Rejection/.test(q.text) ? (q.above ? "arrowDown" : "arrowUp") : "circle", size: 0.7, text: q.text }));
      r.marks.setMarkers(list);
      for (const q of m.trends) {
        const a = r.bars.findIndex((b) => b.time === sec(q.a.t)), e = r.bars.findIndex((b) => b.time === sec(q.end.t)); if (a < 0 || e <= a) continue;
        const x = r.chart.addSeries(L.LineSeries, { color: ink(0.45), lineWidth: 1, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false, autoscaleInfoProvider: () => null });
        x.setData([{ time: r.bars[a].time as Time, value: q.a.p }, { time: r.bars[e].time as Time, value: q.end.p }]); r.trends.push(x);
        if ((box.current?.clientWidth ?? 800) >= 460) { const k = Math.round(a + (e - a) * 0.6); r.over.d.tags.push({ t: r.bars[k].time * 1000, p: q.a.p + (q.end.p - q.a.p) * 0.6, text: q.name }); }
      }
    }
    const p = layer.plan;
    if (p) {
      r.over.d.zone = { from: r.bars[Math.max(0, r.bars.length - 26)].time * 1000, lo: p.lo, hi: p.hi, up: p.dir > 0 };
      tag(p.entry, "Орох", ink(0.8), INK, SLATE, L.LineStyle.Dashed); tag(p.sl, "SL", DN, DN, SLATE, L.LineStyle.Dashed); tag(p.tp1, "TP", UP, UP, SLATE, L.LineStyle.Dashed);
    }
    r.over.update();
  }, [L, ready, layerSig]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={s.frame} data-wait={!ready || undefined} style={{ "--subs": subs } as React.CSSProperties}>
      <div ref={box} className={s.canvas} />
      {!ready && <div className={s.loading} role="status">{loadErr || "Лаа ачаалж байна"}</div>}
      {leg && <div className={s.legend}><span>{F_FULL.format(new Date(leg.t))}</span><span>Нээлт {money(leg.o, digits)}</span><span>Дээд {money(leg.h, digits)}</span><span>Доод {money(leg.l, digits)}</span><span>Хаалт {money(leg.c, digits)}</span></div>}
    </div>
  );
}
