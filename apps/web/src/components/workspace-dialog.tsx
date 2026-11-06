"use client";

import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";

type Props = ComponentPropsWithoutRef<"section"> & { onClose: () => void; busy?: boolean; initialFocus?: "field" | "dialog" };

export function WorkspaceDialog({ children, onClose, busy = false, initialFocus = "field", ...props }: Props) {
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  const [restoreTarget] = useState(() => typeof document === "undefined" ? null : document.activeElement as HTMLElement | null);
  useEffect(() => { closeRef.current = onClose; busyRef.current = busy; }, [onClose, busy]);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const fields = () => Array.from(root.querySelectorAll<HTMLElement>(
      'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"]'
    )).filter(element => element.getClientRects().length > 0);
    const initial = root.querySelector<HTMLElement>('input:not([disabled]),select:not([disabled]),textarea:not([disabled])');
    (initialFocus === "dialog" ? root : initial || fields()[0] || root).focus();
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault(); event.stopPropagation();
        if (!busyRef.current) closeRef.current();
      }
      if (event.key !== "Tab") return;
      const elements = fields(), first = elements[0], last = elements[elements.length - 1];
      if (!first) { event.preventDefault(); root?.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root)) { event.preventDefault(); first.focus(); }
    }
    root.addEventListener("keydown", key);
    return () => {
      root.removeEventListener("keydown", key);
      document.body.style.overflow = previousOverflow;
      if (restoreTarget?.isConnected) restoreTarget.focus();
    };
  }, [restoreTarget, initialFocus]);
  return <section {...props} ref={ref} role="dialog" aria-modal="true" tabIndex={-1}>{children}</section>;
}
