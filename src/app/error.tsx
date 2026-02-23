"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <div className="font-[Bebas_Neue] text-6xl tracking-[4px] text-[#cc2200]">
          ERROR
        </div>
        <p className="mt-4 text-[12px] text-[#5a5550]">
          Something went wrong. Please try again.
        </p>
        <div className="mt-6 flex gap-3 justify-center">
          <button onClick={() => reset()} className="btn-blood">
            Try Again
          </button>
          <button
            onClick={() => (window.location.href = "/")}
            className="btn-ghost"
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}
