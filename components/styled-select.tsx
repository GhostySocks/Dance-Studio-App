"use client";

import { useState, useRef, useEffect, useCallback, useId, useMemo } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Search } from "lucide-react";
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
  /** Tallest the list may grow, in pixels. It is also kept inside the window. */
  maxHeight?: number;
  /** Show a filter box above the options. Defaults to on for long lists. */
  searchable?: boolean;
  /** Accessible name. If omitted, a <label> next to the select is used, then the placeholder. */
  "aria-label"?: string;
}

const DEFAULT_MAX_HEIGHT = 320;
const SEARCH_THRESHOLD = 8;
const GAP = 6;
const EDGE = 12;
const SEARCH_BOX_HEIGHT = 44;

interface Placement {
  left: number;
  width: number;
  /** Set when opening downward. */
  top?: number;
  /** Set when opening upward (distance from the bottom of the window). */
  bottom?: number;
  listMaxHeight: number;
}

export function StyledSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className,
  maxHeight = DEFAULT_MAX_HEIGHT,
  searchable,
  "aria-label": ariaLabel,
}: StyledSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [placement, setPlacement] = useState<Placement>({ left: 0, width: 0, top: 0, listMaxHeight: maxHeight });
  const [labelId, setLabelId] = useState<string>();
  const listId = useId();
  const fallbackLabelId = useId();

  const showSearch = searchable ?? options.length > SEARCH_THRESHOLD;
  const selectedLabel = options.find((o) => o.value === value)?.label ?? placeholder;

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    // Every word typed must appear somewhere in the label
    const words = term.split(/\s+/);
    return options.filter((o) => {
      const label = o.label.toLowerCase();
      return words.every((w) => label.includes(w));
    });
  }, [options, query]);

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
    setQuery("");
    if (refocus) buttonRef.current?.focus();
  }, []);

  /**
   * Places the list under the button, or above it when there is more room there,
   * and never lets it run past the edge of the window: it scrolls inside instead.
   */
  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const chrome = showSearch ? SEARCH_BOX_HEIGHT : 0;
    const below = window.innerHeight - rect.bottom - GAP - EDGE;
    const above = rect.top - GAP - EDGE;
    const openUp = below < Math.min(maxHeight, 220) + chrome && above > below;
    const room = (openUp ? above : below) - chrome;

    setPlacement({
      left: rect.left,
      width: rect.width,
      ...(openUp ? { bottom: window.innerHeight - rect.top + GAP } : { top: rect.bottom + GAP }),
      listMaxHeight: Math.max(120, Math.min(maxHeight, room)),
    });
  }, [maxHeight, showSearch]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
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
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Move focus into the dropdown when it opens: the filter box if there is one
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      if (showSearch) {
        searchRef.current?.focus();
        return;
      }
      const list = dropdownRef.current;
      const target =
        list?.querySelector<HTMLElement>("[role=option][aria-selected=true]") ??
        list?.querySelector<HTMLElement>("[role=option]");
      target?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, showSearch]);

  const optionElements = () =>
    Array.from(dropdownRef.current?.querySelectorAll<HTMLElement>("[role=option]") ?? []);

  function choose(option: Option) {
    onChange(option.value);
    close(true);
  }

  function onListKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const items = optionElements();
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
        // From the first option, go back up to the filter box
        if (index <= 0 && showSearch) searchRef.current?.focus();
        else focusAt(index - 1);
        break;
      case "Home":
        if (document.activeElement === searchRef.current) break;
        event.preventDefault();
        focusAt(0);
        break;
      case "End":
        if (document.activeElement === searchRef.current) break;
        event.preventDefault();
        focusAt(items.length - 1);
        break;
    }
  }

  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (visible.length > 0) choose(visible[0]);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      optionElements()[0]?.focus();
    } else if (event.key === "ArrowUp") {
      // Nothing above the filter box
      event.preventDefault();
      event.stopPropagation();
    }
  }

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
        <ChevronDown
          aria-hidden
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
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
                onKeyDown={onListKeyDown}
                style={{
                  position: "fixed",
                  top: placement.top,
                  bottom: placement.bottom,
                  left: placement.left,
                  width: placement.width,
                  zIndex: 9999,
                }}
                className="overflow-hidden rounded-2xl border border-border/50 bg-white shadow-lg"
              >
                {showSearch && (
                  <div className="relative border-b border-border/60">
                    <Search
                      aria-hidden
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    />
                    <input
                      ref={searchRef}
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={onSearchKeyDown}
                      placeholder="Type to filter…"
                      aria-label={`Filter ${ariaLabel ?? placeholder}`}
                      aria-controls={listId}
                      autoComplete="off"
                      className="h-11 w-full bg-transparent pl-10 pr-4 text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                )}
                <div
                  id={listId}
                  role="listbox"
                  aria-label={ariaLabel ?? placeholder}
                  className="overflow-y-auto py-1"
                  style={{ maxHeight: placement.listMaxHeight }}
                >
                  {visible.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={option.value === value}
                      tabIndex={-1}
                      onClick={() => choose(option)}
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
                  {visible.length === 0 && (
                    <p role="status" className="px-4 py-3 text-sm text-muted-foreground text-center">
                      {options.length === 0 ? "No options" : "No matches"}
                    </p>
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
