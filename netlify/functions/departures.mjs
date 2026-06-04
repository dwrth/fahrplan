// Netlify Function: serverless replacement for the local /api/departures proxy.
// The browser still can't call mgate.exe cross-origin, so this runs server-side.
import { fetchCombinedBoard } from "../../hafas.js";

export default async (req) => {
  const url = new URL(req.url);
  const maxJny = Math.min(Number(url.searchParams.get("max")) || 40, 60);

  try {
    const data = await fetchCombinedBoard({ maxJny });
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message || err) }), {
      status: 502,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
};

// Map the function to the same path the frontend already calls.
export const config = { path: "/api/departures" };
