"use client";

import FeedSection from "@/components/FeedSection";

/* /feed — нүүртэй ижил урсгал. Бүх логик нь <FeedSection/> дотор, ингэснээр
   хоёр зам ялгарч салахгүй.

   Зочин энд ирвэл GuestGate нь `/feed`-ийг нээлттэй жагсаалтдаа оруулаагүй
   тул нүүр рүү буцаагаад нэвтрэх цонх нээнэ — тиймээс энд өөрийн гэсэн
   хамгаалалт хэрэггүй. */

export default function FeedPage() {
  return <FeedSection />;
}
