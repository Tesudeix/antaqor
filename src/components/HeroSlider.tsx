"use client";

import { useEffect, useState, useRef, useCallback } from "react";

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
        if (d.slides && d.slides.length > 0) {
          setSlides(d.slides);
        }
      })
      .catch(() => {});
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
      {musicEnabled && <audio ref={audioRef} src={musicUrl} loop preload="auto" />}

      <div
        className="relative w-full overflow-hidden rounded-[4px] bg-[#141414] shadow-[0_2px_16px_rgba(0,0,0,0.3)]"
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
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[rgba(0,0,0,0.5)]" />
            </div>
          ))}
        </div>

        {/* Logo overlay + social icons */}
        <div className="absolute bottom-6 left-5 right-5 z-10 flex items-end justify-between">
          <div>
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
          <div className="flex items-center gap-1.5">
            {[
              { href: "https://www.facebook.com/Tesudeixx/", label: "Facebook", d: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" },
              { href: "https://www.instagram.com/antaqor", label: "Instagram", d: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" },
              { href: "https://www.youtube.com/@Antaqorconqueror", label: "YouTube", d: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" },
              { href: "https://www.threads.com/@tesudeix", label: "Threads", d: "M16.556 12.65c-.068-.032-.137-.063-.207-.092a8.2 8.2 0 00-.229-.788c-.681-1.93-2.062-3.07-3.872-3.107h-.048c-1.083 0-1.972.44-2.572 1.272l1.088.764c.418-.58.975-.747 1.484-.747h.032c.573.004 1.006.17 1.286.495.204.236.34.563.41.98a10.5 10.5 0 00-1.62-.065c-2.278.132-3.744 1.46-3.634 3.288.056.927.502 1.724 1.254 2.244.636.44 1.454.654 2.3.605 1.116-.064 1.99-.466 2.6-1.196.462-.554.755-1.27.888-2.168.532.321.928.742 1.148 1.261.374.883.396 2.332-.82 3.548-1.068 1.067-2.352 1.529-4.31 1.543-2.172-.016-3.814-.713-4.881-2.074-.996-1.27-1.51-3.09-1.527-5.413.017-2.323.531-4.143 1.527-5.413 1.067-1.36 2.709-2.058 4.881-2.074 2.19.016 3.857.718 4.955 2.085.54.673.942 1.517 1.2 2.504l1.264-.335A8.3 8.3 0 0017.1 4.99C15.78 3.405 13.87 2.6 11.594 2.58h-.017C9.304 2.6 7.408 3.408 6.12 5.002 4.607 6.934 3.838 9.547 3.82 12.828v.012c.018 3.281.787 5.894 2.3 7.826 1.288 1.594 3.184 2.402 5.457 2.422h.017c2.326-.016 3.935-.614 5.29-1.97 1.744-1.744 1.66-3.928 1.107-5.233-.397-.935-1.16-1.694-2.204-2.196l-.23-.039zm-3.877 3.343c-.935.054-1.909-.367-1.96-1.218-.037-.63.447-1.332 2.136-1.43.187-.011.37-.016.55-.016.495 0 .957.048 1.376.141-.157 2.07-1.15 2.467-2.102 2.523z" },
            ].map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-white/20 text-white/70 backdrop-blur-sm transition hover:bg-white/30 hover:text-white" aria-label={s.label}>
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><path d={s.d} /></svg>
              </a>
            ))}
          </div>
        </div>

        {/* Music toggle */}
        {musicEnabled && (
          <button
            onClick={toggleMusic}
            className="absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-[4px] bg-black/60 shadow-sm backdrop-blur-sm transition hover:bg-black/80"
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
        )}

        {/* Music visualizer */}
        {musicEnabled && isPlaying && (
          <div className="absolute left-12 top-4.5 z-10 flex items-end gap-[2px]">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-[3px] rounded-[4px] bg-[#EF2C58]"
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
                className={`h-[6px] rounded-[4px] transition-all duration-300 ${
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
          <div className="absolute right-3 top-3 z-10 rounded-[4px] bg-black/60 px-[10px] py-[3px] text-[10px] font-extrabold text-[#CCCCCC] shadow-sm backdrop-blur-sm">
            {current + 1} / {slides.length}
          </div>
        )}
      </div>
    </div>
  );
}
