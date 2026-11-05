/* Сервер асахад 5 SCAN-ийн амьд бүртгэлийг эхлүүлнэ — хуудас нээгээгүй ч M5 хаалт бүр хэмжигдэнэ (2026-11-05). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startRecorder } = await import("@/lib/gold/five");
  startRecorder();
  const { startDeskRecorder } = await import("@/lib/desk/learn");
  startDeskRecorder();
  const { startTruthWarm } = await import("@/lib/desk/truth");
  startTruthWarm();
}
