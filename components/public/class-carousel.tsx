"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { CAROUSEL_INTERVAL_MS, carouselTile, carouselTileReduced } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Shows one page of tiles at a time and moves to the next every few seconds.
 * On a change the tiles leave one after another, tipping away, and the next
 * page's tiles swing up into place in a wave. It stops while the pointer or
 * keyboard focus is inside it; with reduced motion it only cross-fades and does
 * not rotate by itself. Every page shares one grid cell, so the section keeps
 * the height of its tallest page and never jumps.
 */
export function ClassCarousel({
  pages,
  label,
  gridClassName,
}: {
  /** The tiles of each page */
  pages: React.ReactNode[][];
  label: string;
  /** Grid classes for a page of tiles */
  gridClassName: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useReducedMotion();
  const count = pages.length;
  const variants = reduceMotion ? carouselTileReduced : carouselTile;

  useEffect(() => {
    if (count < 2 || paused || reduceMotion) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % count), CAROUSEL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [count, paused, reduceMotion]);

  if (count === 0) return null;
  if (count === 1) return <div className={gridClassName}>{pages[0]}</div>;

  const go = (step: number) => setIndex((current) => (current + step + count) % count);
  const arrow =
    "flex h-10 w-10 items-center justify-center rounded-full border border-white/60 bg-white/85 text-foreground shadow-md backdrop-blur transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      <div className="grid">
        {pages.map((tiles, pageIndex) => {
          const active = pageIndex === index;
          return (
            <div
              key={pageIndex}
              role="group"
              aria-roledescription="slide"
              aria-label={`${pageIndex + 1} of ${count}`}
              aria-hidden={!active}
              className={cn("col-start-1 row-start-1", gridClassName, !active && "pointer-events-none")}
            >
              {tiles.map((tile, tileIndex) => (
                <motion.div
                  key={tileIndex}
                  custom={tileIndex}
                  variants={variants}
                  initial={false}
                  animate={active ? "shown" : "away"}
                  style={{ transformPerspective: 1100, transformOrigin: "50% 0%" }}
                  className="h-full will-change-transform"
                >
                  {tile}
                </motion.div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-center gap-4">
        <button type="button" className={arrow} onClick={() => go(-1)} aria-label="Previous classes">
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <div className="flex items-center gap-2">
          {pages.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show classes ${i + 1} of ${count}`}
              aria-current={i === index ? "true" : undefined}
              className={cn(
                "h-2.5 rounded-full shadow transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                i === index ? "w-7 bg-white" : "w-2.5 bg-white/55 hover:bg-white/80"
              )}
            />
          ))}
        </div>
        <button type="button" className={arrow} onClick={() => go(1)} aria-label="Next classes">
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
