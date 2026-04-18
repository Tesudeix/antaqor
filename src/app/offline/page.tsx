"use client";

export default function OfflinePage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <svg className="mb-6 h-16 w-16 text-[#FFFF01] opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728M12 9v4m0 4h.01" />
      </svg>
      <h1 className="text-[24px] font-bold text-[#FAFAFA]">Офлайн байна</h1>
      <p className="mt-2 max-w-xs text-[14px] text-[#6B6B6B]">
        Интернэт холболтгүй байна. Холболт сэргээгдмэгц автоматаар ачааллана.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-6 rounded-[4px] bg-[#FFFF01] px-6 py-2.5 text-[13px] font-bold text-[#0A0A0A]"
      >
        Дахин оролдох
      </button>
    </div>
  );
}
