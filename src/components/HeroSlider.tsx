"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";

const FALLBACK_SLIDES: { url: string; type: "image" | "video" }[] = [
  { url: "/hero-1.jpg", type: "image" },
  { url: "/hero-2.jpg", type: "image" },
];

interface Slide {
  url: string;
  type: "image" | "video";
}

export default function HeroSlider() {
  const [slides, setSlides] = useState<Slide[]>(FALLBACK_SLIDES);
  const [current, setCurrent] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch slides from admin API
  useEffect(() => {
    fetch("/api/hero/slides")
      .then((r) => r.json())
      .then((d) => {
        if (d.slides && d.slides.length > 0) {
          setSlides(d.slides);
        }
      })
      .catch(() => {});
  }, []);

  // Auto-play music on first user interaction
  useEffect(() => {
    const tryPlay = () => {
      if (audioRef.current && !hasInteracted) {
        audioRef.current.volume = 0.3;
        audioRef.current.play().then(() => {
          setIsPlaying(true);
          setHasInteracted(true);
        }).catch(() => {});
      }
    };

    const timer = setTimeout(tryPlay, 500);

    const handleInteraction = () => {
      if (!hasInteracted) tryPlay();
    };

    document.addEventListener("click", handleInteraction, { once: true });
    document.addEventListener("touchstart", handleInteraction, { once: true });
    document.addEventListener("scroll", handleInteraction, { once: true });

    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("touchstart", handleInteraction);
      document.removeEventListener("scroll", handleInteraction);
    };
  }, [hasInteracted]);

  const toggleMusic = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.volume = 0.3;
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        setHasInteracted(true);
      }).catch(() => {});
    }
  }, [isPlaying]);

  const goTo = useCallback(
    (idx: number) => {
      setCurrent(((idx % slides.length) + slides.length) % slides.length);
    },
    [slides.length]
  );

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (slides.length > 1) {
      timerRef.current = setInterval(() => {
        setCurrent((prev) => (prev + 1) % slides.length);
      }, 5000);
    }
  }, [slides.length]);

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [resetTimer]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) {
      goTo(current + (dx < 0 ? 1 : -1));
      resetTimer();
    }
  };

  return (
    <div className="w-full">
      <audio ref={audioRef} src="/fire-again.mp3" loop preload="auto" />

      <div
        className="relative w-full overflow-hidden rounded-[8px] bg-[#FFFFFF] shadow-[0_2px_16px_rgba(0,0,0,0.06)]"
        style={{ aspectRatio: "3/4" }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Slides */}
        <div
          className="flex h-full transition-transform duration-[550ms]"
          style={{ transform: `translateX(-${current * 100}%)`, willChange: "transform" }}
        >
          {slides.map((slide, i) => (
            <div key={i} className="relative h-full w-full flex-shrink-0">
              {slide.type === "video" ? (
                <video
                  src={slide.url}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <Image
                  src={slide.url}
                  alt="Antaqor"
                  fill
                  className="object-cover"
                  priority={i === 0}
                  sizes="(max-width: 640px) 100vw, 640px"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[rgba(0,0,0,0.5)]" />
            </div>
          ))}
        </div>

        {/* Logo overlay */}
        <div className="absolute bottom-6 left-5 right-5 z-10">
          <h1
            className="text-[36px] font-bold tracking-[0.12em] text-white sm:text-[48px]"
            style={{ textShadow: "0 2px 20px rgba(0,0,0,0.4)" }}
          >
            ANTAQOR
          </h1>
          <p className="mt-1 text-[12px] font-semibold tracking-[0.2em] uppercase text-[#EF2C58]"
            style={{ textShadow: "0 1px 8px rgba(0,0,0,0.3)" }}
          >
            Cyber Empire
          </p>
        </div>

        {/* Music toggle */}
        <button
          onClick={toggleMusic}
          className="absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 shadow-sm backdrop-blur-sm transition hover:bg-white"
          aria-label={isPlaying ? "Хөгжим зогсоох" : "Хөгжим тоглуулах"}
        >
          {isPlaying ? (
            <svg className="h-4 w-4 text-[#EF2C58]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg className="h-4 w-4 text-[#EF2C58]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Music visualizer */}
        {isPlaying && (
          <div className="absolute left-12 top-4.5 z-10 flex items-end gap-[2px]">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-[3px] rounded-full bg-[#EF2C58]"
                style={{
                  animation: `musicBar 0.${3 + i}s ease-in-out infinite alternate`,
                  height: `${8 + i * 2}px`,
                }}
              />
            ))}
          </div>
        )}

        {/* Dots */}
        {slides.length > 1 && (
          <div className="absolute bottom-6 right-5 z-10 flex items-center gap-[5px]">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => { goTo(i); resetTimer(); }}
                className={`h-[6px] rounded-full transition-all duration-300 ${
                  i === current
                    ? "w-[18px] bg-[#EF2C58]"
                    : "w-[6px] bg-white/40"
                }`}
              />
            ))}
          </div>
        )}

        {/* Counter */}
        {slides.length > 1 && (
          <div className="absolute right-3 top-3 z-10 rounded-full bg-white/80 px-[10px] py-[3px] text-[10px] font-extrabold text-[#666666] shadow-sm backdrop-blur-sm">
            {current + 1} / {slides.length}
          </div>
        )}
      </div>
    </div>
  );
}
