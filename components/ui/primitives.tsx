"use client";

import { AlertTriangle, ChefHat, Plus, Star } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { getImageUrl } from "@/lib/storage";
import { Modal } from "./modal";

/** Prázdný stav sekce s výzvou k akci. */
export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      <ChefHat size={34} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{message}</p>
      {actionLabel && onAction ? (
        <button type="button" className="primary-button" onClick={onAction}>
          <Plus size={16} aria-hidden="true" />
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="secondary-button" onClick={onCancel}>
            Zrušit
          </button>
          <button type="button" className="primary-button danger-fill" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="confirm-body">
        <AlertTriangle className="confirm-icon" size={22} aria-hidden="true" />
        <p className="confirm-message">{message}</p>
      </div>
    </Modal>
  );
}

/**
 * Fotka receptu.
 *
 * Zvládne tři podoby zdroje, protože data vznikala postupně:
 * - `img_...` klíč fotky uložené jako Blob v IndexedDB (aktuální způsob),
 * - `https://...` odkaz z výchozích receptů,
 * - `data:image/...` stará data URL z dřívějších verzí.
 */
export function RecipeImage({
  source,
  alt,
  large = false,
}: {
  source: string | null | undefined;
  alt: string;
  large?: boolean;
}) {
  // Výsledek se drží spolu s klíčem, ke kterému patří. Bez toho by při přepnutí
  // na jiný recept na okamžik problikla fotka toho předchozího — a resetovat to
  // v efektu by znamenalo render navíc.
  const [resolved, setResolved] = useState<{ key: string; url: string | null } | null>(null);
  const isBlobKey = typeof source === "string" && source.startsWith("img_");

  useEffect(() => {
    if (!isBlobKey || !source) {
      return;
    }

    let cancelled = false;
    void getImageUrl(source).then((url) => {
      if (!cancelled) {
        setResolved({ key: source, url });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [source, isBlobKey]);

  const displayUrl = isBlobKey
    ? resolved && resolved.key === source
      ? resolved.url
      : null
    : (source ?? null);
  const className = large ? "recipe-image large" : "recipe-image";

  if (!displayUrl) {
    return (
      <div className={className} aria-hidden="true">
        <ChefHat size={large ? 34 : 24} />
      </div>
    );
  }

  return (
    <div className={className}>
      <Image
        src={displayUrl}
        alt={alt}
        fill
        sizes={large ? "156px" : "96px"}
        unoptimized
        // Object URL i data URL jsou lokální; `next/image` je nemá optimalizovat.
      />
    </div>
  );
}

/** Hodnocení hvězdičkami. Bez `onChange` je jen pro čtení. */
export function StarRating({
  value,
  onChange,
  size = 18,
  label = "Hodnocení",
}: {
  value: number | null;
  onChange?: (next: number) => void;
  size?: number;
  label?: string;
}) {
  const rounded = value === null ? 0 : Math.round(value);

  if (!onChange) {
    return (
      <span className="star-rating" aria-label={value === null ? "Bez hodnocení" : `${rounded} z 5`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={size}
            aria-hidden="true"
            className={star <= rounded ? "star filled" : "star"}
          />
        ))}
      </span>
    );
  }

  return (
    <span className="star-rating interactive" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={star === rounded}
          aria-label={`${star} z 5`}
          className="star-button"
          onClick={() => onChange(star === rounded ? 0 : star)}
        >
          <Star size={size} aria-hidden="true" className={star <= rounded ? "star filled" : "star"} />
        </button>
      ))}
    </span>
  );
}

/**
 * Jednoduchá virtualizace svislého seznamu s pevnou výškou řádku.
 *
 * Seznam ingrediencí má přes 300 položek a překresloval se celý při každém
 * stisku klávesy ve vyhledávání. Tady se vykreslí jen to, co je vidět,
 * plus `overscan` řádků nad a pod.
 */
export function VirtualList<T>({
  items,
  rowHeight,
  maxHeight,
  overscan = 6,
  renderRow,
  emptyState,
  className,
}: {
  items: T[];
  rowHeight: number;
  maxHeight: number;
  overscan?: number;
  renderRow: (item: T, index: number) => ReactNode;
  emptyState?: ReactNode;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(maxHeight);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === "undefined") {
      return;
    }
    // ResizeObserver se ozve hned při `observe`, takže počáteční rozměr
    // změříme z jeho callbacku a nemusíme sahat na stav přímo v efektu.
    const observer = new ResizeObserver(() => {
      setViewportHeight(node.clientHeight || maxHeight);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [maxHeight]);

  const { startIndex, endIndex } = useMemo(() => {
    // Po zúžení filtru může být uložená pozice za koncem kratšího seznamu.
    // Ořízneme ji při výpočtu — je to levnější a spolehlivější než dorovnávat
    // scroll v efektu, který by vyvolal další render.
    const maxScrollTop = Math.max(0, items.length * rowHeight - viewportHeight);
    const effectiveScrollTop = Math.min(scrollTop, maxScrollTop);

    const visibleCount = Math.ceil(viewportHeight / rowHeight);
    const start = Math.max(0, Math.floor(effectiveScrollTop / rowHeight) - overscan);
    const end = Math.min(items.length, start + visibleCount + overscan * 2);
    return { startIndex: start, endIndex: end };
  }, [items.length, overscan, rowHeight, scrollTop, viewportHeight]);

  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  const visible = items.slice(startIndex, endIndex);

  return (
    <div
      ref={containerRef}
      className={className ? `virtual-list ${className}` : "virtual-list"}
      style={{ maxHeight }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div style={{ height: items.length * rowHeight, position: "relative" }}>
        <div
          style={{
            position: "absolute",
            top: startIndex * rowHeight,
            left: 0,
            right: 0,
          }}
        >
          {visible.map((item, offset) => (
            <div key={startIndex + offset} style={{ height: rowHeight }} className="virtual-row">
              {renderRow(item, startIndex + offset)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
