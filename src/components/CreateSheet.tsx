"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/* ─── "+" → шууд пост бичих (2026-10-11, эзний хүсэлт) ─────────────────────
   Өмнө нь энэ нь "Юу үүсгэх вэ" цэс байсан (Промпт нэмэх, Reel нийтлэх,
   AI зураг…). Одоо "+" (доод цэс, SideNav-ийн Нийтлэх, antaqor:create
   дохио) нь ЦЭСГҮЙГЭЭР /posts/new composer-ийг нээнэ — тэр нь доороос
   дээш spring хөдөлгөөнтэй гарч ирдэг модал. Хуучин цэс:
   CreateSheet.tsx.bak.* — /prompts/new, /tools/* хуудаснууд хэвээр. */
export default function CreateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();

  // Composer-ийг урьдчилан ачаална — "+" дарахад шууд гарч ирнэ.
  useEffect(() => { router.prefetch("/posts/new"); }, [router]);

  useEffect(() => {
    if (!open) return;
    onClose();
    router.push("/posts/new");
  }, [open, onClose, router]);

  return null;
}
