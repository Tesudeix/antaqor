"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { T, MONO, Btn } from "@/components/admin/kit";

// ─────────────────────────────────────────────────────────────────────────
// Social Automation — a visual, ManyChat-style flow builder on a pannable
// canvas. Nodes (trigger → message → buttons → delay → condition → action)
// are wired output→input by clicking handles. Persists { nodes, edges } to
// /api/admin/social-flows. Motion: flowing edges, spring-mounted nodes,
// pulse handles, live link preview.
// ─────────────────────────────────────────────────────────────────────────

type NodeType = "trigger" | "message" | "buttons" | "delay" | "condition" | "action";
type Platform = "instagram" | "messenger" | "facebook" | "threads";

interface FNode { id: string; type: NodeType; x: number; y: number; data: Record<string, unknown> }
interface FEdge { id: string; source: string; sourceHandle: string; target: string }
interface Flow {
  _id: string; name: string; description: string; platform: Platform;
  enabled: boolean; nodes: FNode[]; edges: FEdge[]; runs: number; updatedAt: string;
}

const NODE_W = 232;

const NODE_META: Record<NodeType, { label: string; color: string; icon: string }> = {
  trigger:   { label: "Триггер",  color: "#22D3EE", icon: "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" },
  message:   { label: "Мессеж",   color: "#1080CA", icon: "M20 2H4a2 2 0 00-2 2v12a2 2 0 002 2h4l4 4 4-4h4a2 2 0 002-2V4a2 2 0 00-2-2z" },
  buttons:   { label: "Товчнууд", color: "#A855F7", icon: "M4 5h16M4 12h16M4 19h9" },
  delay:     { label: "Хүлээх",   color: "#FBBF24", icon: "M12 6v6l4 2M12 22a10 10 0 110-20 10 10 0 010 20z" },
  condition: { label: "Нөхцөл",   color: "#4E94D0", icon: "M12 4v6m0 0l-5 5m5-5l5 5M7 20a2 2 0 11-.01 0M17 20a2 2 0 11-.01 0" },
  action:    { label: "Үйлдэл",   color: "#4ADE80", icon: "M13 3L4 14h6l-1 7 9-11h-6l1-7z" },
};

const PLATFORMS: { key: Platform; label: string }[] = [
  { key: "instagram", label: "Instagram" },
  { key: "messenger", label: "Messenger" },
  { key: "facebook", label: "Facebook" },
  { key: "threads", label: "Threads" },
];

const uid = (p = "n") => `${p}-${Math.random().toString(36).slice(2, 8)}`;

// Output handles a node exposes along its bottom edge (id + label + x-fraction).
function outHandles(n: FNode): { id: string; label: string; frac: number }[] {
  if (n.type === "condition") {
    return [
      { id: "yes", label: "Тийм", frac: 0.28 },
      { id: "no", label: "Үгүй", frac: 0.72 },
    ];
  }
  if (n.type === "buttons") {
    const opts = (n.data.options as { id: string; label: string }[]) || [];
    if (opts.length === 0) return [{ id: "out", label: "", frac: 0.5 }];
    return opts.map((o, i) => ({ id: o.id, label: o.label, frac: (i + 1) / (opts.length + 1) }));
  }
  return [{ id: "out", label: "", frac: 0.5 }];
}

// ── Root: list ⇆ editor ────────────────────────────────────────────────────
export default function AdminFlowsPage() {
  const [editingId, setEditingId] = useState<string | null>(null);
  return editingId ? (
    <FlowEditor id={editingId} onBack={() => setEditingId(null)} />
  ) : (
    <FlowList onOpen={setEditingId} />
  );
}

// ── Flow list ──────────────────────────────────────────────────────────────
function FlowList({ onOpen }: { onOpen: (id: string) => void }) {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/social-flows", { cache: "no-store" });
      const d = await r.json();
      if (Array.isArray(d.flows)) setFlows(d.flows);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setCreating(true);
    try {
      const r = await fetch("/api/admin/social-flows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const d = await r.json();
      if (d.flow?._id) onOpen(d.flow._id);
    } finally { setCreating(false); }
  };

  const remove = async (f: Flow) => {
    if (!confirm(`"${f.name}" устгах уу?`)) return;
    await fetch(`/api/admin/social-flows/${f._id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.30em]" style={{ color: T.primary }}>ANTAQOR / AUTOMATION</p>
          <h1 className="mt-1 text-[24px] font-black" style={{ color: T.text }}>Social Automation<span style={{ color: T.primary }}>.</span></h1>
          <p className="mt-1 text-[12px]" style={{ color: T.muted }}>ManyChat маягийн визуал flow builder — триггер → мессеж → салаа → үйлдэл</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin" className="rounded-none border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em]" style={{ borderColor: T.border, color: T.muted }}>← Админ</Link>
          <Btn onClick={create} loading={creating}>+ Шинэ flow</Btn>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: T.muted }}>Ачааллаж байна…</div>
      ) : flows.length === 0 ? (
        <div className="rounded-none border-2 border-dashed p-12 text-center" style={{ borderColor: T.border }}>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: T.muted }}>FLOW БАЙХГҮЙ</p>
          <p className="mt-2 text-[13px]" style={{ color: T.muted }}>Эхний автоматжуулалтаа үүсгэ — DM триггерээс эхэлнэ.</p>
          <div className="mt-5 flex justify-center"><Btn onClick={create} loading={creating}>+ Эхний flow үүсгэх</Btn></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {flows.map((f) => {
            const trig = f.nodes?.find((n) => n.type === "trigger");
            const kws = (trig?.data?.keywords as string[]) || [];
            return (
              <div key={f._id} className="group relative rounded-none border bg-[#0E0E12] p-4 transition hover:border-[rgba(16,128,202,0.45)]" style={{ borderColor: T.border }}>
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => onOpen(f._id)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: f.enabled ? T.ok : T.faint, boxShadow: f.enabled ? `0 0 8px ${T.ok}` : "none" }} />
                      <span className="truncate text-[14px] font-bold" style={{ color: T.text }}>{f.name}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 font-mono text-[10px]" style={{ color: T.muted }}>
                      <span className="rounded-none border px-1.5 py-0.5 uppercase tracking-[0.12em]" style={{ borderColor: T.border }}>{f.platform}</span>
                      <span>{f.nodes?.length || 0} node</span>
                      <span>·</span>
                      <span>{f.edges?.length || 0} холбоос</span>
                      <span>·</span>
                      <span>{f.runs || 0} run</span>
                    </div>
                    {kws.length > 0 && (
                      <div className="mt-2 line-clamp-1 text-[11px]" style={{ color: T.faint }}>триггер: {kws.join(", ")}</div>
                    )}
                  </button>
                  <button onClick={() => remove(f)} aria-label="Устгах" className="shrink-0 rounded-none p-1.5 transition hover:text-[#1080CA]" style={{ color: T.muted }}>
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9M19.228 5.79L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79M7.5 5.79h9" /></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Flow editor: top bar + canvas + inspector ──────────────────────────────
function FlowEditor({ id, onBack }: { id: string; onBack: () => void }) {
  const [flow, setFlow] = useState<Flow | null>(null);
  const [nodes, setNodes] = useState<FNode[]>([]);
  const [edges, setEdges] = useState<FEdge[]>([]);
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [enabled, setEnabled] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/admin/social-flows/${id}`, { cache: "no-store" });
      const d = await r.json();
      if (d.flow) {
        setFlow(d.flow); setNodes(d.flow.nodes || []); setEdges(d.flow.edges || []);
        setName(d.flow.name); setPlatform(d.flow.platform); setEnabled(d.flow.enabled);
      }
    })();
  }, [id]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/social-flows/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, platform, enabled, nodes, edges }),
      });
      if (r.ok) setSavedAt(Date.now());
    } finally { setSaving(false); }
  };

  const selectedNode = nodes.find((n) => n.id === selected) || null;
  const patchNode = (nodeId: string, data: Record<string, unknown>) =>
    setNodes((ns) => ns.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n)));
  const deleteNode = (nodeId: string) => {
    const n = nodes.find((x) => x.id === nodeId);
    if (n?.type === "trigger") return; // keep the entry trigger
    setNodes((ns) => ns.filter((x) => x.id !== nodeId));
    setEdges((es) => es.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelected(null);
  };

  if (!flow) {
    return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-2 w-2 animate-pulse rounded-none" style={{ background: T.primary }} /></div>;
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: T.canvas }}>
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5" style={{ borderColor: T.border, background: T.surface }}>
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={onBack} className="rounded-none border px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em]" style={{ borderColor: T.border, color: T.muted }}>← Flows</button>
          <input value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 max-w-[220px] flex-1 rounded-none border bg-transparent px-2.5 py-1.5 text-[13px] font-bold outline-none focus:border-[rgba(16,128,202,0.5)]" style={{ borderColor: T.border, color: T.text }} />
          <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)} className="rounded-none border bg-[#0A0A0A] px-2 py-1.5 font-mono text-[11px]" style={{ borderColor: T.border, color: T.text }}>
            {PLATFORMS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2.5">
          <button onClick={() => setEnabled((v) => !v)} className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: enabled ? T.ok : T.muted }}>
            <span className="relative inline-block h-4 w-7 rounded-full transition" style={{ background: enabled ? T.ok : "rgba(255,255,255,0.12)" }}>
              <span className="absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all" style={{ left: enabled ? "14px" : "2px" }} />
            </span>
            {enabled ? "Идэвхтэй" : "Идэвхгүй"}
          </button>
          {savedAt && !saving && <span className="font-mono text-[10px]" style={{ color: T.ok }}>✓ Хадгалсан</span>}
          <Btn size="sm" onClick={save} loading={saving}>Хадгалах</Btn>
        </div>
      </div>

      {/* Body: canvas + inspector */}
      <div className="relative flex min-h-0 flex-1">
        <FlowCanvas
          nodes={nodes} edges={edges} setNodes={setNodes} setEdges={setEdges}
          selected={selected} setSelected={setSelected}
        />
        <AnimatePresence>
          {selectedNode && (
            <Inspector
              key={selectedNode.id}
              node={selectedNode}
              onPatch={(d) => patchNode(selectedNode.id, d)}
              onDelete={() => deleteNode(selectedNode.id)}
              onClose={() => setSelected(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── The canvas ──────────────────────────────────────────────────────────────
function FlowCanvas({
  nodes, edges, setNodes, setEdges, selected, setSelected,
}: {
  nodes: FNode[]; edges: FEdge[];
  setNodes: React.Dispatch<React.SetStateAction<FNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<FEdge[]>>;
  selected: string | null; setSelected: (id: string | null) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [sizes, setSizes] = useState<Record<string, number>>({});
  const [pan, setPan] = useState({ x: 40, y: 20 });
  const [zoom, setZoom] = useState(1);
  const [linking, setLinking] = useState<{ source: string; handle: string; color: string } | null>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });

  // Drag/pan bookkeeping (refs so pointermove doesn't re-bind handlers).
  const drag = useRef<{ kind: "node" | "pan"; id?: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Measure node heights so edge anchors land on the real bottom edge.
  useLayoutEffect(() => {
    const next: Record<string, number> = {}; let changed = false;
    for (const n of nodes) {
      const el = nodeRefs.current[n.id];
      if (el) { const h = el.offsetHeight; next[n.id] = h; if (sizes[n.id] !== h) changed = true; }
    }
    if (changed) setSizes((s) => ({ ...s, ...next }));
  });

  const screenToCanvas = (cx: number, cy: number) => {
    const r = wrapRef.current?.getBoundingClientRect();
    return { x: ((cx - (r?.left || 0)) - pan.x) / zoom, y: ((cy - (r?.top || 0)) - pan.y) / zoom };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (linking) setCursor(screenToCanvas(e.clientX, e.clientY));
    const d = drag.current; if (!d) return;
    const dx = (e.clientX - d.startX) / zoom, dy = (e.clientY - d.startY) / zoom;
    if (d.kind === "pan") setPan({ x: d.origX + (e.clientX - d.startX), y: d.origY + (e.clientY - d.startY) });
    else if (d.id) setNodes((ns) => ns.map((n) => (n.id === d.id ? { ...n, x: d.origX + dx, y: d.origY + dy } : n)));
  };
  const endDrag = () => { drag.current = null; };

  const startPan = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (linking) { setLinking(null); return; }
    setSelected(null);
    drag.current = { kind: "pan", startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const startNodeDrag = (e: React.PointerEvent, n: FNode) => {
    e.stopPropagation();
    setSelected(n.id);
    if (linking) return;
    drag.current = { kind: "node", id: n.id, startX: e.clientX, startY: e.clientY, origX: n.x, origY: n.y };
  };

  // Connection: click output handle → arm; click a node → complete.
  const armLink = (e: React.PointerEvent, n: FNode, handle: string) => {
    e.stopPropagation();
    setLinking({ source: n.id, handle, color: NODE_META[n.type].color });
    setCursor(screenToCanvas(e.clientX, e.clientY));
  };
  const completeLink = (target: FNode) => {
    if (!linking) return;
    if (linking.source === target.id) { setLinking(null); return; }
    setEdges((es) => {
      // one outgoing edge per (source, handle) — replace if it exists
      const kept = es.filter((x) => !(x.source === linking.source && x.sourceHandle === linking.handle));
      return [...kept, { id: uid("e"), source: linking.source, sourceHandle: linking.handle, target: target.id }];
    });
    setLinking(null);
  };

  const addNode = (type: NodeType) => {
    const r = wrapRef.current?.getBoundingClientRect();
    const c = screenToCanvas((r?.left || 0) + (r?.width || 600) / 2, (r?.top || 0) + (r?.height || 400) / 2);
    const seed: Record<NodeType, Record<string, unknown>> = {
      trigger: { keywords: [], matchMode: "contains" },
      message: { text: "Сайн байна уу! 👋" },
      buttons: { text: "Сонголтоо хийнэ үү:", options: [{ id: uid("o"), label: "Тийм" }, { id: uid("o"), label: "Үгүй" }] },
      delay: { minutes: 60 },
      condition: { field: "tag", op: "has", value: "" },
      action: { kind: "tag", value: "" },
    };
    const n: FNode = { id: uid(type), type, x: c.x - NODE_W / 2, y: c.y - 30, data: seed[type] };
    setNodes((ns) => [...ns, n]);
    setSelected(n.id);
  };

  const anchorOut = (n: FNode, frac: number) => ({ x: n.x + NODE_W * frac, y: n.y + (sizes[n.id] || 92) });
  const anchorIn = (n: FNode) => ({ x: n.x + NODE_W / 2, y: n.y });

  return (
    <div className="relative min-w-0 flex-1 overflow-hidden">
      <style>{`@keyframes flowdash{to{stroke-dashoffset:-24}} .flowedge{animation:flowdash .55s linear infinite} @keyframes hpulse{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:1;transform:scale(1.25)}}`}</style>

      {/* Palette */}
      <div className="absolute left-3 top-3 z-20 flex flex-col gap-1.5 rounded-none border bg-[#0E0E12]/95 p-1.5 backdrop-blur" style={{ borderColor: T.border }}>
        {(Object.keys(NODE_META) as NodeType[]).filter((t) => t !== "trigger").map((t) => (
          <button key={t} onClick={() => addNode(t)} title={`${NODE_META[t].label} нэмэх`}
            className="group flex items-center gap-2 rounded-none px-2 py-1.5 text-left transition hover:bg-[rgba(255,255,255,0.05)]">
            <span className="flex h-6 w-6 items-center justify-center rounded-none" style={{ background: `${NODE_META[t].color}1a`, color: NODE_META[t].color }}>
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={NODE_META[t].icon} /></svg>
            </span>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: T.muted }}>{NODE_META[t].label}</span>
          </button>
        ))}
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1 rounded-none border bg-[#0E0E12]/95 p-1 font-mono text-[12px] backdrop-blur" style={{ borderColor: T.border, color: T.text }}>
        <button onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))} className="h-6 w-6">−</button>
        <span className="w-10 text-center text-[10px]" style={{ color: T.muted }}>{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))} className="h-6 w-6">+</button>
        <button onClick={() => { setZoom(1); setPan({ x: 40, y: 20 }); }} className="ml-1 h-6 px-1.5 text-[9px] uppercase" style={{ color: T.muted }}>reset</button>
      </div>

      {/* Hint */}
      {linking && (
        <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-none border bg-[#0E0E12]/95 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] backdrop-blur" style={{ borderColor: linking.color, color: linking.color }}>
          Холбох node дээр дар · зогсоох бол хоосон зай
        </div>
      )}

      {/* Canvas surface */}
      <div
        ref={wrapRef}
        onPointerDown={startPan}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
        style={{
          backgroundColor: T.canvas,
          backgroundImage: `radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)`,
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
          {/* Edges (behind nodes) */}
          <svg className="pointer-events-none absolute overflow-visible" style={{ left: 0, top: 0, width: 1, height: 1 }}>
            {edges.map((e) => {
              const s = nodes.find((n) => n.id === e.source); const t = nodes.find((n) => n.id === e.target);
              if (!s || !t) return null;
              const h = outHandles(s).find((x) => x.id === e.sourceHandle) || outHandles(s)[0];
              const a = anchorOut(s, h.frac); const b = anchorIn(t);
              const dy = Math.max(36, Math.abs(b.y - a.y) / 2);
              const color = NODE_META[s.type].color;
              return (
                <g key={e.id} className="pointer-events-auto">
                  <path d={`M${a.x},${a.y} C${a.x},${a.y + dy} ${b.x},${b.y - dy} ${b.x},${b.y}`} fill="none" stroke={color} strokeWidth={2} strokeDasharray="5 6" className="flowedge" style={{ filter: `drop-shadow(0 0 3px ${color}99)` }} />
                  <circle cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} r={7} fill={T.surface} stroke={color} strokeWidth={1} className="cursor-pointer" onClick={() => setEdges((es) => es.filter((x) => x.id !== e.id))} />
                  <path d={`M${(a.x + b.x) / 2 - 2.5},${(a.y + b.y) / 2 - 2.5} l5,5 M${(a.x + b.x) / 2 + 2.5},${(a.y + b.y) / 2 - 2.5} l-5,5`} stroke={color} strokeWidth={1.4} className="pointer-events-none" />
                </g>
              );
            })}
            {/* Live link preview */}
            {linking && (() => {
              const s = nodes.find((n) => n.id === linking.source); if (!s) return null;
              const h = outHandles(s).find((x) => x.id === linking.handle) || outHandles(s)[0];
              const a = anchorOut(s, h.frac);
              return <path d={`M${a.x},${a.y} C${a.x},${a.y + 40} ${cursor.x},${cursor.y - 40} ${cursor.x},${cursor.y}`} fill="none" stroke={linking.color} strokeWidth={2} strokeDasharray="4 5" className="flowedge" />;
            })()}
          </svg>

          {/* Nodes */}
          {nodes.map((n) => {
            const meta = NODE_META[n.type]; const isSel = selected === n.id; const outs = outHandles(n);
            return (
              <motion.div
                key={n.id}
                ref={(el) => { nodeRefs.current[n.id] = el; }}
                initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 26 }}
                onPointerDown={(e) => { if (linking) { completeLink(n); e.stopPropagation(); } else startNodeDrag(e, n); }}
                className="absolute select-none rounded-none border bg-[#0E0E12]"
                style={{ left: n.x, top: n.y, width: NODE_W, borderColor: isSel ? meta.color : T.border, boxShadow: isSel ? `0 0 0 1px ${meta.color}, 0 0 22px ${meta.color}44` : "0 6px 18px rgba(0,0,0,0.5)", cursor: linking ? "pointer" : "grab" }}
              >
                {/* input handle */}
                {n.type !== "trigger" && (
                  <span className="absolute left-1/2 top-0 z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2" style={{ background: T.canvas, borderColor: T.borderHi }} />
                )}
                {/* header */}
                <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: T.border }}>
                  <span className="flex h-6 w-6 items-center justify-center rounded-none" style={{ background: `${meta.color}1a`, color: meta.color }}>
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={meta.icon} /></svg>
                  </span>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: meta.color }}>{meta.label}</span>
                  {n.type === "trigger" && <span className="ml-auto font-mono text-[8px] uppercase tracking-[0.16em]" style={{ color: T.faint }}>эхлэл</span>}
                </div>
                {/* body preview */}
                <div className="px-3 py-2.5 text-[12px] leading-snug" style={{ color: T.text }}>
                  <NodeBody node={n} />
                </div>
                {/* output handles */}
                {outs.map((o) => (
                  <span key={o.id} className="group absolute z-10 -translate-x-1/2 translate-y-1/2" style={{ left: `${o.frac * 100}%`, bottom: 0 }}>
                    <button
                      onPointerDown={(e) => armLink(e, n, o.id)}
                      className="block h-3.5 w-3.5 rounded-full border-2 transition hover:scale-125"
                      style={{ background: linking?.source === n.id && linking.handle === o.id ? meta.color : T.canvas, borderColor: meta.color, boxShadow: `0 0 6px ${meta.color}88`, animation: linking ? "none" : undefined }}
                      aria-label="Гарц"
                    />
                    {o.label && <span className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap font-mono text-[8px] uppercase tracking-[0.1em]" style={{ color: meta.color }}>{o.label}</span>}
                  </span>
                ))}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Compact preview of a node's payload, shown inside the card.
function NodeBody({ node }: { node: FNode }) {
  const d = node.data;
  if (node.type === "trigger") {
    const kws = (d.keywords as string[]) || [];
    return kws.length ? <span>Түлхүүр үг: <b style={{ color: "#22D3EE" }}>{kws.join(", ")}</b></span>
      : <span style={{ color: T.faint }}>Түлхүүр үг тохируулаагүй — дурын DM</span>;
  }
  if (node.type === "message") return <span className="line-clamp-3" style={{ color: T.muted }}>{(d.text as string) || "Хоосон мессеж"}</span>;
  if (node.type === "buttons") {
    const opts = (d.options as { id: string; label: string }[]) || [];
    return (
      <div>
        <div className="line-clamp-2" style={{ color: T.muted }}>{(d.text as string) || "…"}</div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {opts.map((o) => <span key={o.id} className="rounded-none border px-1.5 py-0.5 text-[10px]" style={{ borderColor: "rgba(168,85,247,0.5)", color: "#C084FC" }}>{o.label || "—"}</span>)}
        </div>
      </div>
    );
  }
  if (node.type === "delay") { const m = Number(d.minutes) || 0; const label = m >= 1440 ? `${Math.round(m / 1440)} өдөр` : m >= 60 ? `${Math.round(m / 60)} цаг` : `${m} мин`; return <span style={{ color: T.muted }}>Хүлээх: <b style={{ color: "#FBBF24" }}>{label}</b></span>; }
  if (node.type === "condition") return <span style={{ color: T.muted }}>Хэрэв <b style={{ color: "#4E94D0" }}>{(d.field as string) || "tag"}</b> {(d.op as string) || "has"} <b style={{ color: "#4E94D0" }}>{(d.value as string) || "…"}</b></span>;
  const A: Record<string, string> = { tag: "Таг өгөх", subscribe: "Захиалуулах", unsubscribe: "Захиалга цуцлах", notify: "Мэдэгдэл" };
  return <span style={{ color: T.muted }}>{A[String(d.kind)] || "Үйлдэл"}: <b style={{ color: "#4ADE80" }}>{(d.value as string) || "—"}</b></span>;
}

// ── Right inspector — edits the selected node's payload ─────────────────────
const inp = "w-full rounded-none border bg-[#0A0A0A] px-2.5 py-2 text-[12px] outline-none focus:border-[rgba(16,128,202,0.5)]";
function Inspector({ node, onPatch, onDelete, onClose }: {
  node: FNode; onPatch: (d: Record<string, unknown>) => void; onDelete: () => void; onClose: () => void;
}) {
  const meta = NODE_META[node.type]; const d = node.data;
  const opts = (d.options as { id: string; label: string }[]) || [];
  return (
    <motion.div initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 30, opacity: 0 }} transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="absolute right-0 top-0 z-30 flex h-full w-[300px] flex-col border-l bg-[#0E0E12]" style={{ borderColor: T.border }}>
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: T.border }}>
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-none" style={{ background: `${meta.color}1a`, color: meta.color }}>
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={meta.icon} /></svg>
          </span>
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: meta.color }}>{meta.label}</span>
        </div>
        <button onClick={onClose} style={{ color: T.muted }} aria-label="Хаах"><svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" /></svg></button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {node.type === "trigger" && (
          <>
            <Field label="Түлхүүр үгс (таслалаар)">
              <input className={inp} style={{ borderColor: T.border, color: T.text }} defaultValue={((d.keywords as string[]) || []).join(", ")}
                onChange={(e) => onPatch({ keywords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="үнэ, захиалга, сайн уу" />
            </Field>
            <Field label="Тохирол">
              <select className={inp} style={{ borderColor: T.border, color: T.text }} value={(d.matchMode as string) || "contains"} onChange={(e) => onPatch({ matchMode: e.target.value })}>
                <option value="contains">Агуулсан</option><option value="exact">Яг тэнцүү</option><option value="starts_with">Эхэлсэн</option><option value="any">Дурын мессеж</option>
              </select>
            </Field>
          </>
        )}
        {node.type === "message" && (
          <>
            <Field label="Текст"><textarea className={inp + " min-h-[120px] resize-y"} style={{ borderColor: T.border, color: T.text }} value={(d.text as string) || ""} onChange={(e) => onPatch({ text: e.target.value })} placeholder="Мессежээ бичнэ үү…" /></Field>
            <Field label="Зураг URL (заавал биш)"><input className={inp} style={{ borderColor: T.border, color: T.text }} value={(d.imageUrl as string) || ""} onChange={(e) => onPatch({ imageUrl: e.target.value })} placeholder="https://…" /></Field>
          </>
        )}
        {node.type === "buttons" && (
          <>
            <Field label="Текст"><textarea className={inp + " min-h-[70px] resize-y"} style={{ borderColor: T.border, color: T.text }} value={(d.text as string) || ""} onChange={(e) => onPatch({ text: e.target.value })} /></Field>
            <Field label="Товчнууд (гарц бүр = салаа)">
              <div className="space-y-1.5">
                {opts.map((o, i) => (
                  <div key={o.id} className="flex items-center gap-1.5">
                    <input className={inp} style={{ borderColor: T.border, color: T.text }} value={o.label} onChange={(e) => onPatch({ options: opts.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} />
                    <button onClick={() => onPatch({ options: opts.filter((_, j) => j !== i) })} className="shrink-0 px-1.5" style={{ color: T.muted }}>✕</button>
                  </div>
                ))}
                <button onClick={() => onPatch({ options: [...opts, { id: uid("o"), label: "Товч" }] })} className="w-full rounded-none border border-dashed py-1.5 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ borderColor: T.border, color: "#C084FC" }}>+ Товч нэмэх</button>
              </div>
            </Field>
          </>
        )}
        {node.type === "delay" && (
          <Field label="Хүлээх хугацаа (минут)">
            <input type="number" className={inp} style={{ borderColor: T.border, color: T.text }} value={Number(d.minutes) || 0} onChange={(e) => onPatch({ minutes: Number(e.target.value) || 0 })} />
            <div className="mt-2 flex gap-1.5">
              {[[5, "5 мин"], [60, "1 цаг"], [1440, "1 өдөр"]].map(([m, l]) => (
                <button key={m} onClick={() => onPatch({ minutes: m })} className="rounded-none border px-2 py-1 font-mono text-[10px]" style={{ borderColor: T.border, color: T.muted }}>{l}</button>
              ))}
            </div>
          </Field>
        )}
        {node.type === "condition" && (
          <>
            <Field label="Талбар"><input className={inp} style={{ borderColor: T.border, color: T.text }} value={(d.field as string) || ""} onChange={(e) => onPatch({ field: e.target.value })} placeholder="tag / subscribed / …" /></Field>
            <Field label="Оператор">
              <select className={inp} style={{ borderColor: T.border, color: T.text }} value={(d.op as string) || "has"} onChange={(e) => onPatch({ op: e.target.value })}>
                <option value="has">Агуулсан</option><option value="not">Агуулаагүй</option><option value="eq">Тэнцүү</option>
              </select>
            </Field>
            <Field label="Утга"><input className={inp} style={{ borderColor: T.border, color: T.text }} value={(d.value as string) || ""} onChange={(e) => onPatch({ value: e.target.value })} /></Field>
            <p className="text-[10px]" style={{ color: T.faint }}>Тийм / Үгүй гарцаас салаа зурна.</p>
          </>
        )}
        {node.type === "action" && (
          <>
            <Field label="Үйлдэл">
              <select className={inp} style={{ borderColor: T.border, color: T.text }} value={(d.kind as string) || "tag"} onChange={(e) => onPatch({ kind: e.target.value })}>
                <option value="tag">Таг өгөх</option><option value="subscribe">Захиалуулах</option><option value="unsubscribe">Захиалга цуцлах</option><option value="notify">Админд мэдэгдэх</option>
              </select>
            </Field>
            <Field label="Утга"><input className={inp} style={{ borderColor: T.border, color: T.text }} value={(d.value as string) || ""} onChange={(e) => onPatch({ value: e.target.value })} placeholder="tag нэр / тэмдэглэл" /></Field>
          </>
        )}
      </div>

      {node.type !== "trigger" && (
        <div className="border-t p-3" style={{ borderColor: T.border }}>
          <button onClick={onDelete} className="w-full rounded-none border py-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] transition hover:bg-[rgba(16,128,202,0.08)]" style={{ borderColor: "rgba(16,128,202,0.35)", color: T.primary }}>Node устгах</button>
        </div>
      )}
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: T.faint }}>{label}</span>
      {children}
    </label>
  );
}
