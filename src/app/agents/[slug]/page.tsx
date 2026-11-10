import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveOne } from "@/lib/agentRoster";
import AgentChat from "@/components/agents/AgentChat";
import { AGENT_CHAT_COST, AGENT_CHAT_MAX_CHARS, AGENT_CHAT_MAX_TURNS } from "@/lib/agentChat";

/* ─── /agents/<slug> — агентын хуудас + чат (2026-11-10) ─────────────────
   Агент бүр өөрийн хаягтай: код дээрх (ANURA) ч, /admin/agents-аас
   үүсгэсэн ч адил. Ростер нь `lib/agentRoster.ts` — тэнд идэвхгүй болгосон
   агент энд 404 болно.

   Хаяг том жижиг үсэг ялгахгүй: `/agents/Qeqor` = `/agents/qeqor`.
   Чиглүүлэлт хийхгүй — хүн бичсэн хаягаараа үлдэнэ, canonical нь жижгээр.

   АЮУЛГҮЙ БАЙДАЛ: `systemPrompt` энэ файлаас ЦААШ гарахгүй. Клиент рүү
   зөвхөн доорх нийтийн талбарууд очно — prompt нь эзний өмч, хуудасны
   эх кодоос уншигдах ёсгүй. */

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

const load = cache(async (raw: string) => {
  let slug = raw;
  try {
    slug = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (!/^[a-z0-9_-]{1,40}$/i.test(slug)) return null;
  const agent = await resolveOne(slug.toLowerCase());
  return agent && agent.active ? agent : null;
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const agent = await load(slug).catch(() => null);
  if (!agent) return { title: "Агент олдсонгүй", robots: { index: false } };
  const description = (agent.desc || agent.mission || `${agent.name} — Antaqor AI агент`).slice(0, 180);
  const title = `${agent.name} · AI агент`;
  return {
    title,
    description,
    alternates: { canonical: `/agents/${agent.slug}` },
    openGraph: { title, description, url: `/agents/${agent.slug}`, type: "website" },
  };
}

export default async function AgentPage({ params }: { params: Params }) {
  const { slug } = await params;
  const agent = await load(slug);
  if (!agent) notFound();

  return (
    <AgentChat
      agent={{
        slug: agent.slug,
        name: agent.name,
        handle: agent.handle,
        role: agent.role,
        desc: agent.desc,
        mission: agent.mission,
        color: agent.color,
        avatar: agent.avatar,
      }}
      cost={AGENT_CHAT_COST}
      maxChars={AGENT_CHAT_MAX_CHARS}
      maxTurns={AGENT_CHAT_MAX_TURNS}
    />
  );
}
