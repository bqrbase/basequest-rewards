import {
  searchFarcasterMiniApps,
  type FarcasterMiniAppSearchResult,
} from "@/lib/farcaster/neynar";
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

function toMiniAppTarget(
  app: FarcasterMiniAppSearchResult,
): MiniAppTaskTarget | null {
  const parsed = isPublicHttpsUrl(app.url);
  if (!parsed) {
    return null;
  }
  return {
    kind: "mini_app",
    name: app.name,
    url: parsed.toString(),
    appId: parsed.hostname,
    metadata: {
      iconUrl: app.iconUrl,
      authorUsername: app.authorUsername,
      authorDisplayName: app.authorDisplayName,
      authorFid: app.authorFid,
    },
  };
}

/**
 * Name/URL search for Mini App targets.
 * Name queries use Neynar Mini App search. Throws on Neynar/network failure.
 * URL/domain queries inspect the public https origin only.
 */
export async function searchMiniApps(query: string): Promise<MiniAppTaskTarget[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  if (trimmed.includes("://") || trimmed.includes(".")) {
    const inspected = await inspectMiniAppUrl(
      trimmed.includes("://") ? trimmed : `https://${trimmed}`,
    );
    return inspected.target ? [inspected.target] : [];
  }

  const apps = await searchFarcasterMiniApps(trimmed, 8);
  return apps
    .map(toMiniAppTarget)
    .filter((app): app is MiniAppTaskTarget => Boolean(app));
}
