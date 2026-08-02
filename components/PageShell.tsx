import CommunityFooter from "@/components/CommunityFooter";
import Header from "@/components/Header";
import { ui } from "@/lib/ui-styles";

type PageShellProps = {
  children: React.ReactNode;
  /** @deprecated Analytics canvas is now the app-wide default. */
  variant?: "default" | "analytics";
};

/**
 * App chrome — dark analytics canvas matching Base Wallet Score.
 */
export default function PageShell({ children }: PageShellProps) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-gradient-to-b from-[#070b18] via-[#0c1430] to-[#101038]">
      {/*
        Decorative glows intentionally extend past the edges. Keep them in a
        clipped layer so they cannot expand document scrollWidth (horizontal overflow).
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-24 top-1/4 size-80 rounded-badge bg-base-blue/20 blur-3xl" />
        <div className="absolute -right-20 bottom-1/4 size-72 rounded-badge bg-cyan-400/10 blur-3xl" />
        <div className="absolute left-1/3 top-1/2 size-64 rounded-badge bg-indigo-500/10 blur-3xl" />
      </div>

      <Header />

      <main className={ui.pageMain}>
        {children}
        <CommunityFooter />
      </main>
    </div>
  );
}
