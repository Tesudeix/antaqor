import AgentApp from "@/components/content-agent/AgentApp";

const desc = "Antaqor-ийн гишүүд AI зураг, AI ихрээ бүтээж community-д хуваалцана. Бизнесүүд (99,000₮/сар) пост бичүүлж Facebook, Instagram, Threads-д автоматаар нийтэлнэ.";
export const metadata = {
  title: "Antaqor Agent — бизнесийн сошиалыг AI хөтөлнө",
  description: desc,
  openGraph: { title: "Antaqor Agent — бизнесийн сошиалыг AI хөтөлнө", description: desc, url: "https://antaqor.com/content-agent" },
};

/* Antaqor Agent — гишүүнд AI зураг + AI ихэр, бизнест (99,000₮/сар) бүх боломж (2026-10-26).
   Зочинд танилцуулга, эрхгүйд багцын сонголт, бусдад апп. Эрхийг API (workspace) шалгана. */
export default function ContentAgentPage() { return <AgentApp />; }
