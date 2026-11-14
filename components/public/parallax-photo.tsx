"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";

import { parallaxShift } from "@/lib/motion";

/**
 * A decorative photo that fills its (relatively positioned, overflow-hidden)
 * parent and drifts slowly as the parent scrolls through the window, so content
 * on top of it appears to float. Stays still when reduced motion is requested.
 */
export function ParallaxPhoto({ src, sizes = "100vw" }: { src: string; sizes?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  // 0 when the section's top reaches the bottom of the window, 1 when its bottom leaves the top
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], parallaxShift);

  return (
    <div ref={ref} aria-hidden className="absolute inset-0 -z-20 overflow-hidden">
      {/* Taller than the section, so its edges never show while it moves */}
      <motion.div
        style={reduceMotion ? undefined : { y }}
        className="absolute inset-x-0 -inset-y-[18%] will-change-transform"
      >
        <Image src={src} alt="" fill sizes={sizes} className="object-cover" />
      </motion.div>
    </div>
  );
}
