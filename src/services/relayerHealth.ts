// src/services/relayerHealth.ts
export async function checkRelayerHealth(): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const json = await res.json();
      return json;
    } catch (e: any) {
      return { ok: false, error: e?.message || "Network error" };
    }
  }
  