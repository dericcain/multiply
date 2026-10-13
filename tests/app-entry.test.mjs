import assert from "node:assert/strict"
import test from "node:test"
import { legacyAppTarget, invitationLink } from "../lib/app-entry.js"

const token = "a".repeat(64)

test("ordinary visits and homepage anchors stay on the landing page", () => {
  for (const suffix of ["/", "/?campaign=family", "/#how-it-works", "/#family", "/#features"]) {
    assert.equal(legacyAppTarget(`https://playmultiply.com${suffix}`), null)
  }
})

test("legacy child shortcuts preserve their fragment and never put it in a query", () => {
  const target = legacyAppTarget(`https://playmultiply.com/?campaign=family#play=${token}`)
  assert.equal(target, `/play?campaign=family#play=${token}`)
  const url = new URL(target, "https://playmultiply.com")
  assert.ok(!url.search.includes(token))
  assert.equal(new URLSearchParams(url.hash.slice(1)).get("play"), token)
  assert.equal(legacyAppTarget("https://playmultiply.com/#play=invalid"), "/play#play=invalid")
})

test("legacy invitations retain the query through the route move", () => {
  assert.equal(legacyAppTarget(`https://playmultiply.com/?invite=${token}`), `/play?invite=${token}`)
})

test("existing parent installed shortcuts launch the app and canonical routes do not loop", () => {
  assert.equal(legacyAppTarget("https://playmultiply.com/", true), "/play")
  assert.equal(legacyAppTarget(`https://playmultiply.com/#play=${token}`, true), `/play#play=${token}`)
  assert.equal(legacyAppTarget(`https://playmultiply.com/play#play=${token}`, true), null)
  assert.equal(legacyAppTarget("https://playmultiply.com/login", true), null)
})

test("new invitations use the canonical app route and discard unrelated URL data", () => {
  const link = new URL(invitationLink("https://playmultiply.com/?signup=1#old", token))
  assert.equal(link.pathname, "/play")
  assert.equal(link.searchParams.get("invite"), token)
  assert.equal(link.searchParams.get("signup"), null)
  assert.equal(link.hash, "")
})
