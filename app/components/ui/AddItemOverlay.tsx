"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface AddItemOverlayProps {
  open: boolean;
  onClose: () => void;
  onNavigate?: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

export function AddItemOverlay({
  open,
  onClose,
  onNavigate,
  anchorRef,
}: AddItemOverlayProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  const handleNavigate = () => {
    onNavigate?.();
    onClose();
  };

  // Position menu below trigger
  useEffect(() => {
    if (!open || !anchorRef.current) return;

    const rect = anchorRef.current.getBoundingClientRect();

    setPosition({
      top: rect.bottom + 8, // small gap
      left: rect.right - 260, // align right edges (menu width ~260)
    });
  }, [open, anchorRef]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120]"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      {/* ✅ Subtle backdrop (interaction blocker, NOT heavy modal) */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[1.5px]" />

      {/* ✅ Anchored panel */}
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          top: position.top,
          left: position.left,
        }}
        className="absolute w-[260px] rounded-lg
                   border border-[rgba(141,153,174,0.35)]
                   bg-[rgba(43,45,66,0.96)]
                   p-2 shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
        role="menu"
      >
        <Link
          href="/secrets/passwords/new"
          onClick={handleNavigate}
          className="block rounded-md px-4 py-3 text-sm text-white
                     hover:bg-[rgba(141,153,174,0.1)]"
        >
          🔑 Password
        </Link>
        <Link
          href="/secrets/api-keys/new"
          onClick={handleNavigate}
          className="block rounded-md px-4 py-3 text-sm text-white
                     hover:bg-[rgba(141,153,174,0.1)]"
        >
          🔐 API Key
        </Link>
        <Link
          href="/secrets/env-vars/new"
          onClick={handleNavigate}
          className="block rounded-md px-4 py-3 text-sm text-white
                     hover:bg-[rgba(141,153,174,0.1)]"
        >
          ⚙️ Environment Variables
        </Link>
      </div>
    </div>
  );
}