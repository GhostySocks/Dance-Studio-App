"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";

import { fadeIn, scaleIn } from "@/lib/motion";
import { cn } from "@/lib/utils";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function ModalPanel({
  onClose,
  title,
  description,
  children,
  className,
}: {
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useId();
  const descriptionId = useId();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const panel = panelRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Move focus into the dialog, unless a child (autoFocus) already took it
    if (panel && !panel.contains(document.activeElement)) {
      const first = panel.querySelector<HTMLElement>(
        "input:not([disabled]):not([type='hidden']), select:not([disabled]), textarea:not([disabled])"
      );
      (first ?? panel).focus();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;

      // Keep Tab inside the dialog. Portalled popups (e.g. select menus) are left alone.
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null
      );
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        aria-hidden
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
        variants={fadeIn}
        initial={reduceMotion ? false : "hidden"}
        animate="visible"
        exit={reduceMotion ? undefined : "hidden"}
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        variants={scaleIn}
        initial={reduceMotion ? false : "hidden"}
        animate="visible"
        exit={reduceMotion ? undefined : "hidden"}
        className={cn(
          "relative z-50 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-background p-6 shadow-lg outline-none",
          className
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
        <h2 id={titleId} className={cn("pr-8 text-lg font-semibold", description ? "mb-1" : "mb-4")}>
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="mb-4 text-sm text-muted-foreground">
            {description}
          </p>
        )}
        {children}
      </motion.div>
    </div>
  );
}

/**
 * The app's modal dialog: labelled, closes on Escape or backdrop click, traps Tab,
 * locks page scroll, and returns focus to whatever opened it.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <ModalPanel onClose={onClose} title={title} description={description} className={className}>
          {children}
        </ModalPanel>
      )}
    </AnimatePresence>,
    document.body
  );
}
