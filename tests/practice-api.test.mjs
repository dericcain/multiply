import { childPracticeLinks } from "../lib/flags.ts"
import assert from "node:assert/strict"
import test, { beforeEach } from "node:test"
import { POST } from "../app/api/practice/route.ts"
import { practiceLink } from "../lib/practice-links.js"

beforeEach(t => t.mock.method(childPracticeLinks.adapter, "decide", async () => true))

const token = "a".repeat(64)
const request = body => new Request("https://playmultiply.com/api/practice", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer parent-session" }, body: JSON.stringify(body) })

test("practice links use the current domain and keep secrets in the fragment", () => {
  const link = new URL(practiceLink("https://playmultiply.com/settings?invite=parent", token))
  assert.equal(link.origin, "https://playmultiply.com")
  assert.equal(link.pathname, "/play")
  assert.equal(link.search, "")
  assert.equal(new URLSearchParams(link.hash.slice(1)).get("play"), token)
})

test("practice API rejects malformed links and unsupported actions before fetching", async () => {
  for (const body of [null, { token: "wrong", action: "load" }, { token, action: "save_player" }, { token, action: "invite" }]) {
    assert.equal((await POST(request(body))).status, 400)
  }
})

test("practice API forwards only a fixed anonymous mutation and never parent credentials", async t => {
  let forwarded
  t.mock.method(globalThis, "fetch", async (url, init) => {
    forwarded = { url, init }
    return Response.json({ data: { multiply_practice_action: [{ result: { userId: "link-id", data: { players: [] } } }] } })
  })
  const response = await POST(request({ token, action: "load", query: "malicious", familyId: "other-family", headers: { "x-hasura-admin-secret": "forged" } }))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("Cache-Control"), "no-store")
  assert.deepEqual(forwarded.init.headers, { "Content-Type": "application/json", "x-hasura-role": "public" })
  assert.equal(forwarded.init.cache, "no-store")
  const body = JSON.parse(forwarded.init.body)
  assert.match(body.query, /multiply_practice_action/)
  assert.deepEqual(body.variables, { action: "load", payload: { token } })
})

test("practice API exposes usable revocation errors and hides upstream diagnostics", async t => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ data: { multiply_practice_action: [{ result: { error: { code: "42501", message: "Link disabled" } } }] } }))
  const revoked = await POST(request({ token, action: "load" }))
  assert.equal(revoked.status, 403)
  assert.deepEqual(await revoked.json(), { code: "42501", error: "Link disabled" })
  globalThis.fetch = async () => Response.json({ errors: [{ message: "Internal secret diagnostics" }] })
  const failed = await POST(request({ token, action: "load" }))
  assert.equal(failed.status, 502)
  assert.equal(JSON.stringify(await failed.json()).includes("secret diagnostics"), false)
})
