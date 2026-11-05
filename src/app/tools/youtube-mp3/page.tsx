import { redirect } from "next/navigation";

/* 2026-10-05: Энэ хуудас гуравдагч талын олон нийтийн API-уудыг
   (cobalt, co.wuk.sh, loader.to) дараалан оролддог байв. Бүгд унасан
   бөгөөд хамгийн сүүлийн нөөц нь хэрэглэгчийг y2mate.com руу
   гардуулдаг — өөрөөр хэлбэл antaqor.com өөрийн хэрэглэгчээ гадны зар
   дүүрэн сайтад дамжуулж байлаа. Хэмжиж баталсан: `redirect: true`.

   Одоо ажиллаж байгаа хэрэгсэл рүү чиглүүлнэ. Хуучин хувилбар нь
   page.tsx.bak.* болж хадгалагдсан. */
export default function YoutubeMp3Redirect() {
  redirect("/tools/youtube?f=mp3");
}
