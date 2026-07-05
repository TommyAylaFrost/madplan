// GET /api/health
// Simpelt liveness-tjek, bruges af forsiden til at bekræfte at
// Pages Functions kører. Udvides i senere faser med DB-status m.m.
export async function onRequestGet() {
  return new Response(
    JSON.stringify({ status: "ok", app: "madplan", phase: 0 }),
    { headers: { "content-type": "application/json" } }
  );
}
