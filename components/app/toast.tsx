"use client";

import { RotateCcw } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Krátká hlášení u spodního okraje. Toast s akcí zůstává déle, aby se dalo
 * stihnout kliknout na "Zpět".
 */

export type ToastAction = {
  label: string;
  onClick: () => void;
};

export type ToastMessage = {
  id: number;
  message: string;
  action?: ToastAction;
  tone: "neutral" | "danger";
};

type ToastContextValue = {
  showToast: (message: string, options?: { action?: ToastAction; tone?: ToastMessage["tone"] }) => void;
  dismissToast: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const PLAIN_DURATION_MS = 2800;
const ACTION_DURATION_MS = 6000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback<ToastContextValue["showToast"]>((message, options) => {
    setToast({
      id: Date.now() + Math.random(),
      message,
      action: options?.action,
      tone: options?.tone ?? "neutral",
    });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timeout = window.setTimeout(
      () => setToast((current) => (current?.id === toast.id ? null : current)),
      toast.action ? ACTION_DURATION_MS : PLAIN_DURATION_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <div
          className={toast.tone === "danger" ? "toast toast-danger" : "toast"}
          role="status"
          aria-live="polite"
        >
          <span className="toast-message">{toast.message}</span>
          {toast.action ? (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                toast.action?.onClick();
                setToast(null);
              }}
            >
              <RotateCcw size={14} aria-hidden="true" />
              {toast.action.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast musí být uvnitř <ToastProvider>.");
  }
  return context;
}
