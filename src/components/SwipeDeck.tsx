"use client";

import { Children, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

/* ─── SwipeDeck — нэг л физик мэдрэмжтэй гулсуур ──────────────────────────
   Сайт дээр хэвтээ гулсдаг бүх зүйл (hero, тарифууд) ЭНЭ бүрхүүлээр явна.

   ⚠ ЭНЭ НЬ ЗОРИУД JS-ЭЭР ЧИРДЭГГҮЙ. Эхний хувилбар нь framer-motion-ий
   `drag="x"` дээр суурилсан байсан — тоо ярианд сайхан сонсогдоно, гар дээр
   муу. Учир нь:

   · Хөтөч өөрөө хэвтээ/босоо чиглэлийг шийддэг. JS чирэлт тэр шийдвэрийг
     булаан авах гэж оролдоход, тариф руу хуруу тавиад ДООШ гүйлгэх гэсэн
     хүн хажуу тийш чирэгддэг. Төлбөрийн хуудас урт, доошоо гүйлгэх нь
     хамгийн түгээмэл хөдөлгөөн — хамгийн түгээмэл хөдөлгөөнийг эвдэж
     байж хамгийн ховрыг сайжруулах нь солилцоо биш, алдаа.
   · Хуруу салтал юу ч болохгүй. Төрөлх гүйлгэлт хуруутай хамт инерцээр
     үргэлжилдэг; JS чирэлт "тавь, дараа нь бодъё" гэдэг.
   · iOS дээр зүүн ирмэгээс эхэлсэн шудрах нь БУЦАХ навигац болдог.

   Тиймээс доор нь CSS scroll-snap + төрөлх инерц. "Apple шиг" мэдрэмж нь
   гаднаас бичсэн spring биш, ЯГ энэ — учир нь Apple өөрөө картын эгнээндээ
   яг үүнийг хэрэглэдэг. Бидний код зөвхөн ГУРВАН зүйл хийнэ:
     1. хэмжээ хэмжиж, хэдэн зогсоол байгааг тоолно (цэг зурахад хэрэгтэй),
     2. гүйлгэлтийг сонсож, одоо хэддүгээрт байгааг хэлнэ,
     3. цэг дархад тухайн байрлал руу зөөлөн аваачна.
   Хөдөлгөөнийг өөрийг нь хөтөч гүйцэтгэнэ. */

export default function SwipeDeck({
  children,
  gap = 16,
  className = "",
  trackClassName = "",
  index,
  onIndexChange,
  onPagesChange,
  ariaLabel,
  /** Утсан дээр картыг дэлгэцийн ирмэг хүртэл гаргаж, дараагийнхыг нь
      "цухуйлгана" — цааш байгааг сум зурахгүйгээр хэлэх хамгийн хямд арга. */
  edgeBleed = 0,
}: {
  children: React.ReactNode;
  gap?: number;
  className?: string;
  trackClassName?: string;
  index: number;
  onIndexChange: (i: number) => void;
  onPagesChange?: (n: number) => void;
  ariaLabel?: string;
  edgeBleed?: number;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const [step, setStep] = useState(0);
  const [maxIndex, setMaxIndex] = useState(0);
  // Цэг дарж очиж байх хооронд onScroll-ын завсрын утгууд индексийг
  // татсаар байвал зорилго руугаа хүрэхгүй чичирнэ.
  const settling = useRef(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const items = Array.from(el.children) as HTMLElement[];
    if (items.length === 0) return;
    const itemW = items[0].getBoundingClientRect().width;
    const s = itemW + gap;
    const vw = el.clientWidth - edgeBleed * 2;
    const perView = Math.max(1, Math.floor((vw + gap) / s));
    const maxI = Math.max(0, items.length - perView);
    setStep(s);
    setMaxIndex(maxI);
    onPagesChange?.(maxI + 1);
  }, [gap, edgeBleed, onPagesChange]);

  // Хүүхдийн тоо өөрчлөгдвөл ажиглалтыг шинээр барих түлхүүр.
  const childCount = Children.count(children);

  useLayoutEffect(() => {
    measure();
    const el = ref.current;
    if (!el) return;

    // Байршил тогтсоны дараа дахин — эхний хэмжилт эрт болсон бол засна.
    const raf = requestAnimationFrame(() => requestAnimationFrame(measure));
    const late = setTimeout(measure, 350);

    const onResize = () => measure();
    window.addEventListener("resize", onResize);

    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => measure());
      ro.observe(el);
      for (const c of Array.from(el.children)) ro.observe(c);
    }

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(late);
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
    };
  }, [measure, childCount]);

  const onScroll = () => {
    const el = ref.current;
    if (!el || step === 0 || settling.current) return;
    const i = Math.max(0, Math.min(maxIndex, Math.round(el.scrollLeft / step)));
    if (i !== index) onIndexChange(i);
  };

  /* Гаднаас индекс өөрчлөгдвөл (цэг, автомат дэвшилт) тэр байрлал руу.
     Хүн өөрөө гүйлгэж байгаа үед энэ нь ажиллахгүй — учир нь тэр тохиолдолд
     индекс нь гүйлгэлтээс УРСАЖ ирдэг тул аль хэдийн байрандаа байна. */
  useEffect(() => {
    const el = ref.current;
    if (!el || step === 0) return;
    const target = Math.min(index, maxIndex) * step;
    if (Math.abs(el.scrollLeft - target) < 2) return;
    settling.current = true;
    el.scrollTo({ left: target, behavior: reduced ? "auto" : "smooth" });
    const t = setTimeout(() => { settling.current = false; }, reduced ? 0 : 420);
    return () => clearTimeout(t);
  }, [index, step, maxIndex, reduced]);

  useEffect(() => {
    if (index > maxIndex) onIndexChange(maxIndex);
  }, [index, maxIndex, onIndexChange]);

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      role="group"
      aria-label={ariaLabel}
      /* no-scrollbar: зурвас өөрөө харагдахгүй, цэг нь заана.
         overscroll-x-contain: iOS дээр хажуу тийш шудрахад хуудас БУЦАХГҮЙ.
         snap-mandatory: хоёр картын дунд өлгөөтэй үлдэхгүй.
         [&>*]:snap-start: хүүхдүүд өөрсдөө класс мэдэх шаардлагагүй. */
      className={`no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [&>*]:snap-start [&>*]:shrink-0 ${trackClassName} ${className}`}
      style={{
        gap,
        scrollPaddingInlineStart: edgeBleed,
        paddingInline: edgeBleed || undefined,
        marginInline: edgeBleed ? -edgeBleed : undefined,
        // Хэвтээ л гүйлгэнэ гэж хөтөчид хэлнэ — босоо нь хуудсынх хэвээр.
        touchAction: "pan-x pan-y",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {children}
    </div>
  );
}

/* ─── Цэгүүд — байрлалыг харуулах ганц элемент ───────────────────────── */
export function SwipeDots({
  count,
  index,
  onSelect,
  className = "",
  tone = "dark",
}: {
  count: number;
  index: number;
  onSelect: (i: number) => void;
  className?: string;
  tone?: "dark" | "light";
}) {
  if (count < 2) return null;
  const on = tone === "dark" ? "bg-white" : "bg-[#2E29FF]";
  const off = tone === "dark" ? "bg-white/35" : "bg-[#262626]";
  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(i)}
          aria-label={`${i + 1}-р хэсэг`}
          aria-current={i === index}
          /* Хүрэх талбар 44px, харагдах зураас 3px. Хоёрыг сольж болохгүй. */
          className="flex h-11 items-center px-1"
        >
          <span
            className={`block h-[3px] rounded-[4px] transition-all duration-300 ${
              i === index ? `w-8 ${on}` : `w-3 ${off}`
            }`}
          />
        </button>
      ))}
    </div>
  );
}
