"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { ThemeModeOption } from "@/lib/domain";

const OPTIONS: Array<{ value: ThemeModeOption; label: string; icon: typeof Sun }> = [
  { value: "system", label: "Podle systému", icon: Monitor },
  { value: "light", label: "Světlý režim", icon: Sun },
  { value: "dark", label: "Tmavý režim", icon: Moon },
];

export function ThemeMenu({
  currentMode,
  onSelect,
}: {
  currentMode: ThemeModeOption;
  onSelect: (mode: ThemeModeOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleMouseDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const active = OPTIONS.find((option) => option.value === currentMode) ?? OPTIONS[0];
  const ActiveIcon = active.icon;

  return (
    <div className="theme-menu" ref={containerRef}>
      <button
        type="button"
        className="icon-button glass"
        onClick={() => setOpen((current) => !current)}
        aria-label={`Motiv: ${active.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <ActiveIcon size={18} aria-hidden="true" />
      </button>

      {open ? (
        <div className="theme-menu-panel" role="menu">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={option.value === currentMode}
                onClick={() => {
                  onSelect(option.value);
                  setOpen(false);
                }}
              >
                <Icon size={16} aria-hidden="true" />
                {option.label}
                {option.value === currentMode ? <span className="theme-menu-check">✓</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
