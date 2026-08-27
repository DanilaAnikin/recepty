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
  // Odkaz, který se nepodařilo načíst (smazaná fotka na cizím webu, offline).
  // Bez tohohle by po nezdaru zůstal jen prázdný rámeček.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
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

  const candidateUrl = isBlobKey
    ? resolved && resolved.key === source
      ? resolved.url
      : null
    : (source ?? null);
  const displayUrl = candidateUrl && candidateUrl === failedUrl ? null : candidateUrl;
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
        sizes={large ? "(max-width: 700px) 100vw, 156px" : "96px"}
        unoptimized
        // Object URL i data URL jsou lokální; `next/image` je nemá optimalizovat.
        onError={() => setFailedUrl(displayUrl)}
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
 * Virtualizace svislého seznamu.
 *
 * Seznam ingrediencí má přes 300 položek a překresloval se celý při každém
 * stisku klávesy ve vyhledávání. Tady se vykreslí jen to, co je vidět,
 * plus `overscan` řádků nad a pod.
 *
 * `rowHeight` smí být i funkce — seznam ingrediencí střídá nadpisy písmen
 * a samotné řádky, které mají různou výšku.
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
  rowHeight: number | ((item: T, index: number) => number);
  /**
   * Výška okna seznamu. Číslo = pixely, řetězec = libovolná CSS hodnota
   * (`min(70dvh, 640px)`), aby se dala svázat s výškou obrazovky. Skutečná
   * výška se stejně měří přes ResizeObserver, tohle je jen strop.
   */
  maxHeight: number | string;
  overscan?: number;
  renderRow: (item: T, index: number) => ReactNode;
  emptyState?: ReactNode;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  // Než ResizeObserver změří skutečnou výšku, počítá se s rozumným odhadem.
  const fallbackHeight = typeof maxHeight === "number" ? maxHeight : 480;
  const [viewportHeight, setViewportHeight] = useState(fallbackHeight);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === "undefined") {
      return;
    }
    // ResizeObserver se ozve hned při `observe`, takže počáteční rozměr
    // změříme z jeho callbacku a nemusíme sahat na stav přímo v efektu.
    const observer = new ResizeObserver(() => {
      setViewportHeight(node.clientHeight || fallbackHeight);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [fallbackHeight]);

  /** Kumulativní posuny řádků; `offsets[i]` je horní hrana i-tého řádku. */
  const { offsets, totalHeight } = useMemo(() => {
    const result = new Array<number>(items.length + 1);
    result[0] = 0;
    for (let index = 0; index < items.length; index += 1) {
      const height = typeof rowHeight === "function" ? rowHeight(items[index], index) : rowHeight;
      result[index + 1] = result[index] + height;
    }
    return { offsets: result, totalHeight: result[items.length] };
  }, [items, rowHeight]);

  const { startIndex, endIndex } = useMemo(() => {
    if (items.length === 0) {
      return { startIndex: 0, endIndex: 0 };
    }

    // Po zúžení filtru může být uložená pozice za koncem kratšího seznamu.
    // Ořízneme ji při výpočtu — je to levnější a spolehlivější než dorovnávat
    // scroll v efektu, který by vyvolal další render.
    const effectiveScrollTop = Math.min(scrollTop, Math.max(0, totalHeight - viewportHeight));

    // Binární vyhledání prvního řádku, který ještě zasahuje do viewportu.
    let low = 0;
    let high = items.length - 1;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (offsets[middle + 1] <= effectiveScrollTop) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }

    const start = Math.max(0, low - overscan);
    const viewportBottom = effectiveScrollTop + viewportHeight;
    let end = start;
    while (end < items.length && offsets[end] < viewportBottom) {
      end += 1;
    }

    return { startIndex: start, endIndex: Math.min(items.length, end + overscan) };
  }, [items.length, offsets, overscan, scrollTop, totalHeight, viewportHeight]);

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
      <div style={{ height: totalHeight, position: "relative" }}>
        <div
          style={{
            position: "absolute",
            top: offsets[startIndex],
            left: 0,
            right: 0,
          }}
        >
          {visible.map((item, offset) => {
            const index = startIndex + offset;
            return (
              <div
                key={index}
                style={{ height: offsets[index + 1] - offsets[index] }}
                className="virtual-row"
              >
                {renderRow(item, index)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
