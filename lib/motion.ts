import type { Variants } from "motion/react";

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.2 } },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

/**
 * How far a parallax background drifts (as a share of its own height) while its
 * section crosses the window. Small on purpose: it should be felt, not noticed.
 */
export const parallaxShift = ["-9%", "9%"];

/** How long a carousel stays on one page before moving to the next. */
export const CAROUSEL_INTERVAL_MS = 7000;

/**
 * Tiles of a carousel page. `custom` is the tile's position on the page, so the
 * tiles move one after another. Leaving, a tile tips back and lifts away;
 * arriving, it swings up from below (always from the same starting pose, wherever
 * it was left), after the old page has started to clear.
 */
export const carouselTile: Variants = {
  shown: (i: number) => ({
    opacity: [0, 1],
    y: [90, 0],
    rotateX: [-75, 0],
    scale: [0.8, 1],
    visibility: "visible",
    transition: { delay: 0.22 + i * 0.08, type: "spring", stiffness: 110, damping: 15, opacity: { delay: 0.22 + i * 0.08, duration: 0.3 } },
  }),
  away: (i: number) => ({
    opacity: 0,
    y: -70,
    rotateX: 70,
    scale: 0.82,
    transition: { delay: i * 0.06, duration: 0.4, ease: "easeIn" },
    transitionEnd: { visibility: "hidden" },
  }),
};

/** The same change with reduced motion: a plain cross-fade. */
export const carouselTileReduced: Variants = {
  shown: { opacity: 1, visibility: "visible", transition: { duration: 0.2 } },
  away: { opacity: 0, transition: { duration: 0.2 }, transitionEnd: { visibility: "hidden" } },
};

/** The home page hero artwork: its shapes arrive one after another. */
export const heroShapes: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
};

/** One shape of the hero artwork settling into place. */
export const heroShape: Variants = {
  hidden: { opacity: 0, scale: 0.8, y: 28 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 90, damping: 14 } },
};

/**
 * The slow drift of a hero shape once it has arrived. `order` gives each layer
 * its own pace and direction so they never move in step.
 */
export function heroDrift(order: number) {
  const up = order % 2 === 0 ? -1 : 1;
  return {
    y: [0, up * 9, 0],
    x: [0, -up * 5, 0],
    transition: { duration: 7 + order * 1.3, repeat: Infinity, ease: "easeInOut" as const, delay: 1.2 },
  };
}
