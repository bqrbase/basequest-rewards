"use client";

import ConnectWalletButton from "@/components/ConnectWalletButton";
import { useWalletDisconnect } from "@/hooks/useWalletDisconnect";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAccount } from "wagmi";

type NavItem = {
  href: string;
  label: string;
};

/** Full app navigation — same order on desktop and mobile. */
const MAIN_NAV: readonly NavItem[] = [
  { href: "/", label: "Dashboard" },
  { href: "/quests", label: "Quests" },
  { href: "/tasks", label: "Tasks" },
  { href: "/achievements", label: "Achievements" },
  { href: "/referral", label: "Referral" },
  { href: "/rewards", label: "Rewards" },
  { href: "/swap", label: "Swap" },
  { href: "/bridge", label: "Bridge" },
  { href: "/token", label: "Token" },
  { href: "/genesis", label: "Genesis" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/base-wallet-score", label: "Wallet Score" },
  { href: "/profile", label: "Profile" },
  { href: "/settings", label: "Settings" },
];

const DESKTOP_NAV_ROW_1 = MAIN_NAV.slice(0, 8);
const DESKTOP_NAV_ROW_2 = MAIN_NAV.slice(8);

const connectButtonClassName =
  "flex h-9 items-center rounded-badge border border-cyan-300/30 bg-gradient-to-r from-base-blue to-indigo-600 px-2 text-[0.5rem] font-semibold uppercase tracking-tight text-white shadow-[0_0_14px_rgba(0,82,255,0.35)] transition-all hover:opacity-95 whitespace-nowrap lg:min-h-9 lg:px-2.5 lg:py-1 lg:text-[0.65rem] lg:tracking-wide";

const connectButtonDisabledClassName =
  "flex h-9 items-center rounded-badge border border-white/10 bg-white/[0.04] px-2 text-[0.5rem] font-semibold uppercase tracking-tight text-white/45 opacity-70 whitespace-nowrap lg:min-h-9 lg:px-2.5 lg:py-1 lg:text-[0.65rem] lg:tracking-wide";

const menuPanelClassName =
  "pointer-events-auto z-[9999] min-w-[11rem] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0c142e]/95 via-[#12183a]/92 to-[#151040]/95 py-1 shadow-[0_16px_40px_rgba(0,0,0,0.4)] backdrop-blur-xl";

function formatHeaderWalletAddress(address: string) {
  if (address.length < 10) {
    return address;
  }

  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function isActiveRoute(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname.startsWith(href);
}

function getDesktopNavLinkClassName(isActive: boolean) {
  return `flex shrink-0 items-center justify-center whitespace-nowrap rounded-badge border px-2 py-1 text-center text-[0.6rem] font-semibold uppercase leading-none tracking-widest transition-all ${
    isActive
      ? "border-cyan-300/40 bg-gradient-to-r from-base-blue to-indigo-600 text-white shadow-[0_0_14px_rgba(0,82,255,0.45)]"
      : "border-white/10 bg-white/[0.04] text-white/65 hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
  }`;
}

function drawerLinkClassName(isActive: boolean) {
  return `block rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
    isActive
      ? "border-cyan-300/40 bg-gradient-to-r from-base-blue to-indigo-600 text-white shadow-[0_0_14px_rgba(0,82,255,0.35)]"
      : "border-white/10 bg-white/[0.04] text-white/80 hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
  }`;
}

/** Connected wallet control — disconnect only (no page links). */
function WalletMenu() {
  const { address } = useAccount();
  const { disconnect, isPending: isDisconnecting } = useWalletDisconnect();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen || !containerRef.current) {
      setMenuPosition(null);
      return;
    }

    function updateMenuPosition() {
      if (!containerRef.current) {
        return;
      }
      const rect = containerRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  if (!address) {
    return null;
  }

  const dropdownMenu =
    isOpen && menuPosition && mounted
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Wallet menu"
            style={{
              position: "fixed",
              top: menuPosition.top,
              right: menuPosition.right,
            }}
            className={menuPanelClassName}
          >
            <button
              type="button"
              role="menuitem"
              disabled={isDisconnecting}
              onClick={() => {
                disconnect();
                setIsOpen(false);
              }}
              className="block w-full px-3 py-2.5 text-left text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDisconnecting ? "Disconnecting..." : "Disconnect Wallet"}
            </button>
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      className="relative max-w-[5.75rem] shrink-0 lg:max-w-none"
      ref={containerRef}
    >
      <button
        type="button"
        aria-label="Wallet menu"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((open) => !open)}
        className="flex h-9 max-w-full items-center gap-0.5 rounded-badge border border-white/12 bg-white/[0.04] px-1.5 font-mono text-[0.5rem] font-semibold leading-none text-white shadow-sm transition-all hover:border-cyan-300/30 hover:bg-white/[0.08] lg:min-h-9 lg:gap-1.5 lg:px-2.5 lg:py-1 lg:text-[0.65rem]"
      >
        <span className="truncate">{formatHeaderWalletAddress(address)}</span>
        <span
          aria-hidden
          className={`shrink-0 text-[0.45rem] text-white/45 transition-transform lg:text-[0.6rem] ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          ▼
        </span>
      </button>

      {dropdownMenu}
    </div>
  );
}

function MobileNavDrawer({
  open,
  onClose,
  pathname,
}: {
  open: boolean;
  onClose: () => void;
  pathname: string;
}) {
  const { status } = useAccount();
  const { disconnect, isPending: isDisconnecting } = useWalletDisconnect();
  const isConnected = status === "connected";
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const prevStatusRef = useRef(status);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const previous = prevStatusRef.current;
    prevStatusRef.current = status;
    if (
      open &&
      previous !== "connected" &&
      status === "connected"
    ) {
      onClose();
    }
  }, [onClose, open, status]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, open]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      id="mobile-nav-drawer"
      className={`fixed inset-0 z-[10000] lg:hidden ${
        open ? "pointer-events-auto" : "pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close navigation"
        onClick={onClose}
        className={`absolute inset-0 bg-[#050814]/70 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col border-r border-white/10 bg-gradient-to-br from-[#0c142e]/96 via-[#12183a]/94 to-[#151040]/96 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/25 to-transparent"
        />

        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-full border border-cyan-200/25 bg-gradient-to-br from-base-blue via-indigo-600 to-violet-700 text-sm font-bold tracking-tight text-white shadow-[0_0_18px_rgba(0,82,255,0.4)]">
              BQ
            </span>
            <p
              id={titleId}
              className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-cyan-100/55"
            >
              Menu
            </p>
          </div>
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="inline-flex size-9 items-center justify-center rounded-badge border border-white/12 bg-white/[0.04] text-white/70 transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <nav
          aria-label="Mobile navigation"
          className="flex-1 space-y-1.5 overflow-y-auto px-4 py-4"
        >
          <ul className="space-y-1.5">
            {MAIN_NAV.map((item) => {
              const active = isActiveRoute(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={onClose}
                    className={drawerLinkClassName(active)}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-white/10 px-4 py-4">
          {isConnected ? (
            <button
              type="button"
              disabled={isDisconnecting}
              onClick={() => {
                disconnect();
                onClose();
              }}
              className="flex h-11 w-full items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] px-4 text-sm font-semibold text-white/80 transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDisconnecting ? "Disconnecting..." : "Disconnect Wallet"}
            </button>
          ) : (
            <ConnectWalletButton
              connectLabel="Connect Wallet"
              connectingLabel="Connecting..."
              buttonClassName={`${connectButtonClassName} h-11 w-full justify-center px-4 text-sm tracking-wide`}
              disabledClassName={`${connectButtonDisabledClassName} h-11 w-full justify-center px-4 text-sm tracking-wide`}
              className="w-full"
            />
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}

export default function Header() {
  const pathname = usePathname();
  const { status } = useAccount();
  const isConnected = status === "connected";
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-10 w-full min-w-0 px-4 pt-5 pb-2 sm:px-6">
      <div className="relative mx-auto flex w-full min-w-0 max-w-lg items-center gap-1.5 rounded-2xl border border-white/10 bg-gradient-to-br from-[#0c142e]/90 via-[#12183a]/85 to-[#151040]/90 px-2 py-2 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:max-w-xl sm:gap-2 sm:px-4 sm:py-2.5 lg:grid lg:max-w-5xl lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center lg:gap-4 lg:px-5 lg:py-3">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/25 to-transparent"
        />

        <div className="flex shrink-0 items-center gap-1.5 lg:contents">
          <button
            type="button"
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
            aria-controls="mobile-nav-drawer"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex size-8 items-center justify-center rounded-badge border border-white/12 bg-white/[0.04] text-white/75 transition-all hover:border-cyan-300/30 hover:bg-white/[0.08] hover:text-white sm:size-9 lg:hidden"
          >
            <Menu className="size-4" aria-hidden />
          </button>

          <Link
            href="/"
            aria-label="Home"
            className="relative flex size-8 shrink-0 items-center justify-center rounded-full border border-cyan-200/25 bg-gradient-to-br from-base-blue via-indigo-600 to-violet-700 text-sm font-bold tracking-tight text-white shadow-[0_0_18px_rgba(0,82,255,0.4)] transition-opacity hover:opacity-90 sm:size-9 lg:col-start-1"
          >
            BQ
          </Link>
        </div>

        {/* Desktop: two centered rows */}
        <nav
          aria-label="Main navigation"
          className="hidden lg:col-start-2 lg:flex lg:w-full lg:flex-col lg:items-center lg:justify-center lg:justify-self-center lg:gap-1.5"
        >
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {DESKTOP_NAV_ROW_1.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={
                  isActiveRoute(pathname, item.href) ? "page" : undefined
                }
                className={getDesktopNavLinkClassName(
                  isActiveRoute(pathname, item.href),
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {DESKTOP_NAV_ROW_2.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={
                  isActiveRoute(pathname, item.href) ? "page" : undefined
                }
                className={getDesktopNavLinkClassName(
                  isActiveRoute(pathname, item.href),
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        {/* Spacer keeps wallet pinned right on mobile */}
        <div className="min-w-0 flex-1 lg:hidden" aria-hidden />

        <div className="flex shrink-0 items-center lg:col-start-3 lg:justify-self-end">
          {isConnected ? (
            <WalletMenu />
          ) : (
            <>
              <ConnectWalletButton
                connectLabel="Connect"
                connectingLabel="Connecting..."
                buttonClassName={connectButtonClassName}
                disabledClassName={connectButtonDisabledClassName}
                className="lg:hidden"
              />
              <ConnectWalletButton
                connectLabel="Connect Wallet"
                connectingLabel="Connecting..."
                buttonClassName={connectButtonClassName}
                disabledClassName={connectButtonDisabledClassName}
                className="hidden lg:inline-flex"
              />
            </>
          )}
        </div>
      </div>

      <MobileNavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        pathname={pathname}
      />
    </header>
  );
}
