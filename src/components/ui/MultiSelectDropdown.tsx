"use client";

import { useEffect, useId, useRef, useState } from "react";

type MultiSelectDropdownProps = {
  label: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  emptyMessage?: string;
};

export function MultiSelectDropdown({
  label,
  options,
  value,
  onChange,
  placeholder = "Select options",
  hint,
  error,
  emptyMessage = "No options available yet. Ask the CEO to add some.",
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const buttonId = useId();
  const errorId = error ? `${buttonId}-error` : undefined;
  const hintId = hint ? `${buttonId}-hint` : undefined;

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function toggleOption(option: string) {
    if (value.includes(option)) {
      onChange(value.filter((item) => item !== option));
      return;
    }
    onChange([...value, option]);
  }

  const summary =
    value.length === 0
      ? placeholder
      : value.length <= 2
        ? value.join(", ")
        : `${value.slice(0, 2).join(", ")} +${value.length - 2} more`;

  return (
    <div ref={rootRef} className="relative flex w-full flex-col gap-1.5">
      <label htmlFor={buttonId} className="text-sm font-medium text-text">
        {label}
      </label>

      <button
        id={buttonId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-describedby={
          [errorId, hintId].filter(Boolean).join(" ") || undefined
        }
        onClick={() => setOpen((current) => !current)}
        className={[
          "flex min-h-11 w-full items-center justify-between gap-3 rounded-md border bg-surface px-3 py-2.5 text-left text-base transition-colors",
          error ? "border-error" : "border-border focus:border-primary",
          value.length === 0 ? "text-text-secondary" : "text-text",
        ].join(" ")}
      >
        <span className="truncate">{summary}</span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`shrink-0 text-text-secondary transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-20 max-h-56 overflow-y-auto rounded-md border border-border bg-surface p-1 shadow-[var(--shadow-card)]"
        >
          {options.length === 0 ? (
            <p className="px-3 py-3 text-sm text-text-secondary">{emptyMessage}</p>
          ) : (
            options.map((option) => {
              const selected = value.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => toggleOption(option)}
                  className={[
                    "flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm",
                    selected
                      ? "bg-surface-muted text-primary"
                      : "text-text hover:bg-surface-muted",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                      selected
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-surface",
                    ].join(" ")}
                    aria-hidden
                  >
                    {selected ? (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : null}
                  </span>
                  {option}
                </button>
              );
            })
          )}
        </div>
      ) : null}

      {hint && !error ? (
        <p id={hintId} className="text-xs text-text-secondary">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
