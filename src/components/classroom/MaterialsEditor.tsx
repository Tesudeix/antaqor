"use client";
import { useRef, useState } from "react";
import { Btn, T } from "@/components/admin/kit";

/* Хичээлд хавсаргах материалын засварлагч: файл (/api/classroom/upload-material)
   эсвэл линк. Утга нь lesson.attachments-тай шууд тэнцүү; хадгалалтыг
   хичээлийн "Хадгалах" товч хийнэ. */
export type MaterialItem = { url: string; name: string; size?: number; kind?: "file" | "link" };

const input: React.CSSProperties = {
  border: `1px solid ${T.border}`, background: T.surface, color: T.text, borderRadius: 4,
  padding: "8px 10px", fontSize: 13, minWidth: 0,
};

export function fmtSize(n?: number) {
  if (!n) return "";
  return n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

export default function MaterialsEditor({ value, onChange }: { value: MaterialItem[]; onChange: (v: MaterialItem[]) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setError("");
    let next = value;
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData(); fd.append("file", f);
        const res = await fetch("/api/classroom/upload-material", { method: "POST", body: fd });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Файл илгээсэнгүй");
        next = [...next, { url: d.url, name: d.name, size: d.size, kind: "file" }];
        onChange(next);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Сүлжээний алдаа"); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  function addLink() {
    const url = linkUrl.trim();
    if (!/^https?:\/\//i.test(url)) { setError("Линк https:// эсвэл http:// -ээр эхлэх ёстой"); return; }
    let host = url; try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { /* */ }
    setError("");
    onChange([...value, { url, name: linkName.trim() || host, kind: "link" }]);
    setLinkUrl(""); setLinkName("");
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {value.length === 0 && <p style={{ margin: 0, fontSize: 13, color: T.faint }}>Материал хавсаргаагүй байна.</p>}
      {value.map((m, i) => (
        <div key={m.url + i} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", border: `1px solid ${T.border}`, borderRadius: 4, padding: 8, background: T.surfaceHi }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: T.primaryInk, minWidth: 40 }}>{m.kind === "link" ? "ЛИНК" : "ФАЙЛ"}</span>
          <input aria-label="Материалын нэр" value={m.name} maxLength={200} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} style={{ ...input, flex: "1 1 160px" }} />
          <span style={{ fontSize: 12, color: T.faint }}>{fmtSize(m.size)}</span>
          <a href={m.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: T.primaryInk, fontWeight: 600 }}>Нээх</a>
          <Btn variant="ghost" size="sm" onClick={() => { if (confirm(`"${m.name}"-г хасах уу?`)) onChange(value.filter((_, j) => j !== i)); }}>Хасах</Btn>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input ref={fileRef} type="file" multiple className="hidden" style={{ display: "none" }} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.zip,.png,.jpg,.jpeg,.webp" onChange={(e) => void onFiles(e.target.files)} />
        <Btn variant="secondary" size="sm" loading={busy} onClick={() => fileRef.current?.click()}>+ Файл оруулах</Btn>
        <span style={{ fontSize: 12, color: T.faint }}>PDF, Word, Excel, PowerPoint, ZIP, зураг · ≤ 25MB</span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input aria-label="Линк" placeholder="https://…" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} style={{ ...input, flex: "2 1 220px" }} />
        <input aria-label="Линкийн нэр" placeholder="Нэр (заавал биш)" value={linkName} onChange={(e) => setLinkName(e.target.value)} style={{ ...input, flex: "1 1 140px" }} />
        <Btn variant="secondary" size="sm" disabled={!linkUrl.trim()} onClick={addLink}>+ Линк нэмэх</Btn>
      </div>
      {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: T.badInk }}>{error}</p>}
    </div>
  );
}
