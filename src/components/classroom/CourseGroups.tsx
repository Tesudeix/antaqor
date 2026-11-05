"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, Btn, SectionHeader, T } from "@/components/admin/kit";

/* Админ: курсийн БҮЛЭГ (chapter). Үүсгэх · нэрлэх · дараалал солих (↑↓) ·
   бүлэг бүрийн хичээлүүд. Бүлэг устгахад API хичээлүүдийг нь хамт
   устгадаг тул хоосон биш бүлгийг УСТГАХГҮЙ — эхлээд хичээлийг өөр бүлэгт
   зөөх ёстой. */
type Lesson = { _id: string; title: string; videoUrl?: string; attachments?: unknown[] };
type Group = { _id: string; title: string; order: number; lessons: Lesson[] };

const field: React.CSSProperties = { border: `1px solid ${T.border}`, background: T.surface, color: T.text, borderRadius: 4, padding: "8px 10px", fontSize: 14, minWidth: 0 };

export default function CourseGroups({ courseId }: { courseId: string }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/classroom/courses/${courseId}/tree`);
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || "Бүлэг ачаалсангүй");
    setGroups(((d.sections || []) as Group[]).sort((a, b) => a.order - b.order));
  }, [courseId]);
  useEffect(() => { void load().catch((e) => setError(e.message)); }, [load]);

  async function call(url: string, method: string, body: unknown) {
    setBusy(true); setError("");
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Хадгалсангүй");
      await load();
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Сүлжээний алдаа"); return false; }
    finally { setBusy(false); }
  }

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = title.trim(); if (!name) return;
    if (await call("/api/classroom/sections", "POST", { course: courseId, title: name, order: groups.length + 1 })) setTitle("");
  };
  const rename = (g: Group, name: string) => {
    const n = name.trim();
    if (!n) { setError("Бүлгийн нэр хоосон байж болохгүй"); void load(); return; }
    if (n !== g.title) void call(`/api/classroom/sections/${g._id}`, "PUT", { title: n });
  };
  const move = (i: number, dir: -1 | 1) => {
    const ids = groups.map((g) => g._id);
    const j = i + dir; if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setGroups((gs) => { const c = [...gs]; [c[i], c[j]] = [c[j], c[i]]; return c; });
    void call("/api/classroom/sections/reorder", "POST", { course: courseId, ids });
  };
  const remove = (g: Group) => {
    if (g.lessons.length) { setError(`"${g.title}" бүлэгт ${g.lessons.length} хичээл байна. Эхлээд хичээлүүдийг өөр бүлэгт зөөнө үү (хичээл засах → Бүлэг).`); return; }
    if (confirm(`"${g.title}" бүлгийг устгах уу?`)) void call(`/api/classroom/sections/${g._id}`, "DELETE", null);
  };

  return (
    <Card className="p-5">
      <SectionHeader title="Бүлгүүд" hint={`${groups.length} бүлэг · дарааллыг ↑ ↓ -ээр солино`} />
      <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
        {groups.map((g, i) => (
          <div key={g._id} style={{ border: `1px solid ${T.border}`, borderRadius: 4, background: T.surface }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", padding: 8, flexWrap: "wrap" }}>
              <span style={{ width: 24, textAlign: "center", fontSize: 12, color: T.faint, fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
              <input aria-label={`Бүлэг ${i + 1} нэр`} key={g.title} defaultValue={g.title} maxLength={200} disabled={busy}
                onBlur={(e) => rename(g, e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                style={{ ...field, flex: "1 1 180px", fontWeight: 600 }} />
              <Btn variant="ghost" size="sm" disabled={busy || i === 0} onClick={() => move(i, -1)}>↑</Btn>
              <Btn variant="ghost" size="sm" disabled={busy || i === groups.length - 1} onClick={() => move(i, 1)}>↓</Btn>
              <Btn variant="secondary" size="sm" onClick={() => setOpen((o) => ({ ...o, [g._id]: !o[g._id] }))}>{g.lessons.length} хичээл {open[g._id] ? "▴" : "▾"}</Btn>
              <Btn variant="danger" size="sm" disabled={busy} onClick={() => remove(g)}>Устгах</Btn>
            </div>
            {open[g._id] && (
              <div style={{ borderTop: `1px solid ${T.border}`, padding: "6px 8px 8px 40px", display: "grid", gap: 2 }}>
                {g.lessons.map((l) => (
                  <Link key={l._id} href={`/admin/classroom/courses/${courseId}/lessons/${l._id}`} style={{ fontSize: 13, padding: "6px 0", color: T.text, display: "flex", gap: 8, justifyContent: "space-between" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title}</span>
                    <span style={{ color: T.faint, fontSize: 12, whiteSpace: "nowrap" }}>{l.attachments?.length ? `📎 ${l.attachments.length}` : ""}</span>
                  </Link>
                ))}
                <Link href={`/admin/classroom/courses/${courseId}/lessons/new?section=${g._id}`} style={{ fontSize: 13, padding: "6px 0", color: T.primaryInk, fontWeight: 600 }}>+ Энэ бүлэгт хичээл нэмэх</Link>
              </div>
            )}
          </div>
        ))}
        {!groups.length && <p style={{ margin: 0, fontSize: 13, color: T.faint }}>Бүлэг байхгүй. Доор эхний бүлгээ үүсгэнэ үү.</p>}
      </div>
      <form onSubmit={add} style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <input aria-label="Шинэ бүлгийн нэр" placeholder="Шинэ бүлгийн нэр" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} style={{ ...field, flex: 1 }} />
        <Btn disabled={busy || !title.trim()} onClick={() => {}}>+ Бүлэг</Btn>
      </form>
      {error && <p role="alert" style={{ margin: "10px 0 0", fontSize: 13, color: T.badInk }}>{error}</p>}
    </Card>
  );
}
