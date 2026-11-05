"use client";

import React from "react";
import Announcements from "@/components/Announcements";
import Founding from "@/components/Founding100Badge";
import JourneyBoard from "@/components/JourneyBoard";
import AIBriefing from "@/components/AIBriefing";
import InstagramReels from "@/components/InstagramReels";
import ClientsSection from "@/components/ClientsSection";
import HomeManifesto from "@/components/HomeManifesto";
import ToolsSection from "@/components/ToolsSection";
import { HOME_SECTION_META, type HomeSectionKey } from "@/lib/homeSectionsMeta";

// ─── Нүүрийн их бие — админаас асаадаг/унтраадаг хэсгүүд ───
// Дараалал ба идэвх нь LandingContent.homeSections (DB) дээр. Түлхүүр байхгүй
// бол юу ч харагдахгүй — өөрөөр хэлбэл default нь "хоосон", админ сонгоно.

const REGISTRY: Record<HomeSectionKey, React.ComponentType> = {
  announcements: Announcements,
  founding: Founding,
  journey: JourneyBoard,
  briefing: AIBriefing,
  reels: InstagramReels,
  clients: ClientsSection,
  manifesto: HomeManifesto,
  tools: ToolsSection,
};

const VALID = new Set(HOME_SECTION_META.map((s) => s.key as string));

/** Нэг хэсэг унавал зөвхөн тэр хэсэг алга болно — нүүр бүхэлдээ цагаан болохгүй. */
class SectionBoundary extends React.Component<{ children: React.ReactNode }, { dead: boolean }> {
  state = { dead: false };
  static getDerivedStateFromError() {
    return { dead: true };
  }
  render() {
    return this.state.dead ? null : this.props.children;
  }
}

export default function HomeSections({ keys }: { keys?: string[] }) {
  /* "tools" (Хэрэгсэл) хэсэг 2026-10-06-нд бүрмөсөн хасагдав. Админы
     хадгалсан дараалалд түлхүүр нь үлдсэн байж болох тул энд шүүнэ. */
  const list = (keys || []).filter((k) => VALID.has(k) && k !== "tools") as HomeSectionKey[];
  if (list.length === 0) return null;
  return (
    <>
      {list.map((k) => {
        const C = REGISTRY[k];
        return (
          <SectionBoundary key={k}>
            <C />
          </SectionBoundary>
        );
      })}
    </>
  );
}
