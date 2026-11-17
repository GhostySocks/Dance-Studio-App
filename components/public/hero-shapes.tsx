"use client";

import { motion, useReducedMotion } from "motion/react";

import { heroDrift, heroShape, heroShapes } from "@/lib/motion";
import { cn } from "@/lib/utils";

const PRIMARY = "hsl(var(--primary))";
const MINT = "hsl(var(--cta))";
const TEAL = "hsl(var(--domain-schedule-icon))";
const VERDIGRIS = "hsl(var(--domain-people-icon))";
const CREAM = "hsl(var(--domain-money))";

/**
 * The artwork beside the home page headline: a stage arch, a spotlight and a
 * few small shapes, in the brand colours. Purely decorative. The shapes settle
 * into place one after another and then drift very slowly; with reduced motion
 * it is a still picture.
 */
export function HeroShapes({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();

  /** One layer: arrives with the others, then drifts by itself. */
  const Layer = ({ order, children }: { order: number; children: React.ReactNode }) => (
    <motion.g variants={heroShape}>
      <motion.g animate={reduceMotion ? undefined : heroDrift(order)}>{children}</motion.g>
    </motion.g>
  );

  return (
    <motion.svg
      aria-hidden
      viewBox="0 0 480 480"
      className={cn("h-auto w-full overflow-visible", className)}
      variants={heroShapes}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
    >
      <defs>
        <linearGradient id="hero-arch" x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor={TEAL} />
          <stop offset="1" stopColor={PRIMARY} />
        </linearGradient>
        <clipPath id="hero-arch-clip">
          <path d="M214 446V196a108 108 0 0 1 216 0v250Z" />
        </clipPath>
      </defs>

      {/* Cream floor light */}
      <Layer order={0}>
        <circle cx="150" cy="338" r="118" fill={CREAM} />
      </Layer>

      {/* Mint spotlight */}
      <Layer order={1}>
        <circle cx="176" cy="150" r="86" fill={MINT} />
      </Layer>

      {/* Stage arch, with rings of light inside it */}
      <Layer order={2}>
        <path d="M214 446V196a108 108 0 0 1 216 0v250Z" fill="url(#hero-arch)" />
        <g clipPath="url(#hero-arch-clip)" fill="none" stroke="white">
          <circle cx="322" cy="196" r="70" strokeWidth="2" opacity="0.28" />
          <circle cx="322" cy="196" r="40" strokeWidth="2" opacity="0.36" />
          <circle cx="430" cy="446" r="96" fill={VERDIGRIS} stroke="none" opacity="0.85" />
          <circle cx="430" cy="446" r="58" fill={MINT} stroke="none" opacity="0.9" />
        </g>
      </Layer>

      {/* Small pieces */}
      <Layer order={3}>
        <circle cx="62" cy="214" r="22" fill="none" stroke={PRIMARY} strokeWidth="6" />
        <path d="M398 22c3 17 9 23 26 26-17 3-23 9-26 26-3-17-9-23-26-26 17-3 23-9 26-26Z" fill={MINT} />
        <g fill={PRIMARY} opacity="0.55">
          {[0, 1, 2, 3].flatMap((row) =>
            [0, 1, 2, 3].map((col) => (
              <circle key={`${row}-${col}`} cx={46 + col * 18} cy={398 + row * 18} r="3" />
            ))
          )}
        </g>
      </Layer>
    </motion.svg>
  );
}
