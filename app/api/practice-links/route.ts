import { childPracticeLinks } from "../../../lib/flags.ts"

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" }
  if (!await childPracticeLinks(request)) {
    return Response.json({ error: "Practice links are not available right now.", code: "FEATURE_DISABLED" }, { status: 503, headers: { ...headers, "Retry-After": "60" } })
  }
  const authorization = request.headers.get("authorization")
  if (!authorization?.startsWith("Bearer ")) return Response.json({ error: "Please sign in and try again." }, { status: 401, headers })
  let body
  try { body = await request.json() } catch { return Response.json({ error: "Invalid request" }, { status: 400, headers }) }
  if (!["list", "create", "revoke"].includes(body?.action) || typeof body?.familyId !== "string") {
    return Response.json({ error: "Invalid request" }, { status: 400, headers })
  }
  const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || "ykevmgaitwkucccphxbv"
  const region = process.env.NEXT_PUBLIC_NHOST_REGION || "us-east-1"
  const endpoint = process.env.NEXT_PUBLIC_NHOST_GRAPHQL_URL || `https://${subdomain}.graphql.${region}.nhost.run/v1`
  try {
    const upstream = await fetch(endpoint, {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/json", Authorization: authorization },
      body: JSON.stringify({
        query: "mutation PlayerLink($action: String!, $payload: jsonb!) { multiply_player_link_action(args: { action: $action, payload: $payload }) { result } }",
        variables: { action: body.action, payload: { familyId: body.familyId, playerId: body.playerId } },
      }),
    })
    const result = await upstream.json()
    const value = result.data?.multiply_player_link_action?.[0]?.result
    if (!upstream.ok || result.errors || !value) return Response.json({ error: "We couldn’t manage practice links. Please try again." }, { status: 502, headers })
    if (value.error) return Response.json({ error: value.error.message, code: value.error.code }, { status: value.error.code === "42501" ? 403 : 400, headers })
    return Response.json(value, { headers })
  } catch {
    return Response.json({ error: "We couldn’t connect. Please try again." }, { status: 502, headers })
  }
}
