"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLinks } from "@/components/NavLinks";
import { IdentitySwitcher } from "@/components/IdentitySwitcher";

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Move focus into the drawer on open, trap Tab within it while open, and
  // return focus to the toggle button on close (including Escape, below).
  useEffect(() => {
    if (!open) return;
    const toggleButton = buttonRef.current;
    panelRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      toggleButton?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (mq.matches) setOpen(false);
    };
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [open]);

  return (
    <div className="ml-auto md:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 shrink-0 flex-col items-center justify-center gap-[5px] rounded-md hover:bg-panel2"
      >
        <span
          className={`block h-0.5 w-5 rounded-full bg-mute transition-transform ${open ? "translate-y-[6.5px] rotate-45" : ""}`}
        />
        <span className={`block h-0.5 w-5 rounded-full bg-mute transition-opacity ${open ? "opacity-0" : ""}`} />
        <span
          className={`block h-0.5 w-5 rounded-full bg-mute transition-transform ${open ? "-translate-y-[6.5px] -rotate-45" : ""}`}
        />
      </button>

      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40 bg-ink/70" onClick={() => setOpen(false)} aria-hidden="true" />
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
              tabIndex={-1}
              className="fixed right-0 top-0 z-50 h-full w-64 max-w-[80vw] space-y-1 border-l border-line bg-panel p-4 focus:outline-none"
            >
              <div className="mb-3 border-b border-line pb-3">
                <IdentitySwitcher />
              </div>
              <div onClick={() => setOpen(false)}>
                <NavLinks vertical />
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
