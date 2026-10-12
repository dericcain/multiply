import { childPracticeLinks } from "../../../lib/flags.ts"

import baseManifest from "../../../lib/manifest.json" with { type: "json" }

export async function GET(request: Request) {
  const player = new URL(request.url).searchParams.get("player")
  const headers = { "Content-Type": "application/manifest+json", "Cache-Control": "no-store" }
  if (!player || !/^[a-f0-9]{64}$/.test(player)) {
    return Response.json({ error: "Invalid player identity" }, { status: 400, headers })
  }
  if (!await childPracticeLinks(request)) {
    return Response.json({ error: "Practice links are not available right now.", code: "FEATURE_DISABLED" }, { status: 503, headers: { ...headers, "Retry-After": "60" } })
  }
  const manifest: Partial<typeof baseManifest> = { ...baseManifest }
  // With no start_url the browser uses the installing document's full URL,
  // including #play. An explicit ID keeps parent and player installs distinct;
  // fragments in IDs are ignored by browsers, so use the non-secret digest.
  delete manifest.start_url
  manifest.id = `/?player=${player}`
  return Response.json(manifest, { headers })
}
