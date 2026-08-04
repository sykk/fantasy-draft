"use client";

import { useEffect, useState } from "react";
import { NavLinks } from "@/components/NavLinks";
import { IdentitySwitcher } from "@/components/IdentitySwitcher";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
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

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-ink/70" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="fixed right-0 top-0 z-50 h-full w-64 max-w-[80vw] space-y-1 border-l border-line bg-panel p-4">
            <div className="mb-3 border-b border-line pb-3">
              <IdentitySwitcher />
            </div>
            <div onClick={() => setOpen(false)}>
              <NavLinks vertical />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
