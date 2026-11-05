"use client";

import { forwardRef } from "react";
import Icon, { type IconName } from "@/components/Icon";

/* ─── Бүртгэл/нэвтрэлтийн маягтын хэсгүүд — нэг тодорхойлолт, гурван гадаргуу ─
   AuthModal (цонх), LoginCard (/auth/signin), /auth/signup хуудас гурав ЯГ
   ижил маягтыг харуулах ёстой. Өмнө нь `field` гэсэн класс мөр гурван файлд
   тус тусдаа хуулагдсан байсан бөгөөд аль хэдийн зөрж эхэлсэн. Дүрсийг
   гурван газар дахин бичих нь тэр зөрүүг гүнзгийрүүлэх байлаа. */

/* ─── Талбарын гадаргуу — ХОЁР горимд ажиллах ёстой ────────────────────
   `bg-[#141414]` байсан. Шөнөд зөв (карт #141416-аас цайвар), гэрэлд ГАМШИГ:
   #141414 ба #141416 хоёулаа гэрэл давхаргад `--l-surface` (#FFFFFF) руу
   буудаг тул талбар нь картын дэвсгэртэй ЯГ ИЖИЛ болж, дөрвөн талбар
   бүхэлдээ алга болов — цагаан дээр цагаан. Браузераас олдсон.

   #1E1E1E нь `--l-surface-2` (#EEEBE7) руу буудаг: шөнөд картаас цайвар,
   өдөр картаас бараан — хоёуланд нь ХАРАГДАНА.

   `focus:bg-*` устгасан: фокусын дохиог accent цагираг аль хэдийн бүрэн
   өгч байгаа бөгөөд өнгө сольсноор дахин нэг гэрэл/шөнө хос утга барих
   шаардлага үүсгэх нь зөвхөн эвдрэх шинэ боломж нэмнэ. */
export const authFieldClass =
  "h-12 w-full rounded-[4px] bg-[#1E1E1E] pl-11 pr-4 text-[15px] text-white outline-none " +
  "transition placeholder:text-[#E2E4E8] focus:ring-2 focus:ring-[#2E29FF]";

type AuthFieldProps = React.InputHTMLAttributes<HTMLInputElement> & { icon: IconName };

/** Дүрстэй талбар. Дүрс нь `pointer-events-none` — түүн дээр дарсан ч хулгана
    доорх талбарт хүрнэ, эс бөгөөс зүүн ирмэг нь дарагдахгүй бүс болно. */
export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(
  function AuthField({ icon, className, ...rest }, ref) {
    return (
      <div className="relative">
        <Icon
          name={icon}
          size={20}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#E2E4E8]"
        />
        <input ref={ref} {...rest} className={className ?? authFieldClass} />
      </div>
    );
  }
);

export type Gender = "male" | "female" | "";

/** Хоёр сонголт — segmented. Радио товчны оронд: хоёрхон сонголттой үед
    жагсаалт нь шаардлагагүй, зэрэгцүүлбэл нэг харцаар сонгоно. */
export function GenderPicker({
  value,
  onChange,
}: {
  value: Gender;
  onChange: (g: Gender) => void;
}) {
  const OPTIONS: { v: Exclude<Gender, "">; label: string }[] = [
    { v: "male", label: "Эрэгтэй" },
    { v: "female", label: "Эмэгтэй" },
  ];
  return (
    <div role="group" aria-label="Хүйс">
      <div className="mb-2 text-[12px] text-[#E2E4E8]">Хүйс</div>
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map((o) => {
          const on = value === o.v;
          return (
            <button
              key={o.v}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(o.v)}
              className={`flex h-12 items-center justify-center gap-2 rounded-[4px] text-[14px] font-semibold transition ${
                on
                  ? "bg-[#2E29FF] text-white"
                  : "bg-[#1E1E1E] text-[#E2E4E8] hover:bg-[#2C2C31]"
              }`}
            >
              {on && <Icon name="check" size={16} />}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** "эсвэл" хуваагч — Google товч ба нууц үгийн маягтын хооронд. */
export function AuthDivider({ label = "эсвэл" }: { label?: string }) {
  return (
    <div className="my-5 flex items-center gap-3">
      <span className="h-px flex-1 bg-[rgba(255,255,255,0.10)]" />
      <span className="text-[11px] text-[#E2E4E8]">{label}</span>
      <span className="h-px flex-1 bg-[rgba(255,255,255,0.10)]" />
    </div>
  );
}
