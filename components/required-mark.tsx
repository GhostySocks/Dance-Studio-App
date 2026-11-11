/**
 * Marks a form label as required: a red asterisk for sighted users and the word
 * "required" for screen readers. Put it inside the label, after the text.
 */
export function RequiredMark() {
  return (
    <>
      <span aria-hidden className="-ml-1.5 text-destructive">
        *
      </span>
      <span className="sr-only">(required)</span>
    </>
  );
}

/** One line at the top of a form explaining the asterisk. */
export function RequiredNote({ className }: { className?: string }) {
  return (
    <p className={`text-xs text-muted-foreground ${className ?? ""}`}>
      <span aria-hidden className="text-destructive">
        *
      </span>{" "}
      Required
    </p>
  );
}
