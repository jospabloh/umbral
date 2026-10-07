// Fetches the current legal version from acaciaco.com.mx with a 5s timeout,
// caching the last successful read in LegalVersionCache. On failure, returns
// the cached version without changing anyone's decision state.

const LEGAL_URL = "https://acaciaco.com.mx/legal/version.json";

export async function fetchLegalVersion(base44) {
  let cached = null;
  try {
    const cacheRes = await base44.asServiceRole.entities.LegalVersionCache.list({ limit: 1 });
    const cacheItems = Array.isArray(cacheRes) ? cacheRes : cacheRes?.items || [];
    cached = cacheItems[0] || null;
  } catch (e) {
    cached = null;
  }

  try {
    const resp = await fetch(LEGAL_URL, { signal: AbortSignal.timeout(5000) });
    if (resp.ok) {
      const data = await resp.json();
      const doc = {
        version: data.version || "unknown",
        published: data.published || null,
        grace_days: data.grace_days ?? 15,
        terms_sha256: data.documents?.terminos?.sha256 || "",
        terms_url: data.documents?.terminos?.url || "https://acaciaco.com.mx/legal/terminos",
        privacy_url: data.documents?.privacidad?.url || "https://acaciaco.com.mx/legal/privacidad",
        changes_es: data.changes_es || "",
        fetched_at: new Date().toISOString(),
      };
      try {
        if (cached) {
          await base44.asServiceRole.entities.LegalVersionCache.update(cached.id, { data: doc });
        } else {
          await base44.asServiceRole.entities.LegalVersionCache.create({ data: doc });
        }
      } catch (e) {
        // cache write failure is non-fatal
      }
      return { version: doc, source: "fresh" };
    }
  } catch (e) {
    // timeout or network error — fall back to cache
  }

  if (cached) {
    return { version: cached.data, source: "cache" };
  }
  return { version: { version: "unknown", grace_days: 15, changes_es: "", terms_url: "https://acaciaco.com.mx/legal/terminos", privacy_url: "https://acaciaco.com.mx/legal/privacidad" }, source: "none" };
}