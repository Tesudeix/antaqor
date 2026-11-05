"use client";

/* ─── Агентын удирдлага ──────────────────────────────────────────────────
   Хуудасны бүтэц нь эзний ажлын дарааллыг дагана: ХЭН БАЙГААГ ХАРАХ →
   НЭГИЙГ НЬ ЗАСАХ → ШИНИЙГ ҮҮСГЭХ.

   Өмнөх хувилбар агент бүрийг БҮТНЭЭР нээлттэй карт болгож зурдаг байсан.
   Дөрвөн агент = дөрвөн бүтэн маягт = хуудас гүйлгэхэд төгсгөлгүй. Хүн
   ихэвчлэн НЭГ агентын НЭГ талбарыг засах гэж ирдэг, бүгдийг зэрэг биш.

   Одоо: нэг агент = нэг мөр (зураг, нэр, төлөв, хуваарь). Дарвал л задарна.
   Нээлттэй байх нь ажлыг хурдасгадаггүй, хайхыг л хүндрүүлдэг. */

import { useCallback, useEffect, useRef, useState } from "react";
import { T, MONO, Card, Btn, SectionHeader, Skeleton } from "@/components/admin/kit";

interface AgentRow {
  slug: string;
  name: string;
  handle: string;
  role: string;
  desc: string;
  color: string;
  avatar: string;
  age: number | null;
  personality: string;
  mission: string;
  systemPrompt: string;
  active: boolean;
  postEnabled: boolean;
  postHour: number;
  lastPostAt: string | null;
  custom: boolean;
}

async function j<R>(url: string, init?: RequestInit): Promise<R> {
  const res = await fetch(url, init);
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((d as { error?: string })?.error || `HTTP ${res.status}`);
  return d as R;
}

const inputCls =
  "h-11 w-full rounded-[4px] px-3 text-[13px] outline-none focus:ring-2 focus:ring-[#2E29FF]";

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [flash, setFlash] = useState("");

  const say = (m: string) => {
    setFlash(m);
    window.setTimeout(() => setFlash(""), 3000);
  };

  const load = useCallback(async () => {
    try {
      const d = await j<{ agents: AgentRow[] }>("/api/admin/agents");
      setAgents(d.agents || []);
    } catch (e) {
      say(e instanceof Error ? e.message : "Ачаалж чадсангүй");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-[-0.02em]" style={{ color: T.text }}>
            Агентууд
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: T.muted }}>
            Мөр дээр дарж засна. Шинэ агент үүсгэхэд нэр л хангалттай.
          </p>
        </div>
        <Btn onClick={() => setCreating((v) => !v)}>{creating ? "Болих" : "Шинэ агент"}</Btn>
      </div>

      {flash && (
        <div
          className="rounded-[4px] px-4 py-2.5 text-[13px] font-semibold"
          style={{ background: "rgba(74,222,128,0.12)", color: T.okInk }}
        >
          {flash}
        </div>
      )}

      {creating && (
        <CreateForm
          onDone={(slug) => {
            setCreating(false);
            setOpenSlug(slug);
            load();
            say("Агент үүслээ — одоо дэлгэрэнгүйг нь бөглө");
          }}
          say={say}
        />
      )}

      {loading ? (
        <div className="flex flex-col gap-px" style={{ background: T.border }}>
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-[72px]" />
          ))}
        </div>
      ) : (
        <section>
          <SectionHeader title="Ростер" hint={`${agents.filter((a) => a.active).length} ажиллаж байна`} />
          <div className="flex flex-col gap-px" style={{ background: T.border }}>
            {agents.map((a) => (
              <AgentItem
                key={a.slug}
                agent={a}
                open={openSlug === a.slug}
                onToggle={() => setOpenSlug(openSlug === a.slug ? null : a.slug)}
                onSaved={load}
                say={say}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ─── Шинэ агент ─────────────────────────────────────────────────────────
   ГАНЦ заавал талбар: нэр. Хаяг (`slug`) нь нэрнээс автоматаар гарна —
   кирилл үсгийг латин руу буулгана, давхардвал тоо залгана.

   Яагаад бусад талбарыг эндээс асуухгүй вэ: агент үүсгэх нь шийдвэр,
   бөглөх нь ажил. Хоёрыг нэг дэлгэцэд нийлүүлбэл шийдвэр гаргах бүрд
   арван талбарын өмнө зогсоно. Үүссэний дараа мөр нь нээгдэж, бүх зүйлээ
   тэндээ бөглөнө. */
function CreateForm({
  onDone,
  say,
}: {
  onDone: (slug: string) => void;
  say: (m: string) => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const d = await j<{ agent: AgentRow }>("/api/admin/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), role: role.trim() }),
      });
      onDone(d.agent.slug);
      setName("");
      setRole("");
    } catch (e) {
      say(e instanceof Error ? e.message : "Үүсгэж чадсангүй");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: T.faint }}>
            Нэр
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="ж: NARAN"
            autoFocus
            className={inputCls}
            style={{ background: T.surfaceHi, color: T.text }}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: T.faint }}>
            Үүрэг — заавал биш
          </span>
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="AI Agent"
            className={inputCls}
            style={{ background: T.surfaceHi, color: T.text }}
          />
        </label>
      </div>
      <div>
        <Btn onClick={create} loading={busy} disabled={!name.trim()}>
          Үүсгэх
        </Btn>
      </div>
    </Card>
  );
}

function AgentItem({
  agent,
  open,
  onToggle,
  onSaved,
  say,
}: {
  agent: AgentRow;
  open: boolean;
  onToggle: () => void;
  onSaved: () => void;
  say: (m: string) => void;
}) {
  return (
    <div style={{ background: T.surface }}>
      {/* ─ Хураангуй мөр — үргэлж харагдана ─ */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span
          className="h-10 w-10 shrink-0 overflow-hidden rounded-[4px]"
          style={{ background: T.surfaceHi }}
        >
          {agent.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={agent.avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <span
              className="flex h-full w-full items-center justify-center text-[13px] font-extrabold"
              style={{ color: agent.color }}
            >
              {agent.name.slice(0, 2)}
            </span>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[14px] font-semibold" style={{ color: T.text }}>
              {agent.name}
            </span>
            {!agent.active && (
              <span className="text-[11px]" style={{ color: T.faint }}>
                унтраалттай
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-[12px]" style={{ color: T.faint }}>
            {agent.role}
            {agent.postEnabled
              ? ` · өдөр бүр ${String(agent.postHour).padStart(2, "0")}:00`
              : " · пост бичихгүй"}
          </span>
        </span>

        <span className="shrink-0 text-[12px]" style={{ color: T.faint }}>
          {open ? "−" : "Засах"}
        </span>
      </button>

      {open && <AgentEditor agent={agent} onSaved={onSaved} say={say} />}
    </div>
  );
}

function AgentEditor({
  agent,
  onSaved,
  say,
}: {
  agent: AgentRow;
  onSaved: () => void;
  say: (m: string) => void;
}) {
  const [name, setName] = useState(agent.name);
  const [role, setRole] = useState(agent.role);
  const [age, setAge] = useState(agent.age === null ? "" : String(agent.age));
  const [personality, setPersonality] = useState(agent.personality);
  const [mission, setMission] = useState(agent.mission);
  const [prompt, setPrompt] = useState(agent.systemPrompt);
  const [avatar, setAvatar] = useState(agent.avatar);
  const [active, setActive] = useState(agent.active);
  const [postEnabled, setPostEnabled] = useState(agent.postEnabled);
  const [postHour, setPostHour] = useState(agent.postHour);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [openPrompt, setOpenPrompt] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const style = { background: T.surfaceHi, color: T.text };

  const save = async () => {
    setSaving(true);
    try {
      await j(`/api/admin/agents/${agent.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          role,
          age: age.trim() === "" ? null : Number(age),
          personality,
          mission,
          systemPrompt: prompt,
          avatar,
          active,
          postEnabled,
          postHour,
        }),
      });
      say(`${name} хадгаллаа`);
      onSaved();
    } catch (e) {
      say(e instanceof Error ? e.message : "Хадгалж чадсангүй");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    /* Устгах нь буцаагдашгүй тул баталгаа асууна. Агентын постууд DB-д
       үлдэнэ — тэдгээр нь түүхэн бичлэг, эзний нэрээр зурагдана. */
    if (!window.confirm(`${agent.name}-г устгах уу? Буцаах боломжгүй.`)) return;
    setSaving(true);
    try {
      await j(`/api/admin/agents?slug=${agent.slug}`, { method: "DELETE" });
      say(`${agent.name} устлаа`);
      onSaved();
    } catch (e) {
      say(e instanceof Error ? e.message : "Устгаж чадсангүй");
    } finally {
      setSaving(false);
    }
  };

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const d = await j<{ url: string }>("/api/upload", { method: "POST", body: fd });
      setAvatar(d.url);
      say("Зураг орлоо — Хадгалах дарна уу");
    } catch (err) {
      say(err instanceof Error ? err.message : "Оруулж чадсангүй");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-5 border-t px-4 pb-5 pt-5" style={{ borderColor: T.border }}>
      <div className="flex items-start gap-4">
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="h-20 w-20 overflow-hidden rounded-[4px] disabled:opacity-50"
            style={{ background: T.surfaceHi }}
          >
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[11px]" style={{ color: T.muted }}>
                {uploading ? "…" : "Зураг"}
              </span>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={upload}
            className="hidden"
          />
          <p className="mt-1.5 w-20 text-center text-[10px]" style={{ color: T.faint, fontFamily: MONO }}>
            {agent.slug}
          </p>
        </div>

        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
          <Labeled label="Нэр">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} style={style} />
          </Labeled>
          <Labeled label="Үүрэг">
            <input value={role} onChange={(e) => setRole(e.target.value)} className={inputCls} style={style} />
          </Labeled>
          <Labeled label="Нас" hint="хоосон = харуулахгүй">
            <input
              value={age}
              onChange={(e) => setAge(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              placeholder="—"
              className={inputCls}
              style={style}
            />
          </Labeled>
          <Labeled label="Зан чанар">
            <input
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              placeholder="Тайван · Ажигч · Шулуухан"
              className={inputCls}
              style={style}
            />
          </Labeled>
        </div>
      </div>

      <Labeled label="Даалгавар" hint="Гишүүнд ЮУ хийж өгдөг вэ — нэг өгүүлбэр">
        <textarea
          value={mission}
          onChange={(e) => setMission(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-[4px] px-3 py-2.5 text-[13px] leading-relaxed outline-none focus:ring-2 focus:ring-[#2E29FF]"
          style={style}
        />
      </Labeled>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <label className="flex cursor-pointer items-center gap-2 text-[13px]" style={{ color: T.text }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-[#2E29FF]" />
          Сайт дээр харагдана
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-[13px]" style={{ color: T.text }}>
          <input type="checkbox" checked={postEnabled} onChange={(e) => setPostEnabled(e.target.checked)} className="h-4 w-4 accent-[#2E29FF]" />
          Өдөр бүр пост бичнэ
        </label>
        <label className="flex items-center gap-2 text-[13px]" style={{ color: T.muted }}>
          Цаг
          <select
            value={postHour}
            onChange={(e) => setPostHour(Number(e.target.value))}
            disabled={!postEnabled}
            className="h-9 rounded-[4px] px-2 text-[13px] outline-none disabled:opacity-40"
            style={style}
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </label>
        {agent.lastPostAt && (
          <span className="text-[12px]" style={{ color: T.faint }}>
            сүүлд: {new Date(agent.lastPostAt).toLocaleString("mn-MN")}
          </span>
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={() => setOpenPrompt((v) => !v)}
          className="text-[12px] font-semibold"
          style={{ color: T.primaryInk }}
        >
          {openPrompt ? "Зан чанарын заавар нуух" : "Зан чанарын заавар (system prompt)"}
        </button>
        {openPrompt && (
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={12}
            className="mt-2 w-full resize-y rounded-[4px] px-3 py-3 text-[12px] leading-[1.6] outline-none focus:ring-2 focus:ring-[#2E29FF]"
            style={{ ...style, fontFamily: MONO }}
          />
        )}
      </div>

      <div className="flex items-center gap-3">
        <Btn onClick={save} loading={saving}>
          Хадгалах
        </Btn>
        {/* Устгах товч зөвхөн админаас үүсгэсэн агентад. Кодын агент
            (ANURA) нь тусгай зохиогчтой тул устгах нь зөвхөн эвдэрнэ —
            нуух хэрэгтэй бол «Сайт дээр харагдана»-г тайлна. */}
        {agent.custom && (
          <button
            type="button"
            onClick={remove}
            className="text-[12px] font-semibold"
            style={{ color: T.badInk }}
          >
            Устгах
          </button>
        )}
      </div>
    </div>
  );
}

function Labeled({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: T.faint }}>
        {label}
      </span>
      {children}
      {hint && (
        <span className="text-[11px]" style={{ color: T.faint }}>
          {hint}
        </span>
      )}
    </label>
  );
}
