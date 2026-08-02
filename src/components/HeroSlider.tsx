"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface Slide {
  url: string;
  type: "image" | "video";
}

export default function HeroSlider() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [musicUrl, setMusicUrl] = useState("/fire-again.mp3");
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [current, setCurrent] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch slides and music from admin API
  useEffect(() => {
    fetch("/api/hero/slides")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.slides)) setSlides(d.slides);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
    fetch("/api/hero/music")
      .then((r) => r.json())
      .then((d) => {
        if (d.url) setMusicUrl(d.url);
        if (d.enabled === false) setMusicEnabled(false);
      })
      .catch(() => {});
  }, []);

  // Auto-play music on first user interaction
  useEffect(() => {
    if (!musicEnabled) return;
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
  }, [hasInteracted, musicEnabled]);

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
      // 8s gives every slide enough dwell-time to read the headline + scan the
      // visual. 5s was clipping slide 2 for most users (measured by GA4 view
      // events on slide-bound CTAs).
      timerRef.current = setInterval(() => {
        setCurrent((prev) => (prev + 1) % slides.length);
      }, 8000);
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
    // Pause auto-advance while the user is actively engaging with the slider.
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) {
      goTo(current + (dx < 0 ? 1 : -1));
    }
    // Whether they swiped or just tapped, restart auto-advance with a fresh
    // 8s window so slow readers don't get cut off mid-thought.
    resetTimer();
  };

  // Skeleton — shown while fetching, OR if admin has set zero slides.
  // Replaces the old duplicated /hero-1.jpg fallback with a clean shimmer.
  if (!loaded || slides.length === 0) {
    return (
      <div className="w-full">
        <div
          className="relative h-[calc(100dvh-53px)] min-h-[520px] w-full overflow-hidden bg-black"
        >
          {/* Base shimmer layer */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#FFFFFF] via-[#FFFFFF] to-[#FFFFFF]" />
          {/* Sweeping shimmer */}
          <div
            className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[rgba(0,0,0,0.045)] to-transparent"
            style={{ animation: "antaqorShimmer 1.6s ease-in-out infinite" }}
          />
          {/* Quiet loader — no wordmark */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-2 w-2 animate-pulse rounded-full bg-[#1080CA]" />
          </div>
          <style jsx>{`
            @keyframes antaqorShimmer {
              0%   { transform: translateX(-100%); }
              100% { transform: translateX(100%); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {musicEnabled && <audio ref={audioRef} src={musicUrl} loop preload="auto" />}

      <div
        className="relative h-[calc(100dvh-53px)] min-h-[520px] w-full overflow-hidden bg-black"
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
                <img
                  src={slide.url}
                  alt="Antaqor"
                  loading={i === 0 ? "eager" : "lazy"}
                  fetchPriority={i === 0 ? "high" : "auto"}
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={(e) => {
                    const img = e.currentTarget;
                    if (!img.dataset.retried) {
                      img.dataset.retried = "1";
                      img.src = img.src + (img.src.includes("?") ? "&" : "?") + "t=" + Date.now();
                    }
                  }}
                />
              )}
              {/* Lightened scrim — just enough to keep the pager dots legible
                  over bright photos now that the dark wordmark plate is gone. */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[rgba(0,0,0,0.26)]" />
            </div>
          ))}
        </div>

        {/* Wordmark + eyebrow removed from the hero entirely — the slider is
            now a clean full-bleed visual; brand identity carries via the
            global Unbounded type system, not an overlaid label. */}

        {/* Music toggle */}
        {musicEnabled && (
          <button
            onClick={toggleMusic}
            className="absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-none bg-black/55 shadow-sm backdrop-blur-md transition hover:bg-black/75"
            aria-label={isPlaying ? "Хөгжим зогсоох" : "Хөгжим тоглуулах"}
          >
            {isPlaying ? (
              <svg className="h-4 w-4 text-[#1080CA]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg className="h-4 w-4 text-[#1080CA]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        )}

        {/* Music visualizer */}
        {musicEnabled && isPlaying && (
          <div className="absolute left-12 top-4.5 z-10 flex items-end gap-[2px]">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-[3px] rounded-none bg-[#1080CA]"
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
                className={`h-[6px] rounded-none transition-all duration-300 ${
                  i === current
                    ? "w-[18px] bg-[#1080CA]"
                    : "w-[6px] bg-[rgba(15,23,38,0.22)]"
                }`}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
