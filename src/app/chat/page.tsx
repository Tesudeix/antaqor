import type { Metadata } from "next";
import ChatEmpty from "./ChatEmpty";

export const metadata: Metadata = {
  title: "Чат · Antaqor",
  description: "Antaqor доторх шууд мессеж.",
  alternates: { canonical: "/chat" },
  robots: { index: false, follow: true },
  openGraph: {
    title: "Antaqor · Inbox",
    description: "Шууд мессеж.",
    url: "/chat",
  },
};

/* Жагсаалт нь layout (ChatShell) дотор. Энэ хуудас нь зөвхөн ширээн
   дээрх баруун баганы хоосон төлөв. */
export default function ChatPage() {
  return <ChatEmpty />;
}
