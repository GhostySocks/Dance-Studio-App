"use client";

import { useState, useRef, useEffect, useCallback, useId } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";

interface Option {
  value: string;
  label: string;
}

interface StyledSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  maxHeight?: number;
  /** Accessible name. If omitted, a <label> next to the select is used, then the placeholder. */
  "aria-label"?: string;
}

export function StyledSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className,
  maxHeight,
  "aria-label": ariaLabel,
}: StyledSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [labelId, setLabelId] = useState<string>();
  const listId = useId();
  const fallbackLabelId = useId();

  // Most call sites put a plain <label> just before the select; use it as the name
  useEffect(() => {
    if (ariaLabel) return;
    const label = wrapperRef.current?.parentElement?.querySelector<HTMLElement>(":scope > label");
    if (!label) return;
    if (!label.id) label.id = fallbackLabelId;
    setLabelId(label.id);
  }, [ariaLabel, fallbackLabelId]);

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }, []);

  // Move focus into the list when it opens
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const list = dropdownRef.current;
      const target =
        list?.querySelector<HTMLElement>("[role=option][aria-selected=true]") ??
        list?.querySelector<HTMLElement>("[role=option]");
      target?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  function onListKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(
      dropdownRef.current?.querySelectorAll<HTMLElement>("[role=option]") ?? []
    );
    const index = items.indexOf(document.activeElement as HTMLElement);
    const focusAt = (i: number) => items[Math.max(0, Math.min(items.length - 1, i))]?.focus();

    switch (event.key) {
      case "Escape":
        // Close just the list, not a dialog it may be inside
        event.nativeEvent.stopPropagation();
        event.preventDefault();
        close(true);
        break;
      case "Tab":
        event.preventDefault();
        close(true);
        break;
      case "ArrowDown":
        event.preventDefault();
        focusAt(index + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusAt(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusAt(0);
        break;
      case "End":
        event.preventDefault();
        focusAt(items.length - 1);
        break;
    }
  }
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  const selectedLabel = options.find((o) => o.value === value)?.label ?? placeholder;

  const updatePosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      });
    }
  }, []);

  useEffect(() => {
    if (open) {
      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    }
  }, [open, updatePosition]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel ?? (labelId ? undefined : placeholder)}
        aria-labelledby={!ariaLabel && labelId ? `${labelId} ${listId}-value` : undefined}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-full border border-input bg-white px-4 py-1 text-sm shadow-sm transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          !value && "text-muted-foreground"
        )}
      >
        <span id={`${listId}-value`} className="truncate">
          {selectedLabel}
        </span>
        <ChevronDown aria-hidden className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={dropdownRef}
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: "fixed",
                  top: position.top,
                  left: position.left,
                  width: position.width,
                  zIndex: 9999,
                }}
                className="overflow-hidden rounded-2xl border border-border/50 bg-white shadow-lg"
              >
                <div
                  id={listId}
                  role="listbox"
                  aria-label={ariaLabel ?? placeholder}
                  onKeyDown={onListKeyDown}
                  className="py-1"
                  style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}
                >
                  {options.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={option.value === value}
                      tabIndex={-1}
                      onClick={() => {
                        onChange(option.value);
                        close(true);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
                        option.value === value && "bg-accent font-medium"
                      )}
                    >
                      <span className="flex-1 text-left truncate">{option.label}</span>
                      {option.value === value && (
                        <Check aria-hidden className="h-4 w-4 shrink-0 text-primary" />
                      )}
                    </button>
                  ))}
                  {options.length === 0 && (
                    <p className="px-4 py-3 text-sm text-muted-foreground text-center">No options</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
