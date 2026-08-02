"use client";

import { useEffect, useRef, useState } from "react";

interface Agent {
  _id: string;
  slug: string;
  name: string;
  description: string;
  avatar: string;
  cover: string;
  href: string;
  order: number;
}

const NEON = "#1080CA";

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    fetch("/api/agents")
      .then((r) => r.json())
      .then((d) => setAgents(d.agents || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  return (
    <div className="mx-auto max-w-[900px] pb-16">
      <div className="mb-6">
        <span className="rounded-full bg-[rgba(16,128,202,0.12)] px-2 py-0.5 text-[9px] font-black tracking-[0.18em]" style={{ color: NEON }}>
          ADMIN · AGENTS
        </span>
        <h1 className="mt-2 text-[24px] font-black text-white sm:text-[28px]">AI Агент удирдах</h1>
        <p className="mt-1 text-[12px] text-[#8A8A92]">Avatar, cover, нэр, тайлбар, холбоосыг өөрчилнө</p>
      </div>

      {loading ? (
        <p className="text-[12px] text-[#8A8A92]">Татаж байна…</p>
      ) : (
        <div className="space-y-4">
          {agents.map((a) => (
            <AgentEditor key={a._id} agent={a} onSaved={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function AgentEditor({ agent, onSaved }: { agent: Agent; onSaved: () => void }) {
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description);
  const [href, setHref] = useState(agent.href);
  const [avatar, setAvatar] = useState(agent.avatar);
  const [cover, setCover] = useState(agent.cover);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err" | ""; text: string }>({ tone: "", text: "" });
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File): Promise<string | null> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const d = await res.json();
    return d.url || null;
  };

  const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true); setMsg({ tone: "", text: "" });
    try {
      const url = await upload(f);
      if (url) setAvatar(url);
      else setMsg({ tone: "err", text: "Upload амжилтгүй" });
    } finally {
      setBusy(false);
      if (avatarRef.current) avatarRef.current.value = "";
    }
  };

  const onPickCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true); setMsg({ tone: "", text: "" });
    try {
      const url = await upload(f);
      if (url) setCover(url);
      else setMsg({ tone: "err", text: "Upload амжилтгүй" });
    } finally {
      setBusy(false);
      if (coverRef.current) coverRef.current.value = "";
    }
  };

  const save = async () => {
    setBusy(true); setMsg({ tone: "", text: "" });
    try {
      const res = await fetch(`/api/admin/agents/${agent.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, avatar, cover, href }),
      });
      const d = await res.json();
      if (res.ok) {
        setMsg({ tone: "ok", text: "Хадгалсан" });
        onSaved();
      } else {
        setMsg({ tone: "err", text: d.error || "Алдаа" });
      }
    } catch {
      setMsg({ tone: "err", text: "Сүлжээ алдаа" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-none border border-[rgba(255,255,255,0.08)] bg-[#0E0E12] p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="rounded-none bg-[rgba(16,128,202,0.1)] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider" style={{ color: NEON }}>
          {agent.slug}
        </span>
      </div>

      {/* Image uploaders */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A8A92]">Avatar</span>
            <span className="text-[9px] text-[#56565E]">1:1 · профайл</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-none border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A]">
              {avatar && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <button
              type="button"
              onClick={() => avatarRef.current?.click()}
              disabled={busy}
              className="rounded-none border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2 text-[11px] font-bold text-[#8A8A92] transition hover:border-[rgba(16,128,202,0.4)] disabled:opacity-50"
            >
              Сонгох
            </button>
            <input ref={avatarRef} type="file" accept="image/*" onChange={onPickAvatar} className="hidden" />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A8A92]">Cover</span>
            <span className="text-[9px] text-[#56565E]">16:9 · backdrop</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-none border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A]">
              {cover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <button
              type="button"
              onClick={() => coverRef.current?.click()}
              disabled={busy}
              className="rounded-none border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2 text-[11px] font-bold text-[#8A8A92] transition hover:border-[rgba(16,128,202,0.4)] disabled:opacity-50"
            >
              Сонгох
            </button>
            <input ref={coverRef} type="file" accept="image/*" onChange={onPickCover} className="hidden" />
          </div>
        </div>
      </div>

      {/* Text fields */}
      <div className="mt-4 grid gap-3">
        <Field label="Нэр" value={name} onChange={setName} />
        <Field label="Холбоос" value={href} onChange={setHref} placeholder="/companion" />
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#8A8A92]">Тайлбар</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-none border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2 text-[13px] text-[#E8E8E8] outline-none transition focus:border-[rgba(16,128,202,0.4)]"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-none bg-[#1080CA] px-4 py-2 text-[12px] font-black text-[#0E0E10] transition hover:bg-[#4FA8E8] disabled:opacity-50"
        >
          {busy ? "..." : "Хадгалах"}
        </button>
        {msg.text && (
          <span
            className="text-[11px] font-bold"
            style={{ color: msg.tone === "ok" ? NEON : msg.tone === "err" ? "#1080CA" : "#5b6573" }}
          >
            {msg.tone === "ok" ? "✓ " : ""}
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#8A8A92]">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-none border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2 text-[13px] text-[#E8E8E8] placeholder-[#56565E] outline-none transition focus:border-[rgba(16,128,202,0.4)]"
      />
    </label>
  );
}
