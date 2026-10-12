import assert from "node:assert/strict"
import test from "node:test"
import { childPracticeLinks } from "../lib/flags.ts"
import { POST as practice } from "../app/api/practice/route.ts"
import { POST as manageLinks } from "../app/api/practice-links/route.ts"
import { GET as playerManifest } from "../app/api/player-manifest/route.ts"

const token = "a".repeat(64)
const post = (path, body, authorization = "Bearer parent-token") => new Request(`https://playmultiply.com${path}`, {
  method: "POST", headers: { "Content-Type": "application/json", authorization }, body: JSON.stringify(body),
})
const practiceRequest = () => post("/api/practice", { action: "load", token })
const linksRequest = () => post("/api/practice-links", { action: "create", familyId: "family", playerId: "child" })
const manifestRequest = () => new Request(`https://playmultiply.com/api/player-manifest?player=${token}`)

for (const [name, handler, request] of [["child games", practice, practiceRequest], ["parent link management", manageLinks, linksRequest], ["child installation", playerManifest, manifestRequest]]) {
  test(`${name} is blocked without contacting Nhost when the flag is off`, async t => {
    t.mock.method(childPracticeLinks.adapter, "decide", async () => false)
    const fetch = t.mock.method(globalThis, "fetch", () => { throw new Error("Must not fetch") })
    const response = await handler(request())
    assert.equal(response.status, 503)
    assert.equal(response.headers.get("Cache-Control"), "no-store")
    assert.equal(response.headers.get("Retry-After"), "60")
    assert.equal((await response.json()).code, "FEATURE_DISABLED")
    assert.equal(fetch.mock.callCount(), 0)
  })
}

test("provider failure defaults off rather than enabling an unreleased feature", async t => {
  t.mock.method(childPracticeLinks.adapter, "decide", async () => { throw new Error("Provider unavailable") })
  t.mock.method(console, "warn", () => {})
  const fetch = t.mock.method(globalThis, "fetch", () => { throw new Error("Must not fetch") })
  assert.equal(childPracticeLinks.defaultValue, false)
  assert.equal((await manageLinks(linksRequest())).status, 503)
  assert.equal(fetch.mock.callCount(), 0)
})

test("enabled link management forwards the parent token and only permitted fields", async t => {
  t.mock.method(childPracticeLinks.adapter, "decide", async () => true)
  let forwarded
  t.mock.method(globalThis, "fetch", async (url, init) => {
    forwarded = { url, init }
    return Response.json({ data: { multiply_player_link_action: [{ result: { link: { token }, links: [] } }] } })
  })
  const response = await manageLinks(post("/api/practice-links", { action: "create", familyId: "family", playerId: "child", query: "forged", userId: "other-parent" }))
  assert.equal(response.status, 200)
  assert.deepEqual(forwarded.init.headers, { "Content-Type": "application/json", Authorization: "Bearer parent-token" })
  const body = JSON.parse(forwarded.init.body)
  assert.match(body.query, /multiply_player_link_action/)
  assert.deepEqual(body.variables, { action: "create", payload: { familyId: "family", playerId: "child" } })
})

test("enabled link management still requires authentication and validated operations", async t => {
  t.mock.method(childPracticeLinks.adapter, "decide", async () => true)
  const fetch = t.mock.method(globalThis, "fetch", () => { throw new Error("Must not fetch") })
  assert.equal((await manageLinks(post("/api/practice-links", {}, ""))).status, 401)
  assert.equal((await manageLinks(post("/api/practice-links", { action: "invite", familyId: "family" }))).status, 400)
  assert.equal(fetch.mock.callCount(), 0)
})

test("enabled link management retains membership errors from Hasura", async t => {
  t.mock.method(childPracticeLinks.adapter, "decide", async () => true)
  t.mock.method(globalThis, "fetch", async () => Response.json({ data: { multiply_player_link_action: [{ result: { error: { message: "Family access denied", code: "42501" } } }] } }))
  const response = await manageLinks(linksRequest())
  assert.equal(response.status, 403)
  assert.equal((await response.json()).error, "Family access denied")
})
