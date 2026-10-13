export function practiceLink(origin, token) {
  const url = new URL("/play", origin)
  // Fragments stay out of server request URLs and referrer headers.
  url.hash = new URLSearchParams({ play: token }).toString()
  return url.toString()
}

export async function practiceAction(token, action, gameSession) {
  let response
  try {
    response = await fetch("/api/practice", {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
      body: JSON.stringify({ token, action, gameSession }),
    })
  } catch (cause) {
    throw new Error("We couldn’t connect. Check your Wi-Fi and try again.", { cause })
  }
  const result = await response.json()
  if (!response.ok) throw Object.assign(new Error(result.error || "Couldn’t load practice. Please try again."), { code: result.code })
  return result
}
