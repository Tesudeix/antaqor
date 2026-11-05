"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { openAuth } from "@/components/AuthModal";

/* ─── ОНЛАЙН + ШУУД ЧАТ (2026-10-13) ───────────────────────────────────────
   Нүүрэнд (зочин ба гишүүн) — одоо сайт дээр байгаа хүмүүс (сүүлийн 5 мин,
   /api/presence). Хүн дээр дарвал ЭНЭ ХУУДСАН дээрээ жижиг чат цонх нээгдэнэ
   (/chat руу шилжихгүй): яриа үүсгэх/олох → мессежүүд 4с тутам → бичих.
   Зочин дарвал нэвтрэх цонх. Өнгө: класс (Red Signal), онлайн цэг ногоон. */

type U = { _id: string; name: string; username: string; avatar: string; member: boolean };
type Msg = { _id: string; content: string; createdAt: string; sender: { _id: string; name: string } | string };

const LINE = "border-[color:var(--t-line,rgba(255,255,255,0.12))]";

function Face({ u, size = 52 }: { u: U; size?: number }) {
  return u.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={u.avatar} alt="" className="h-full w-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="flex items-center justify-center bg-[#2E29FF] font-extrabold" style={{ width: size, height: size, fontSize: size * 0.36, color: "#FFFFFF" }}>
      {u.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function ChatDock({ peer, me, onClose }: { peer: U; me: string; onClose: () => void }) {
  const [convId, setConvId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/chat/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId: peer._id }),
    })
      .then((r) => r.json())
      .then((d) => { if (alive) { if (d?.conversation?._id) setConvId(d.conversation._id); else setErr(d?.error || "Чат нээж чадсангүй"); } })
      .catch(() => alive && setErr("Сүлжээний алдаа"));
    return () => { alive = false; };
  }, [peer._id]);

  const load = useCallback(async () => {
    if (!convId) return;
    try {
      const r = await fetch(`/api/chat/conversations/${convId}/messages?limit=40`, { cache: "no-store" });
      const d = await r.json();
      if (Array.isArray(d.messages)) setMsgs(d.messages);
    } catch { /* дараагийн эргэлтэд */ }
  }, [convId]);

  useEffect(() => {
    if (!convId) return;
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [convId, load]);

  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }); }, [msgs.length]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const send = async () => {
    const c = text.trim();
    if (!c || !convId || sending) return;
    setSending(true);
    setText("");
    try {
      const r = await fetch(`/api/chat/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: c }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Илгээж чадсангүй"); setText(c); return; }
      if (d.message) setMsgs((m) => [...m, d.message]);
    } catch {
      setErr("Сүлжээний алдаа");
      setText(c);
    } finally {
      setSending(false);
    }
  };

  const senderId = (m: Msg) => (typeof m.sender === "string" ? m.sender : m.sender?._id);

  return (
    <div className="fixed inset-x-0 bottom-0 z-[75] sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[360px]" role="dialog" aria-label={`${peer.name}-тай чат`}>
      <div className={`flex h-[min(70vh,520px)] flex-col overflow-hidden rounded-t-[4px] border ${LINE} bg-[#141414] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] sm:rounded-[4px]`}
        style={{ animation: "od-rise .28s cubic-bezier(.2,.8,.3,1)" }}>
        <div className="flex items-center gap-3 border-b border-[#FCEE0A]/40 px-3 py-2.5">
          <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-[4px]"><Face u={peer} size={36} /></span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[15px] font-extrabold text-[#F2F2F4]">{peer.name}</span>
            <span className="flex items-center gap-1 text-[12px] text-[#4ADE80]"><span className="h-1.5 w-1.5 rounded-full bg-[#4ADE80]" /> Онлайн</span>
          </span>
          {convId && <Link href={`/chat/${convId}`} className="rounded-[4px] px-2 py-1 text-[12px] font-bold text-[#FCEE0A] hover:bg-[rgba(252,238,10,0.1)]">Бүтэн ↗</Link>}
          <button type="button" onClick={onClose} aria-label="Хаах" className="flex h-8 w-8 items-center justify-center rounded-[4px] text-[#F2F2F4] hover:bg-[rgba(255,255,255,0.08)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div ref={list} className="flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
          {!convId && !err && <p className="py-6 text-center text-[13px] text-[#9C9CA6]">Нээж байна…</p>}
          {convId && msgs.length === 0 && (
            <p className="py-6 text-center text-[13.5px] text-[#9C9CA6]">Анхны мессежээ бич — {peer.name.split(" ")[0]} одоо онлайн байна 👋</p>
          )}
          {msgs.map((m) => {
            const mine = senderId(m) === me;
            return (
              <div key={m._id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <span className={`max-w-[78%] whitespace-pre-wrap break-words rounded-[4px] px-3 py-2 text-[14.5px] leading-snug ${mine ? "bg-[#2E29FF] text-white" : "bg-[#1E1E1E] text-[#F2F2F4]"}`}>
                  {m.content}
                </span>
              </div>
            );
          })}
        </div>

        {err && <p className="px-3 pb-1 text-[12.5px] font-semibold text-[#FCEE0A]">{err}</p>}
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className={`flex items-end gap-2 border-t ${LINE} p-2.5`}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Мессеж бичих…"
            rows={1}
            maxLength={2000}
            autoFocus
            className="max-h-28 min-h-10 flex-1 resize-none rounded-[4px] bg-[#0A0A0A] px-3 py-2.5 text-[15px] text-[#F2F2F4] outline-none placeholder:text-[#9C9CA6] focus:ring-1 focus:ring-[#FCEE0A]"
          />
          <button type="submit" disabled={!text.trim() || !convId || sending}
            className="h-10 shrink-0 rounded-[4px] bg-[#2E29FF] px-4 text-[14px] font-extrabold text-white transition hover:bg-[#1F1AD9] disabled:opacity-40">
            Илгээх
          </button>
        </form>
      </div>
      <style jsx global>{`@keyframes od-rise { from { transform: translateY(24px); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>
    </div>
  );
}

export default function OnlineNow({ className = "" }: { className?: string }) {
  const { data: session } = useSession();
  const me = (session?.user as { id?: string } | undefined)?.id || "";
  const [users, setUsers] = useState<U[] | null>(null);
  const [peer, setPeer] = useState<U | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/presence", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (alive && d?.users) setUsers(d.users); })
        .catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (!users) return null;
  const others = users.filter((u) => u._id !== me);
  const total = users.length;

  const open = (u: U) => {
    if (!me) { openAuth("signin"); return; }
    setPeer(u);
  };

  return (
    <section className={`px-4 sm:px-1 ${className}`} aria-label="Онлайн хүмүүс">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[17px] font-extrabold text-[#F2F2F4]">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4ADE80] opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#4ADE80]" />
          </span>
          Одоо онлайн
          <span className="chip-signal px-1.5 py-0.5 text-[12px] tabular-nums">{total}</span>
        </h2>
        <span className="text-[12.5px] text-[#9C9CA6]">{me ? "Дарж шууд чатлах" : "Нэвтэрч чатлах"}</span>
      </div>

      {others.length === 0 ? (
        <p className={`rounded-[4px] border ${LINE} px-4 py-4 text-[14px] text-[#9C9CA6]`}>
          {me ? "Яг одоо өөр хүн алга — найзаа урь, эсвэл пост нийтэлж эхэл." : "Нэвтэрч ороод хүрээлэлтэйгээ шууд холбогдоорой."}
        </p>
      ) : (
        <div className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {others.map((u) => (
            <button key={u._id} type="button" onClick={() => open(u)} title={`${u.name}-тай чатлах`}
              className="press group flex w-[64px] shrink-0 flex-col items-center gap-1.5">
              <span className="relative">
                <span className="block h-[56px] w-[56px] overflow-hidden rounded-[4px] ring-2 ring-[#FCEE0A]/70 transition group-hover:ring-[#FCEE0A]">
                  <Face u={u} size={56} />
                </span>
                <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#0A0A0A] bg-[#4ADE80]" />
              </span>
              <span className="w-full truncate text-center text-[12px] font-semibold text-[#E2E4E8]">{u.name.split(" ")[0]}</span>
            </button>
          ))}
        </div>
      )}

      {peer && me && <ChatDock peer={peer} me={me} onClose={() => setPeer(null)} />}
    </section>
  );
}
