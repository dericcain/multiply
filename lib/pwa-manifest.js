// Only a digest goes into the manifest request URL. The bearer secret stays in
// the document fragment, which the browser captures as the default launch URL.
export async function installationManifestUrl(href) {
  const token = new URLSearchParams(new URL(href).hash.slice(1)).get("play")
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return "/manifest.webmanifest"
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))
  const player = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("")
  return `/api/player-manifest?player=${player}`
}
