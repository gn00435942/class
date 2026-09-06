const allowedOrigins = new Set([
  "https://gn00435942.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = allowedOrigins.has(origin)
    ? origin
    : "https://gn00435942.github.io";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  if (req.method !== "POST") {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405, headers },
    );
  }

  // Phase 1: establish the authenticated backend endpoint and deployment path.
  // Real document parsing will be added after the AI provider secret is stored
  // in Supabase Edge Function Secrets. No provider key belongs in this repo.
  return Response.json(
    {
      ok: true,
      service: "analyze-document",
      status: "backend-ready",
      aiConfigured: Boolean(Deno.env.get("OPENAI_API_KEY")),
      message: "Backend endpoint is deployed. AI document parsing is not enabled yet.",
    },
    { status: 200, headers },
  );
});
