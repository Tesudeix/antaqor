"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { isAdminEmail } from "@/lib/adminClient";

interface Client {
  _id: string;
  name: string;
  logo: string;
  description: string;
  url: string;
  order: number;
}

// Public clients/partners section — modern card grid with hover lift,
// glow accent, URL preview, and an inline admin shortcut to /admin/clients
// when the viewer is admin.

export default function ClientsSection() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { data: session } = useSession();
  const isAdmin = isAdminEmail(session?.user?.email);

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.clients)) setClients(d.clients); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return null;
  // Hide entire section from non-admins when there are no clients —
  // admin still gets the empty-state CTA so they can seed.
  if (clients.length === 0 && !isAdmin) return null;

  return (
    <section>
      {/* Eyebrow + admin shortcut */}
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-[2px] w-4 bg-[#2E29FF]" />
          <span className="font-mono text-[10px] font-black uppercase tracking-[0.22em] text-[#0e1726]">
            ХАМТРАГЧ БРЭНД
          </span>
          {clients.length > 0 && (
            <span className="rounded-[4px] bg-[rgba(46,41,255,0.12)] px-1.5 py-0.5 font-mono text-[8px] font-black tracking-[0.18em] text-[#2E29FF]">
              {clients.length}
            </span>
          )}
        </div>
        {isAdmin && (
          <Link
            href="/admin/clients"
            className="inline-flex items-center gap-1 font-mono text-[11px] font-black uppercase tracking-[0.18em] text-[#E2E4E8] transition hover:text-[#2E29FF]"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
            </svg>
            УДИРДАХ
          </Link>
        )}
      </div>

      {/* Empty state — only admins see this (non-admins get null above) */}
      {clients.length === 0 ? (
        <Link
          href="/admin/clients"
          className="group flex items-center gap-3 rounded-[4px] border-2 border-dashed border-[rgba(46,41,255,0.25)] bg-[rgba(46,41,255,0.04)] p-4 transition hover:border-[#2E29FF]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-[4px] bg-[rgba(46,41,255,0.12)] text-[#2E29FF]">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </span>
          <div className="flex-1">
            <p className="text-[13px] font-bold text-[#0e1726]">Эхний хамтрагч брэндээ нэмэх</p>
            <p className="text-[11px] text-[#E2E4E8]">Лого + URL + богино тайлбар</p>
          </div>
          <svg className="h-4 w-4 text-[#E2E4E8] transition group-hover:translate-x-0.5 group-hover:text-[#2E29FF]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {clients.map((c) => (
            <ClientCard key={c._id} client={c} />
          ))}
          {/* Admin-only "+ нэмэх" tile inline at the end of the grid */}
          {isAdmin && (
            <Link
              href="/admin/clients"
              className="group flex flex-col items-center justify-center gap-2 rounded-[4px] border border-dashed border-[rgba(46,41,255,0.25)] bg-[rgba(46,41,255,0.04)] p-4 transition hover:border-[#2E29FF]"
              style={{ minHeight: "152px" }}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-[4px] bg-[rgba(46,41,255,0.12)] text-[#2E29FF] transition group-hover:scale-110">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </span>
              <span className="font-mono text-[11px] font-black uppercase tracking-[0.18em] text-[#E2E4E8] group-hover:text-[#2E29FF]">
                ШИНЭ БРЭНД
              </span>
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

// ─── Card ───────────────────────────────────────────────────────────────
function ClientCard({ client }: { client: Client }) {
  const initials = client.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const Wrapper: React.ElementType = client.url ? "a" : "div";
  const wrapperProps = client.url
    ? ({ href: client.url, target: "_blank", rel: "noopener noreferrer" } as const)
    : {};

  // Strip protocol for nicer display
  const displayUrl = client.url
    ? client.url.replace(/^https?:\/\//, "").replace(/\/$/, "")
    : "";

  return (
    <Wrapper
      {...wrapperProps}
      title={client.description || client.name}
      className="group relative flex flex-col overflow-hidden rounded-[4px] border border-[rgba(15,23,38,0.06)] bg-gradient-to-br from-[#101012] to-[#0A0A0A] p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(46,41,255,0.4)] hover:shadow-[0_8px_32px_rgba(46,41,255,0.18)]"
    >
      {/* Top-right external-link arrow if URL present */}
      {client.url && (
        <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-[4px] bg-[rgba(15,23,38,0.04)] text-[#E2E4E8] opacity-0 transition group-hover:opacity-100">
          <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </span>
      )}

      {/* Logo zone — centered square with subtle inset shadow */}
      <div className="mb-3 flex h-16 items-center justify-center">
        {client.logo ? (
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[4px] bg-white/95 p-1.5 ring-1 ring-[rgba(15,23,38,0.06)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={client.logo}
              alt={client.name}
              className="h-full w-full object-contain"
            />
          </div>
        ) : (
          <div
            className="flex h-14 w-14 items-center justify-center rounded-[4px] font-mono text-[18px] font-black tracking-tight text-[#0e1726] ring-1 ring-[rgba(15,23,38,0.06)]"
            style={{
              background: `linear-gradient(135deg, ${gradientFor(client.name)} 0%, #F8F9FD 100%)`,
            }}
          >
            {initials || "·"}
          </div>
        )}
      </div>

      {/* Name + description + URL — left-aligned */}
      <div className="min-w-0">
        <p className="line-clamp-1 text-[13px] font-bold text-[#0e1726] transition group-hover:text-[#2E29FF]">
          {client.name}
        </p>
        {client.description && (
          <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-[#E2E4E8]">
            {client.description}
          </p>
        )}
        {displayUrl && (
          <p className="mt-1.5 line-clamp-1 font-mono text-[11px] uppercase tracking-[0.1em] text-[#E2E4E8] transition group-hover:text-[#2E29FF]">
            {displayUrl}
          </p>
        )}
      </div>
    </Wrapper>
  );
}

// Deterministic per-name gradient for the logo placeholder so each client has
// a stable, distinct color even without an uploaded logo.
function gradientFor(seed: string): string {
  const palette = [
    "rgba(46,41,255,0.35)",   // pink
    "rgba(99,102,241,0.35)",  // indigo
    "rgba(34,197,94,0.30)",   // green
    "rgba(245,158,11,0.32)",  // amber
    "rgba(46,41,255,0.32)",  // purple
    "rgba(14,165,233,0.32)",  // sky
  ];
  const h = seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return palette[h % palette.length];
}
