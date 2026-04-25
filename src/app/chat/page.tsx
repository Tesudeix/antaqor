import type { Metadata } from "next";
import ChatHub from "./ChatHub";

export const metadata: Metadata = {
  title: "Чат · Antaqor",
  description: "Antaqor доторх шууд мессеж болон Telegram community нэг газар.",
  alternates: { canonical: "/chat" },
  robots: { index: false, follow: true },
  openGraph: {
    title: "Antaqor · Inbox",
    description: "Шууд мессеж + Telegram community.",
    url: "/chat",
  },
};

export default function ChatPage() {
  return <ChatHub />;
}
