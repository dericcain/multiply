import { childPracticeLinks } from "../../../lib/flags.ts"

// Only the two practice operations are forwarded, with the anonymous role.
// The database validates the bearer link and restricts every save to its player.
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" }
  let body
  try { body = await request.json() } catch { return Response.json({ error: "Invalid request" }, { status: 400, headers }) }
  if (!["load", "save_session"].includes(body?.action) || typeof body?.token !== "string" || !/^[a-f0-9]{64}$/.test(body.token)) {
    return Response.json({ error: "This practice link is unavailable. Ask a parent for a new link." }, { status: 400, headers })
  }
  if (!await childPracticeLinks(request)) {
    return Response.json({ error: "Practice links are not available right now.", code: "FEATURE_DISABLED" }, { status: 503, headers: { ...headers, "Retry-After": "60" } })
  }
  const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || "ykevmgaitwkucccphxbv"
  const region = process.env.NEXT_PUBLIC_NHOST_REGION || "us-east-1"
  const endpoint = process.env.NEXT_PUBLIC_NHOST_GRAPHQL_URL || `https://${subdomain}.graphql.${region}.nhost.run/v1`
  try {
    const upstream = await fetch(endpoint, {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/json", "x-hasura-role": "public" },
      body: JSON.stringify({
        query: "mutation Practice($action: String!, $payload: jsonb!) { multiply_practice_action(args: { action: $action, payload: $payload }) { result } }",
        variables: { action: body.action, payload: { token: body.token, gameSession: body.gameSession } },
      }),
    })
    const result = await upstream.json()
    const snapshot = result.data?.multiply_practice_action?.[0]?.result
    if (!upstream.ok || result.errors || !snapshot) return Response.json({ error: "We couldn’t load practice. Please try again." }, { status: 502, headers })
    if (snapshot.error) return Response.json({ error: snapshot.error.message, code: snapshot.error.code }, { status: snapshot.error.code === "42501" ? 403 : 400, headers })
    return Response.json(snapshot, { headers })
  } catch {
    return Response.json({ error: "We couldn’t connect. Check your Wi-Fi and try again." }, { status: 502, headers })
  }
}
