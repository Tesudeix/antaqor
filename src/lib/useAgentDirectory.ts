"use client";

/* ─── Агентын лавлах — клиент тал ────────────────────────────────────────
   Урсгал дээрх пост агентын нэрээр гарахдаа түүний ЗУРГИЙГ харуулах ёстой.
   Өмнө нь `PostCard` кодын `findAgent()`-г дууддаг байсан бөгөөд тэнд
   админаас байршуулсан зураг ХЭЗЭЭ Ч байхгүй — тиймээс урсгал дээр агент
   зөвхөн үсгэн хавтангаар харагддаг байв.

   Энэ hook нь `/api/agents`-ыг сесс тутамд НЭГ л удаа татна: модулийн
   түвшний promise кэш. Урсгал дээр 20 пост байвал 20 дуудлага явуулах нь
   утгагүй — лавлах бүх картад ижил. */

import { useEffect, useState } from "react";

export interface DirectoryAgent {
  slug: string;
  name: string;
  handle: string;
  role: string;
  color: string;
  avatar: string;
}

type Directory = Record<string, DirectoryAgent>;

let cache: Directory | null = null;
let inflight: Promise<Directory> | null = null;
/* Дахин дуудагдахад дахин зурагдах шаардлагатай бүрэлдэхүүнүүд. */
const listeners = new Set<(d: Directory) => void>();

async function load(): Promise<Directory> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch("/api/agents")
    .then((r) => r.json())
    .then((d) => {
      const map: Directory = {};
      for (const a of (d?.agents || []) as DirectoryAgent[]) map[a.slug] = a;
      cache = map;
      listeners.forEach((fn) => fn(map));
      return map;
    })
    .catch(() => {
      /* Лавлах ирээгүй нь урсгалыг зогсоох шалтгаан биш — пост нь кодын
         өнгө, нэрээрээ хэвийн зурагдана. */
      cache = {};
      return cache;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useAgentDirectory(): Directory {
  const [dir, setDir] = useState<Directory>(() => cache || {});
  useEffect(() => {
    let alive = true;
    const onLoad = (d: Directory) => alive && setDir(d);
    if (cache) {
      setDir(cache);
    } else {
      listeners.add(onLoad);
      load();
    }
    return () => {
      alive = false;
      listeners.delete(onLoad);
    };
  }, []);
  return dir;
}
