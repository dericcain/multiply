// Root links and existing installed shortcuts stay valid after the route move.
// Read fragments only in the browser; never put child secrets into query strings.
export function legacyAppTarget(href, standalone = false) {
  const url = new URL(href)
  if (url.pathname !== "/") return null
  if (!standalone && !url.searchParams.has("invite") && !new URLSearchParams(url.hash.slice(1)).has("play")) return null
  return `/play${url.search}${url.hash}`
}

export function invitationLink(origin, token) {
  const url = new URL("/play", origin)
  url.searchParams.set("invite", token)
  return url.toString()
}
