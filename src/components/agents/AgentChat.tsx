"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import PageShell from "@/components/PageShell";
import { openAuth } from "@/components/AuthModal";
import { isAdminEmail } from "@/lib/adminClient";
import s from "./AgentChat.module.css";

/* ─── Агентын чат — /agents/<slug> (2026-11-10) ──────────────────────────
   БҮТЭЦ: цонхны өөрийнх нь гүйлгээ + ёроолд наалддаг бичих талбар
   (`position: sticky`). `/z`-д аль хэдийн батлагдсан загвар — тогтмол
   өндөртэй дотоод гүйлгээ нь утасны гар гарахад эвдэрдэг.

   ТҮҮХ: серверт ХАДГАЛАГДАХГҮЙ. Энэ төхөөрөмжийн localStorage-д, хэрэглэгч
   бүрээр тусдаа (`slug + userId`). «Шинэ яриа» дарвал устна. Агентад очих
   түүх нь эндээс явдаг тул хуудас сэргээсэн ч яриа үргэлжилнэ.

   ЗОЧИН: хуудсыг үзнэ, бичнэ, «Илгээх» дармагц нэвтрэх цонх гарна. Бичсэн
   нь ноорогт үлддэг — нэвтрээд буцаж ирэхэд дахин шивэх шаардлагагүй.

   АЛДАА: хариу ирээгүй бол хэрэглэгчийн мессежийг жагсаалтаас буцааж
   талбарт нь тавина. Хариугүй өлгөгдсөн мессеж дараагийн хүсэлтэд
   "хоёр дараалсан асуулт" болж очдог. */

export interface AgentPublic {
  slug: string;
  name: string;
  handle: string;
  role: string;
  desc: string;
  mission: string;
  color: string;
  avatar: string;
}

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

type Notice = { kind: "error" | "credit"; text: string } | null;

const KEEP = 30;
const BRAND = "#2E29FF";
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const num = (n: number) => n.toLocaleString("en-US");

function safeColor(c: string): string {
  return /^#[0-9a-f]{6}$/i.test((c || "").trim()) ? c.trim() : BRAND;
}

/** Дэвсгэр өнгөн дээр уншигдах бичгийн өнгө (цайвар дэвсгэрт цагаан үсэг алга болдог). */
function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum > 0.6 ? "#12131A" : "#FFFFFF";
}

function readHistory(key: string): Msg[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const out: Msg[] = [];
    for (const m of arr) {
      if (
        m &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim()
      ) {
        out.push({ id: typeof m.id === "string" ? m.id : uid(), role: m.role, content: m.content });
      }
    }
    return out.slice(-KEEP);
  } catch {
    return [];
  }
}

function Avatar({ agent, large }: { agent: AgentPublic; large?: boolean }) {
  const [broken, setBroken] = useState(false);
  const color = safeColor(agent.color);
  const show = !!agent.avatar && !broken;
  return (
    <span
      className={`${s.avatar} ${large ? s.avatarLg : ""}`}
      style={show ? undefined : { background: color, color: inkOn(color) }}
      aria-hidden
    >
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={agent.avatar} alt="" onError={() => setBroken(true)} />
      ) : (
        agent.name.charAt(0).toUpperCase()
      )}
    </span>
  );
}

/** `**тод**` л танина. Бүтэн markdown хэрэггүй — агентууд богино, мөрөөр хариулдаг. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*\n]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.length > 4 && p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : p
      )}
    </>
  );
}

export default function AgentChat({
  agent,
  cost,
  maxChars,
  maxTurns,
}: {
  agent: AgentPublic;
  cost: number;
  maxChars: number;
  maxTurns: number;
}) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const user = session?.user as { id?: string; email?: string | null } | undefined;
  const userId = user?.id || "";
  const authed = status === "authenticated" && !!userId;
  const admin = authed && isAdminEmail(user?.email);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [hydratedKey, setHydratedKey] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [copied, setCopied] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<Msg[]>([]);
  const sendingRef = useRef(false);
  const jumpRef = useRef(true);
  const mounted = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  const historyKey = authed ? `agentchat:v1:${agent.slug}:${userId}` : "";
  const draftKey = `agentchat:v1:draft:${agent.slug}`;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abortRef.current?.abort();
    };
  }, []);

  /* Түүх ачаалах. `hydratedKey` нь хадгалах эффектийг ЭНЭ түлхүүрийн түүх
     уншигдсаны дараа л ажиллуулна — тэгэхгүй бол эхний зурагт хоосон
     жагсаалт хадгалагдсан түүхийг дарж бичнэ. */
  useEffect(() => {
    jumpRef.current = true;
    setMessages(historyKey ? readHistory(historyKey) : []);
    setHydratedKey(historyKey);
  }, [historyKey]);

  useEffect(() => {
    if (!historyKey || hydratedKey !== historyKey) return;
    try {
      if (messages.length === 0) localStorage.removeItem(historyKey);
      else localStorage.setItem(historyKey, JSON.stringify(messages.slice(-KEEP)));
    } catch {
      /* хувийн горим / дүүрсэн санах ой — түүхгүйгээр ажиллана */
    }
  }, [messages, historyKey, hydratedKey]);

  /* Ноорог. */
  useEffect(() => {
    try {
      const d = localStorage.getItem(draftKey);
      if (d) setDraft((cur) => cur || d);
    } catch {
      /* ноороггүй */
    }
  }, [draftKey]);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (draft) localStorage.setItem(draftKey, draft);
        else localStorage.removeItem(draftKey);
      } catch {
        /* ноорог хадгалагдахгүй ч чат ажиллана */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [draft, draftKey]);

  /* Үлдэгдэл — зөвхөн төлдөг гишүүнд. */
  useEffect(() => {
    if (!authed || admin) {
      setBalance(null);
      return;
    }
    let alive = true;
    fetch("/api/credits")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && typeof d.balance === "number") setBalance(d.balance);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [authed, admin]);

  /* Бичих талбарын өндөр — агуулгаараа өснө, 160px-ээс дээш бол дотроо гүйнэ. */
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  /* Доод самбарын өндрийг CSS-д өгнө: сүүлчийн мессеж түүний ДЭЭР зогсоно. */
  useEffect(() => {
    const dock = dockRef.current;
    const root = rootRef.current;
    if (!dock || !root || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      root.style.setProperty("--dock-h", `${Math.ceil(dock.getBoundingClientRect().height)}px`);
    });
    ro.observe(dock);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (messages.length === 0 && !sending) return;
    const el = endRef.current;
    if (!el) return;
    const instant =
      jumpRef.current ||
      (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    jumpRef.current = false;
    const id = requestAnimationFrame(() => {
      el.scrollIntoView({ block: "end", behavior: instant ? "auto" : "smooth" });
    });
    return () => cancelAnimationFrame(id);
  }, [messages.length, sending]);

  useEffect(() => {
    if (!confirmClear) return;
    const t = setTimeout(() => setConfirmClear(false), 3000);
    return () => clearTimeout(t);
  }, [confirmClear]);

  const over = draft.length > maxChars;
  const canSend = draft.trim().length > 0 && !sending && !over;

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || sendingRef.current || text.length > maxChars) return;
    if (status === "loading") return;
    if (!authed) {
      openAuth("signin");
      return;
    }

    const base = messagesRef.current;
    const next: Msg[] = [...base, { id: uid(), role: "user", content: text }];
    sendingRef.current = true;
    setSending(true);
    setNotice(null);
    setMessages(next);
    setDraft("");

    /* Буцаах: мессежийг жагсаалтаас авч, бичсэнийг нь талбарт сэргээнэ.
       Хүлээх зуур шинэ юм бичсэн бол түүнийг нь дарж бичихгүй. */
    const fail = (n: Notice) => {
      setMessages(base);
      setDraft((cur) => (cur.trim() ? cur : text));
      setNotice(n);
    };

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const timer = setTimeout(() => ctrl.abort(), 65_000);
    try {
      const res = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: agent.slug,
          messages: next.slice(-maxTurns).map(({ role, content }) => ({ role, content })),
        }),
        signal: ctrl.signal,
      });
      const data = (await res.json().catch(() => ({}))) as { reply?: string; error?: string; credits?: number };
      if (!mounted.current) return;
      if (!admin && typeof data.credits === "number") setBalance(data.credits);

      if (res.ok && typeof data.reply === "string" && data.reply.trim()) {
        setMessages([...next, { id: uid(), role: "assistant", content: data.reply.trim() }]);
      } else if (res.status === 401) {
        fail(null);
        openAuth("signin");
      } else if (res.status === 402) {
        fail({ kind: "credit", text: data.error || "Кредит хүрэлцэхгүй байна." });
      } else {
        fail({ kind: "error", text: data.error || "Хариу ирсэнгүй. Дахин оролдоно уу." });
      }
    } catch {
      if (!mounted.current) return;
      fail({
        kind: "error",
        text: ctrl.signal.aborted ? "Хариу хэт удлаа. Дахин оролдоно уу." : "Сүлжээний алдаа. Дахин оролдоно уу.",
      });
    } finally {
      clearTimeout(timer);
      sendingRef.current = false;
      if (mounted.current) setSending(false);
    }
  }, [draft, maxChars, maxTurns, status, authed, admin, agent.slug]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    /* Утсан дээр Enter = шинэ мөр (гар дээр нь тусдаа «илгээх» байхгүй,
       урт текст бичихэд мөр хэрэгтэй). Хулганатай төхөөрөмжид Enter илгээнэ. */
    if (!window.matchMedia("(pointer: fine)").matches) return;
    e.preventDefault();
    void send();
  };

  const clear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setMessages([]);
    setNotice(null);
    setConfirmClear(false);
    inputRef.current?.focus();
  };

  const copy = async (m: Msg) => {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopied(m.id);
      setTimeout(() => setCopied((c) => (c === m.id ? "" : c)), 1500);
    } catch {
      /* clipboard хориотой орчин */
    }
  };

  const back = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/");
  };

  let hint: ReactNode = null;
  if (status === "loading") {
    hint = null;
  } else if (!authed) {
    hint = (
      <>
        <button type="button" className={s.link} onClick={() => openAuth("signin")}>
          Нэвтрээд
        </button>{" "}
        илгээнэ · {num(cost)} кр / мессеж
      </>
    );
  } else if (admin) {
    hint = <>Админ · үнэгүй</>;
  } else {
    hint = (
      <>
        {num(cost)} кр / мессеж
        {balance !== null && <> · Үлдэгдэл {num(balance)} кр</>}
        {balance !== null && balance < cost && (
          <>
            {" · "}
            <Link href="/credits/buy" className={s.link}>
              Кредит авах
            </Link>
          </>
        )}
      </>
    );
  }

  const sub = [agent.handle, agent.role].filter(Boolean).join(" · ");
  const empty = messages.length === 0 && !sending;

  return (
    <PageShell>
      <div ref={rootRef} className={s.root}>
        <header className={s.head}>
          <button type="button" className={s.icon} onClick={back} aria-label="Буцах">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <Avatar agent={agent} />
          <div className={s.who}>
            <h1 className={s.name}>{agent.name}</h1>
            {sub && <p className={s.sub}>{sub}</p>}
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              className={`${s.ghost} ${confirmClear ? s.danger : ""}`}
              onClick={clear}
              disabled={sending}
            >
              {confirmClear ? "Устгах уу?" : "Шинэ яриа"}
            </button>
          )}
        </header>

        <div className={s.body}>
          {empty ? (
            <section className={s.intro}>
              <Avatar agent={agent} large />
              <h2 className={s.introName}>{agent.name}</h2>
              {agent.role && <p className={s.introRole}>{agent.role}</p>}
              {agent.desc && <p className={s.introDesc}>{agent.desc}</p>}
              {agent.mission && agent.mission !== agent.desc && <p className={s.introNote}>{agent.mission}</p>}
              <p className={s.introCost}>
                {admin
                  ? "Админ эрхээр үнэгүй."
                  : `Мессеж бүр ${num(cost)} кр. Хариу ирээгүй бол кредит буцна.`}
              </p>
            </section>
          ) : (
            <div className={s.list} role="log" aria-live="polite" aria-label={`${agent.name}-тай хийсэн яриа`}>
              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className={`${s.row} ${s.rowUser}`}>
                    <div className={`${s.bubble} ${s.user}`}>{m.content}</div>
                  </div>
                ) : (
                  <div key={m.id} className={s.row}>
                    <Avatar agent={agent} />
                    <div className={s.col}>
                      <div className={`${s.bubble} ${s.agent}`}>
                        <Rich text={m.content} />
                      </div>
                      <button type="button" className={s.copy} onClick={() => void copy(m)}>
                        {copied === m.id ? "Хуулсан" : "Хуулах"}
                      </button>
                    </div>
                  </div>
                )
              )}
              {sending && (
                <div className={s.row}>
                  <Avatar agent={agent} />
                  <div className={`${s.bubble} ${s.agent} ${s.typing}`} aria-label={`${agent.name} хариу бичиж байна`}>
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
              )}
            </div>
          )}
          <div ref={endRef} className={s.end} aria-hidden />
        </div>

        <div ref={dockRef} className={s.dock}>
          {notice && (
            <p className={s.notice} role="alert">
              {notice.text}
              {notice.kind === "credit" && (
                <>
                  {" "}
                  <Link href="/credits/buy" className={s.link}>
                    Кредит авах
                  </Link>
                </>
              )}
            </p>
          )}
          <div className={s.field}>
            <textarea
              ref={inputRef}
              className={s.input}
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={`${agent.name}-д бичих…`}
              aria-label={`${agent.name}-д бичих мессеж`}
              enterKeyHint="enter"
            />
            <button
              type="button"
              className={s.send}
              onClick={() => void send()}
              disabled={!canSend}
              aria-label="Илгээх"
            >
              {sending ? (
                <span className={s.spin} aria-hidden />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 19V5" />
                  <path d="M5 12l7-7 7 7" />
                </svg>
              )}
            </button>
          </div>
          <div className={s.hint}>
            <span>{hint}</span>
            {draft.length > maxChars * 0.8 && (
              <span className={over ? s.over : undefined}>
                {num(draft.length)} / {num(maxChars)}
              </span>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
