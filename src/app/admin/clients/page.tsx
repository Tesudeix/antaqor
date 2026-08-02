"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";

interface Client {
  _id: string;
  name: string;
  logo: string;
  description: string;
  url: string;
  order: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DraftClient {
  name: string;
  logo: string;
  description: string;
  url: string;
  order: number;
  active: boolean;
}

const EMPTY_DRAFT: DraftClient = { name: "", logo: "", description: "", url: "", order: 0, active: true };

export default function AdminClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftClient>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Admin should see inactive too — there's no such filter in the GET API
      // (it returns active only). So we hit it but treat the result as the
      // visible/admin-managed set; future: add ?all=1 for admin.
      const res = await fetch("/api/clients", { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data.clients)) setClients(data.clients);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const startNew = () => {
    setEditingId("new");
    setDraft({ ...EMPTY_DRAFT, order: clients.length });
    setErr("");
  };

  const startEdit = (c: Client) => {
    setEditingId(c._id);
    setDraft({
      name: c.name,
      logo: c.logo,
      description: c.description,
      url: c.url,
      order: c.order,
      active: c.active,
    });
    setErr("");
  };

  const cancel = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setErr("");
  };

  const save = async () => {
    if (!draft.name.trim()) { setErr("Нэр шаардлагатай"); return; }
    setSaving(true);
    setErr("");
    try {
      const isNew = editingId === "new";
      const url = isNew ? "/api/clients" : `/api/clients/${editingId}`;
      const method = isNew ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Хадгалж чадсангүй");
        return;
      }
      cancel();
      fetchAll();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Client) => {
    if (!confirm(`"${c.name}" устгах уу?`)) return;
    await fetch(`/api/clients/${c._id}`, { method: "DELETE" });
    fetchAll();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-12 pt-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.30em] text-[#1080CA]">ANTAQOR / ADMIN</p>
          <h1 className="mt-1 text-[24px] font-black text-[#E8E8E8]">
            Хамтрагч брэндүүд<span className="text-[#1080CA]">.</span>
          </h1>
          <p className="mt-1 text-[12px] text-[#8A8A92]">{clients.length} брэнд · нийтэд харагдана</p>
        </div>
        <Link
          href="/admin"
          className="rounded-none border border-[rgba(255,255,255,0.08)] bg-[#0E0E12] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#8A8A92] transition hover:text-[#E8E8E8]"
        >
          ← Админ
        </Link>
      </div>

      {/* New client trigger */}
      {editingId !== "new" && (
        <button
          type="button"
          onClick={startNew}
          className="mb-4 inline-flex items-center gap-1.5 rounded-none bg-[#1080CA] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#0E0E10] transition hover:shadow-[0_0_18px_rgba(16,128,202,0.4)]"
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Шинэ брэнд
        </button>
      )}

      {/* Form (new or edit) */}
      {editingId !== null && (
        <ClientForm
          draft={draft}
          setDraft={setDraft}
          saving={saving}
          err={err}
          onCancel={cancel}
          onSave={save}
        />
      )}

      {/* List */}
      {loading ? (
        <div className="py-10 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-[#8A8A92]">Ачааллаж байна…</div>
      ) : clients.length === 0 ? (
        <div className="rounded-none border-2 border-dashed border-[rgba(255,255,255,0.08)] p-10 text-center">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-[#8A8A92]">ХООСОН</p>
          <p className="mt-2 text-[12px] text-[#8A8A92]">Эхний брэндээ нэмэх товчоо дарна уу</p>
        </div>
      ) : (
        <div className="space-y-2">
          {clients.map((c) => (
            <div
              key={c._id}
              className={`flex items-center gap-3 rounded-none border bg-[#0E0E12] p-3 transition ${
                editingId === c._id ? "border-[rgba(16,128,202,0.5)]" : "border-[rgba(255,255,255,0.06)] hover:border-[rgba(16,128,202,0.3)]"
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-none bg-[#0A0A0A]">
                {c.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.logo} alt={c.name} className="h-full w-full object-contain" />
                ) : (
                  <span className="font-mono text-[12px] font-black text-[#8A8A92]">
                    {c.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-bold text-[#E8E8E8]">{c.name}</span>
                  {!c.active && <span className="rounded bg-[rgba(16,128,202,0.1)] px-1.5 py-0.5 text-[9px] font-bold text-[#1080CA]">DISABLED</span>}
                  <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#56565E]">#{c.order}</span>
                </div>
                {c.description && <p className="line-clamp-1 text-[11px] text-[#8A8A92]">{c.description}</p>}
                {c.url && <p className="line-clamp-1 text-[10px] text-[#8A8A92]">{c.url}</p>}
              </div>
              <button
                type="button"
                onClick={() => startEdit(c)}
                className="rounded-none border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-[#8A8A92] transition hover:text-[#1080CA]"
              >
                Засах
              </button>
              <button
                type="button"
                onClick={() => remove(c)}
                className="rounded-none p-1.5 text-[#8A8A92] transition hover:bg-[rgba(16,128,202,0.1)] hover:text-[#1080CA]"
                aria-label="Устгах"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9M19.228 5.79L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79M7.5 5.79h9" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ClientForm({
  draft, setDraft, saving, err, onCancel, onSave,
}: {
  draft: DraftClient;
  setDraft: (d: DraftClient) => void;
  saving: boolean;
  err: string;
  onCancel: () => void;
  onSave: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.url) setDraft({ ...draft, logo: data.url });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="mb-4 rounded-none border border-[rgba(16,128,202,0.3)] bg-[#0E0E10] p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[120px_1fr]">
        {/* Logo */}
        <div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-none border-2 border-dashed border-[rgba(255,255,255,0.1)] bg-[#0A0A0A] transition hover:border-[rgba(16,128,202,0.4)] disabled:opacity-50"
          >
            {draft.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.logo} alt="" className="h-full w-full object-contain" />
            ) : (
              <span className="font-mono text-[10px] font-bold text-[#8A8A92]">+ ЛОГО</span>
            )}
            {uploading && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/60">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#1080CA]" />
              </span>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={upload} className="hidden" />
        </div>

        <div className="space-y-2">
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Брэндийн нэр"
            autoFocus
            className="w-full rounded-none border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2 text-[13px] text-[#E8E8E8] placeholder-[#56565E] outline-none focus:border-[rgba(16,128,202,0.4)]"
          />
          <input
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="Тайлбар (≤200)"
            maxLength={200}
            className="w-full rounded-none border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2 text-[12px] text-[#8A8A92] placeholder-[#56565E] outline-none focus:border-[rgba(16,128,202,0.4)]"
          />
          <input
            value={draft.url}
            onChange={(e) => setDraft({ ...draft, url: e.target.value })}
            placeholder="https://..."
            type="url"
            className="w-full rounded-none border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2 text-[12px] text-[#8A8A92] placeholder-[#56565E] outline-none focus:border-[rgba(16,128,202,0.4)]"
          />
          <div className="flex items-center gap-3 text-[11px] text-[#8A8A92]">
            <label className="flex items-center gap-1.5">
              <span>Дараалал</span>
              <input
                type="number"
                value={draft.order}
                onChange={(e) => setDraft({ ...draft, order: Number(e.target.value) || 0 })}
                className="w-16 rounded-none border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-2 py-1 text-center text-[12px] text-[#E8E8E8] outline-none focus:border-[rgba(16,128,202,0.4)]"
              />
            </label>
            <label className="ml-2 flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                className="h-3.5 w-3.5 accent-[#1080CA]"
              />
              <span>Идэвхтэй</span>
            </label>
          </div>
        </div>
      </div>

      {err && <p className="mt-3 text-[11px] text-[#1080CA]">{err}</p>}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button onClick={onCancel} className="text-[11px] font-bold text-[#8A8A92] transition hover:text-[#E8E8E8]">
          Болих
        </button>
        <button
          onClick={onSave}
          disabled={saving || !draft.name.trim()}
          className="rounded-none bg-[#1080CA] px-4 py-2 text-[11px] font-black uppercase tracking-wider text-[#0E0E10] disabled:opacity-40"
        >
          {saving ? "Хадгалж байна..." : "Хадгалах"}
        </button>
      </div>
    </div>
  );
}
