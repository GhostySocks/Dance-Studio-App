import Image from "next/image";

import { cn } from "@/lib/utils";

/** The studio logo files in `public/images` (black on transparent). */
export const LOGOS = {
  /** Wide lockup, for headers and documents */
  horizontal: { src: "/images/logo-horizontal.png", width: 1000, height: 208 },
  /** Tall lockup, for sign-in pages and narrow spaces */
  stacked: { src: "/images/logo-stacked.png", width: 398, height: 500 },
} as const;

/**
 * The studio logo. Set the size with a height class (`h-9`); the width follows.
 * `alt` is the studio name, or "" when the name is written next to it.
 */
export function StudioLogo({
  variant = "horizontal",
  alt,
  className,
  priority,
}: {
  variant?: keyof typeof LOGOS;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  const logo = LOGOS[variant];
  return (
    <Image
      src={logo.src}
      width={logo.width}
      height={logo.height}
      alt={alt}
      priority={priority}
      unoptimized
      className={cn("w-auto", className)}
    />
  );
}
