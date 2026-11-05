"use client";
import Link from "next/link";
import { BroadcastViewer, useBroadcast } from "@/components/live/Broadcast";
import css from "@/components/live/live.module.css";

/* /live/broadcast — шууд хичээлийн үзэгчийн хуудас (2026-10-09: харанхуй,
   9:16 тайз; live биш үед хуваарь + тоолуур). */
export default function BroadcastPage() {
  const state = useBroadcast();
  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "8px 16px 96px" }}>
      <div style={{ marginBottom: 12 }}><Link href="/" className={css.link}>← Нүүр</Link></div>
      <BroadcastViewer state={state} />
    </main>
  );
}
