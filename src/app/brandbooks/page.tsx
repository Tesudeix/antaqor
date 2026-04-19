"use client";

import Link from "next/link";

interface BrandBook {
  slug: string;
  name: string;
  nameMn: string;
  tagline: string;
  version: string;
  year: number;
  color: string;
  icon: string;
}

const brandbooks: BrandBook[] = [
  {
    slug: "subudei",
    name: "СҮБЭЭДЭЙ",
    nameMn: "Subudei",
    tagline: "Нүүдлийн ухаалаг орон зай",
    version: "v2.0",
    year: 2026,
    color: "#C8943A",
    icon: "🏹",
  },
];

export default function BrandbooksPage() {
  return (
    <div className="py-6">
      {/* Header */}
      <div className="mb-10">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[4px] text-[#C8943A]">
          Antaqor
        </p>
        <h1 className="text-[28px] font-bold leading-tight text-[#1A1A1A]">
          Brand Books
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[#888888]">
          Antaqor-ын бүтээгдэхүүн, брэндүүдийн дизайн удирдамж
        </p>
      </div>

      {/* Grid */}
      <div className="grid gap-4">
        {brandbooks.map((book) => (
          <Link
            key={book.slug}
            href={`/brandbooks/${book.slug}`}
            className="group relative overflow-hidden rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#FFFFFF] p-6 transition hover:border-[#2a2a34] hover:bg-[#0e0e14]"
          >
            {/* Background accent */}
            <div
              className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-[0.04] transition-opacity group-hover:opacity-[0.08]"
              style={{ background: book.color }}
            />

            <div className="flex items-start justify-between">
              <div>
                <div className="mb-1 flex items-center gap-3">
                  <span className="text-2xl">{book.icon}</span>
                  <div>
                    <h2
                      className="text-[18px] font-bold tracking-[2px]"
                      style={{ color: book.color }}
                    >
                      {book.name}
                    </h2>
                    <p className="text-[11px] uppercase tracking-[2px] text-[#888888]">
                      {book.nameMn}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-[14px] italic text-[#9E9EA8]">
                  {book.tagline}
                </p>
              </div>

              <div className="flex flex-col items-end gap-1">
                <span className="rounded-[4px] bg-[rgba(0,0,0,0.08)] px-2 py-0.5 text-[10px] font-medium text-[#888888]">
                  {book.version}
                </span>
                <span className="text-[10px] text-[#AAAAAA]">{book.year}</span>
              </div>
            </div>

            {/* Chapters preview */}
            <div className="mt-5 flex flex-wrap gap-2">
              {[
                "Эх Үүсвэр",
                "Лого",
                "Өнгө",
                "Үсэг",
                "Үнэт Зүйлс",
                "Уриа",
                "Дуу Хоолой",
                "Визуал",
                "Хэрэглээ",
              ].map((ch) => (
                <span
                  key={ch}
                  className="rounded-[4px] bg-[#14141a] px-2 py-0.5 text-[10px] text-[#AAAAAA]"
                >
                  {ch}
                </span>
              ))}
            </div>

            {/* Arrow */}
            <div className="mt-4 text-right text-[12px] text-[#AAAAAA] transition group-hover:text-[#888888]">
              Дэлгэрэнгүй &rarr;
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
