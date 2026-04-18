"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";

const STATIC_SLIDES: { url: string; type: "image" | "video" }[] = [
  { url: "/hero-video.webm", type: "video" },
  { url: "/hero-1.jpg", type: "image" },
  { url: "/hero-2.jpg", type: "image" },
];

export default function HeroSlider() {
  const [current, setCurrent] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const slides = STATIC_SLIDES;

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

    // Try autoplay immediately
    const timer = setTimeout(tryPlay, 500);

    // Fallback: play on first user interaction
    const handleInteraction = () => {
      if (!hasInteracted) {
        tryPlay();
      }
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
      {/* Audio element */}
      <audio ref={audioRef} src="/fire-again.mp3" loop preload="auto" />

      {/* Slider */}
      <div
        className="hero-slider relative w-full overflow-hidden rounded-[4px]"
        style={{ aspectRatio: "3/4" }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Slides track */}
        <div
          className="flex h-full transition-transform duration-[550ms]"
          style={{
            transform: `translateX(-${current * 100}%)`,
            willChange: "transform",
          }}
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
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[rgba(10,10,10,0.85)]" />
            </div>
          ))}
        </div>

        {/* Logo overlay */}
        <div className="absolute bottom-6 left-5 right-5 z-10">
          <h1
            className="text-[36px] font-bold tracking-[0.12em] text-white sm:text-[48px]"
            style={{ textShadow: "0 2px 20px rgba(0,0,0,0.5)" }}
          >
            ANTAQOR
          </h1>
          <p className="mt-1 text-[12px] font-semibold tracking-[0.2em] uppercase text-[#FFFF01]">
            Cyber Empire
          </p>
        </div>

        {/* Music toggle button */}
        <button
          onClick={toggleMusic}
          className="absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(0,0,0,0.6)] backdrop-blur-sm transition hover:bg-[rgba(0,0,0,0.8)]"
          aria-label={isPlaying ? "Хөгжим зогсоох" : "Хөгжим тоглуулах"}
        >
          {isPlaying ? (
            <svg className="h-4 w-4 text-[#FFFF01]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg className="h-4 w-4 text-[#FFFF01]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Music visualizer bars when playing */}
        {isPlaying && (
          <div className="absolute left-12 top-4.5 z-10 flex items-end gap-[2px]">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-[3px] rounded-full bg-[#FFFF01]"
                style={{
                  animation: `musicBar 0.${3 + i}s ease-in-out infinite alternate`,
                  height: `${8 + i * 2}px`,
                }}
              />
            ))}
          </div>
        )}

        {/* Shimmer effect */}
        <div className="hero-shimmer pointer-events-none absolute inset-0 z-20" />

        {/* Gold glow border pulse */}
        <div className="hero-glow pointer-events-none absolute inset-0 z-20 rounded-[4px]" />

        {/* Dots */}
        {slides.length > 1 && (
          <div className="absolute bottom-6 right-5 z-10 flex items-center gap-[5px]">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  goTo(i);
                  resetTimer();
                }}
                className={`h-[6px] rounded-full transition-all duration-300 ${
                  i === current
                    ? "w-[18px] bg-[#FFFF01]"
                    : "w-[6px] bg-[rgba(255,255,255,0.35)]"
                }`}
              />
            ))}
          </div>
        )}

        {/* Counter */}
        {slides.length > 1 && (
          <div className="absolute right-3 top-3 z-10 rounded-full bg-[rgba(0,0,0,0.6)] px-[10px] py-[3px] text-[10px] font-extrabold text-[rgba(255,255,255,0.6)] backdrop-blur-sm">
            {current + 1} / {slides.length}
          </div>
        )}
      </div>
    </div>
  );
}
