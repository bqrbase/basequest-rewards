import { isPublicHttpsUrl } from "@/lib/task2earn/target";
import type { MiniAppTaskTarget } from "@/lib/task2earn/types";

export type MiniAppInspectResult = {
  ok: boolean;
  error?: string;
  target?: MiniAppTaskTarget;
  /** URL was fetched/parsed. Does not mean the Mini App was opened. */
  urlInspected: boolean;
  openVerified: false;
};

type CatalogEntry = {
  name?: string;
  url?: string;
  homeUrl?: string;
  home_url?: string;
  domain?: string;
  id?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function manifestToTarget(
  url: URL,
  manifest: Record<string, unknown>,
): MiniAppTaskTarget {
  const miniapp = asRecord(manifest.miniapp) ?? asRecord(manifest.frame);
  const name = pickString(
    miniapp?.name,
    miniapp?.buttonTitle,
    manifest.name,
    url.hostname,
  );
  const appId = pickString(
    miniapp?.id,
    manifest.id,
    typeof miniapp?.canonicalDomain === "string" ? miniapp.canonicalDomain : null,
  );
  const home = pickString(
    miniapp?.homeUrl,
    miniapp?.home_url,
    manifest.homeUrl,
  );
  return {
    kind: "mini_app",
    name,
    url: home && isPublicHttpsUrl(home) ? isPublicHttpsUrl(home)!.toString() : url.toString(),
    appId,
    metadata: {
      inspectedFrom: `${url.origin}/.well-known/farcaster.json`,
      version: pickString(miniapp?.version, manifest.version),
      subtitle: pickString(miniapp?.subtitle, manifest.subtitle),
      iconUrl: pickString(miniapp?.iconUrl, miniapp?.icon_url),
    },
  };
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "manual",
      headers: { accept: "application/json, text/plain;q=0.8" },
      signal: AbortSignal.timeout(8_000),
    });
    if (response.status >= 300 && response.status < 400) {
      return null;
    }
    if (!response.ok) {
      return null;
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("json") && !contentType.includes("text")) {
      return null;
    }
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

/**
 * Inspect a Mini App URL only. Does not claim that opening the app was verified.
 */
export async function inspectMiniAppUrl(raw: string): Promise<MiniAppInspectResult> {
  const parsed = isPublicHttpsUrl(raw);
  if (!parsed) {
    return {
      ok: false,
      error: "Enter a public https Mini App URL",
      urlInspected: false,
      openVerified: false,
    };
  }

  const manifestUrl = `${parsed.origin}/.well-known/farcaster.json`;
  const manifest = asRecord(await fetchJson(manifestUrl));
  if (manifest) {
    return {
      ok: true,
      urlInspected: true,
      openVerified: false,
      target: manifestToTarget(parsed, manifest),
    };
  }

  return {
    ok: true,
    urlInspected: true,
    openVerified: false,
    target: {
      kind: "mini_app",
      name: parsed.hostname,
      url: parsed.toString(),
      appId: null,
      metadata: {
        inspectedFrom: parsed.origin,
        note: "No farcaster.json found. URL format only.",
      },
    },
  };
}

function catalogUrl(entry: CatalogEntry): string | null {
  const raw = pickString(entry.homeUrl, entry.home_url, entry.url);
  if (raw && isPublicHttpsUrl(raw)) {
    return isPublicHttpsUrl(raw)!.toString();
  }
  if (entry.domain && isPublicHttpsUrl(`https://${entry.domain}`)) {
    return `https://${entry.domain}`;
  }
  return null;
}

function asCatalogList(payload: unknown): CatalogEntry[] {
  if (Array.isArray(payload)) {
    return payload as CatalogEntry[];
  }
  const record = asRecord(payload);
  if (!record) {
    return [];
  }
  const nested =
    record.miniapps ??
    record.mini_apps ??
    record.frames ??
    record.apps ??
    record.items;
  return Array.isArray(nested) ? (nested as CatalogEntry[]) : [];
}

/**
 * Best-effort name search. Empty results are expected when no catalog is available.
 */
export async function searchMiniApps(query: string): Promise<MiniAppTaskTarget[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) {
    return [];
  }

  if (q.includes("://") || q.includes(".")) {
    const inspected = await inspectMiniAppUrl(
      q.includes("://") ? query.trim() : `https://${query.trim()}`,
    );
    return inspected.target ? [inspected.target] : [];
  }

  const catalogs = [
    "https://api.farcaster.xyz/v2/discover-mini-apps",
    "https://client.farcaster.xyz/v2/mini-apps",
  ];

  for (const catalog of catalogs) {
    const payload = await fetchJson(catalog);
    const matches = asCatalogList(payload)
      .map((entry) => {
        const url = catalogUrl(entry);
        const name = pickString(entry.name);
        if (!url || !name) {
          return null;
        }
        if (!name.toLowerCase().includes(q)) {
          return null;
        }
        const target: MiniAppTaskTarget = {
          kind: "mini_app",
          name,
          url,
          appId: pickString(entry.id),
          metadata: { catalog },
        };
        return target;
      })
      .filter((entry): entry is MiniAppTaskTarget => Boolean(entry))
      .slice(0, 8);
    if (matches.length > 0) {
      return matches;
    }
  }

  return [];
}
