export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/forecast") {
      const allowed = new Set([
        "latitude", "longitude", "hourly", "forecast_hours", "timezone"
      ]);
      const out = new URL("https://api.open-meteo.com/v1/forecast");
      for (const [k, v] of url.searchParams) {
        if (allowed.has(k)) out.searchParams.set(k, v);
      }
      try {
        const r = await fetch(out.toString(), {
          headers: { "User-Agent": "Winter-Watch/1.0" }
        });
        return new Response(r.body, {
          status: r.status,
          headers: {
            "Content-Type": r.headers.get("Content-Type") || "application/json",
            "Cache-Control": "no-store"
          }
        });
      } catch (e) {
        return Response.json({ error: "Forecast proxy failed", detail: String(e?.message || e) }, { status: 502 });
      }
    }

    if (url.pathname === "/api/ask" && request.method === "POST") {
      if (!env.GROQ_API_KEY) {
        return Response.json({ error: "GROQ_API_KEY is not configured on the server." }, { status: 500 });
      }

      try {
        const body = await request.json();
        const system = String(body.system || "");
        const user = String(body.user || "");

        // Keep the model server-side so visitors never need your API key.
        const model = "openai/gpt-oss-20b";

        const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + env.GROQ_API_KEY
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user }
            ],
            max_tokens: 1200,
            temperature: 0.2
          })
        });

        const text = await r.text();
        return new Response(text, {
          status: r.status,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
        });
      } catch (e) {
        return Response.json({ error: String(e?.message || e) }, { status: 500 });
      }
    }

    if (url.pathname === "/api/ask" && request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "POST, OPTIONS"
        }
      });
    }

    return env.ASSETS.fetch(request);
  }
};
