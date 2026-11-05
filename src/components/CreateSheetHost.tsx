"use client";

import { useEffect, useState } from "react";
import CreateSheet from "@/components/CreateSheet";

/* Ширээний дэлгэц дээр "+" / "Пост бичих" дарахад `/posts/new` руу үсрэхийн
   оронд ижил CreateSheet-ийг төвд нь animation-тай нээнэ. Нээх дохио нь
   `window.dispatchEvent(new CustomEvent("antaqor:create"))` — SideNav,
   баруун багана хоёулаа үүнийг илгээнэ. Утсан дээр BottomBar өөрийн
   sheet-ээ барьдаг хэвээр. */
export default function CreateSheetHost() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener("antaqor:create", on);
    return () => window.removeEventListener("antaqor:create", on);
  }, []);
  return <CreateSheet open={open} onClose={() => setOpen(false)} />;
}
