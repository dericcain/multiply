import { childPracticeLinks } from "../lib/flags.ts"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test, { beforeEach } from "node:test"
import { installationManifestUrl } from "../lib/pwa-manifest.js"
import { GET } from "../app/api/player-manifest/route.ts"
import baseManifest from "../lib/manifest.json" with { type: "json" }

beforeEach(t => t.mock.method(childPracticeLinks.adapter, "decide", async () => true))

test("parent and invitation installs launch the game with the original installation identity", async () => {
  for (const suffix of ["/", "/play", "/?invite=parent", "/play?invite=parent", "/#play=invalid"]) {
    assert.equal(await installationManifestUrl(`https://playmultiply.com${suffix}`), "/manifest.webmanifest")
  }
  assert.equal(baseManifest.start_url, "/play")
  assert.equal(baseManifest.id, "/")
})

test("player installs have separate identities without exposing their secrets", async () => {
  const token = "a".repeat(64)
  const href = `https://playmultiply.com/#play=${token}`
  const manifestUrl = await installationManifestUrl(href)
  assert.equal(manifestUrl, `/api/player-manifest?player=${createHash("sha256").update(token).digest("hex")}`)
  assert.equal(await installationManifestUrl(href), manifestUrl)
  assert.equal(await installationManifestUrl(href.replace("/#", "/play#")), manifestUrl, "legacy and canonical links keep the same player installation identity")
  assert.notEqual(await installationManifestUrl(`https://playmultiply.com/#play=${"b".repeat(64)}`), manifestUrl)
  assert.ok(!manifestUrl.includes(token))
  const response = await GET(new Request(new URL(manifestUrl, href)))
  const manifest = await response.json()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("Content-Type"), "application/manifest+json")
  assert.equal(response.headers.get("Cache-Control"), "no-store")
  assert.equal(manifest.id, `/?player=${new URL(manifestUrl, href).searchParams.get("player")}`)
  // Per the manifest standard, omitting start_url preserves the document URL.
  assert.equal(Object.hasOwn(manifest, "start_url"), false)
  assert.equal(manifest.scope, "/")
  assert.deepEqual(manifest.icons, baseManifest.icons)
  assert.equal(baseManifest.start_url, "/play", "player response must not mutate the parent manifest")
})

test("manifest endpoint rejects invalid player identities", async () => {
  for (const search of ["", "?player=invalid", `?player=${"a".repeat(64)}%2Fother`]) {
    assert.equal((await GET(new Request(`https://playmultiply.com/api/player-manifest${search}`))).status, 400)
  }
})
