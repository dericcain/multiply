import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHmac, randomUUID } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import { familyStandings, rankStandings } from "../lib/progression.js"
import { withFamilyMetadata } from "../scripts/apply-family-metadata.mjs"

// Real PostgreSQL + Hasura integration, isolated from application databases.
const name = `multiply-api-${randomUUID().slice(0, 8)}`
const pg = `${name}-pg`, engine = `${name}-hasura`
const password = randomUUID(), admin = randomUUID(), jwtKey = randomUUID()
const ids = {
  owner: "11111111-1111-4111-8111-111111111111",
  parent: "22222222-2222-4222-8222-222222222222",
  outsider: "33333333-3333-4333-8333-333333333333",
}
const docker = (...args) => execFileSync("docker", args, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim()
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
let endpoint
const jwt = user => {
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")
  const payload = Buffer.from(JSON.stringify({ sub: ids[user], iat: now, exp: now + 600, "https://hasura.io/jwt/claims": {
    "x-hasura-default-role": "user", "x-hasura-allowed-roles": ["user"], "x-hasura-user-id": ids[user],
  } })).toString("base64url")
  return `${header}.${payload}.${createHmac("sha256", jwtKey).update(`${header}.${payload}`).digest("base64url")}`
}
async function metadata(type, args) {
  const response = await fetch(`${endpoint}/v1/metadata`, { method: "POST", headers: { "content-type": "application/json", "x-hasura-admin-secret": admin }, body: JSON.stringify({ type, args }) })
  const body = await response.json()
  assert.ok(response.ok, JSON.stringify(body))
  return body
}
async function graphql(user, query, variables = {}) {
  const response = await fetch(`${endpoint}/v1/graphql`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${jwt(user)}` }, body: JSON.stringify({ query, variables }) })
  return response.json()
}
async function action(user, action, payload = {}) {
  const body = await graphql(user, "mutation Test($action:String!,$payload:jsonb!){multiply_family_action(args:{action:$action,payload:$payload}){result}}", { action, payload })
  if (body.errors) throw new Error(JSON.stringify(body.errors))
  const result = body.data.multiply_family_action[0].result
  if (result.error) throw Object.assign(new Error(result.error.message), { code: result.error.code })
  return result
}
try {
  docker("network", "create", name)
  docker("run", "-d", "--rm", "--name", pg, "--network", name, "-e", `POSTGRES_PASSWORD=${password}`, "postgres:18-alpine")
  let ready = false
  for (let attempt = 0; attempt < 60; attempt++) {
    try { docker("exec", pg, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"); ready = true; break } catch { await sleep(500) }
  }
  assert.ok(ready, "Postgres did not become ready")
  const fixture = `CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_verified boolean NOT NULL DEFAULT true);
    INSERT INTO auth.users(id,email) VALUES ('${ids.owner}','owner@example.test'),('${ids.parent}','parent@example.test'),('${ids.outsider}','outsider@example.test');`
  const legacy = `INSERT INTO public.multiply_profiles(user_id,data) VALUES
    ('${ids.owner}','{"players":[{"id":"child","name":"Ethan","maxTable":5,"maxMultiplier":5}],"stats":{"child:1x1":{"attempts":2,"correct":1,"recent":[false,true]}},"sessions":[],"preserveMe":true}'),
    ('${ids.parent}','{"players":[{"id":"original","name":"Original child","maxTable":5,"maxMultiplier":5}],"stats":{},"sessions":[]}');`
  const oldMigration = await readFile(new URL("../nhost/migrations/default/20261004000000_create_multiply_profiles/up.sql", import.meta.url), "utf8")
  const migration = await readFile(new URL("../nhost/migrations/default/20261011000000_shared_families/up.sql", import.meta.url), "utf8")
  const durableXpMigration = await readFile(new URL("../nhost/migrations/default/20261011010000_durable_xp/up.sql", import.meta.url), "utf8")
  const childLinksMigration = await readFile(new URL("../nhost/migrations/default/20261011020000_child_practice_links/up.sql", import.meta.url), "utf8")
  const childStandingsMigration = await readFile(new URL("../nhost/migrations/default/20261011030000_child_family_standings/up.sql", import.meta.url), "utf8")
  execFileSync("docker", ["exec", "-i", pg, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1"], { input: [fixture, oldMigration, legacy, migration, durableXpMigration, childLinksMigration, childStandingsMigration].join("\n"), stdio: ["pipe", "pipe", "pipe"] })
  docker("run", "-d", "--rm", "--name", engine, "--network", name, "-p", "127.0.0.1::8080", "-e", `HASURA_GRAPHQL_DATABASE_URL=postgres://postgres:${password}@${pg}:5432/postgres`, "-e", `HASURA_GRAPHQL_ADMIN_SECRET=${admin}`, "-e", `HASURA_GRAPHQL_JWT_SECRET=${JSON.stringify({ type: "HS256", key: jwtKey })}`, "-e", "HASURA_GRAPHQL_DEV_MODE=false", "-e", "HASURA_GRAPHQL_UNAUTHORIZED_ROLE=public", "hasura/graphql-engine:v2.48.10-ce")
  endpoint = `http://${docker("port", engine, "8080/tcp")}`
  ready = false
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(`${endpoint}/healthz`)).ok) { ready = true; break } } catch {}
    await sleep(500)
  }
  assert.ok(ready, "Hasura did not become ready")
  await metadata("pg_track_table", { source: "default", table: { schema: "public", name: "multiply_profiles" } })
  await metadata("replace_metadata", { allow_inconsistent_metadata: false, metadata: withFamilyMetadata(await metadata("export_metadata", {})) })
  assert.equal((await metadata("get_inconsistent_metadata", {})).is_consistent, true)

  const owner = await action("owner", "load"), original = await action("parent", "load")
  const familyId = owner.family.id
  assert.equal(owner.data.preserveMe, true)
  assert.equal(owner.data.xp.child, 1, "opening XP is returned through the tracked Hasura mutation")
  await assert.rejects(action("outsider", "load", { familyId }), { code: "42501", message: "Family access denied" })
  const invite = await action("owner", "invite", { familyId, email: "PARENT@example.test" })
  await assert.rejects(action("outsider", "accept_invitation", { token: invite.token }), /verified invited email/)
  const joined = await action("parent", "accept_invitation", { token: invite.token })
  assert.equal(joined.family.id, familyId)
  assert.equal(joined.families.length, 2)
  assert.equal((await action("parent", "load", { familyId: original.family.id })).data.players[0].name, "Original child")
  await assert.rejects(action("parent", "invite", { familyId, email: "outsider@example.test" }), /Only the family owner/)
  const game = id => ({ id, playerId: "child", mode: "practice", answerMode: "choice", table: 1, maxMultiplier: 5, date: Date.now(), results: [{ table: 1, multiplier: 1, correct: true }] })
  const concurrentAwards = await Promise.all(Array.from({ length: 10 }, (_, i) => action(i % 2 ? "parent" : "owner", "save_session", { familyId, gameSession: game(`concurrent-${i}`) })))
  let loaded = await action("parent", "load", { familyId })
  assert.equal(loaded.data.stats["child:1x1"].attempts, 12)
  assert.equal(loaded.data.stats["child:1x1"].correct, 11)
  assert.equal(concurrentAwards.reduce((sum, result) => sum + result.award.totalXp, 0), 35, "concurrent sessions award ten answer XP and one first-mastery bonus")
  assert.equal(loaded.data.xp.child, 36, "opening and earned XP are returned as the authoritative balance")
  assert.deepEqual(loaded.data.awardedFacts.child, ["1x1"])
  const duplicate = await action("parent", "save_session", { familyId, gameSession: game("concurrent-0") })
  assert.deepEqual(duplicate.award, concurrentAwards[0].award, "duplicate session returns the original award")
  assert.equal((await action("owner", "load", { familyId })).data.stats["child:1x1"].attempts, 12)
  await Promise.all(["owner", "parent"].map(user => action(user, "save_player", { familyId, player: { id: user, name: user, maxTable: 5, maxMultiplier: 5 } })))
  assert.equal((await action("owner", "load", { familyId })).data.players.length, 3)
  const schema = await graphql("owner", '{__type(name:"multiply_family_action_args"){inputFields{name}}}')
  assert.deepEqual(schema.data.__type.inputFields.map(field => field.name).sort(), ["action", "payload"])
  for (const table of ["multiply_families", "multiply_family_members", "multiply_family_invitations", "multiply_family_game_receipts"]) assert.ok((await graphql("parent", `{${table}{__typename}}`)).errors)
  await action("owner", "remove_member", { familyId, userId: ids.parent })
  await assert.rejects(action("parent", "load", { familyId }), { code: "42501", message: "Family access denied" })
  await assert.rejects(action("parent", "save_session", { familyId, gameSession: game("revoked") }), /Family access denied/)
  await assert.rejects(action("parent", "accept_invitation", { token: invite.token }), /unavailable or expired/)
  const canceled = await action("owner", "invite", { familyId, email: "parent@example.test" })
  await action("owner", "cancel_invitation", { familyId, invitationId: canceled.id })
  await assert.rejects(action("parent", "accept_invitation", { token: canceled.token }), /unavailable or expired/)
  const linkAction = async (user, actionName, playerId = "child") => {
    const body = await graphql(user, "mutation Link($action:String!,$payload:jsonb!){multiply_player_link_action(args:{action:$action,payload:$payload}){result}}", { action: actionName, payload: { familyId, playerId } })
    assert.ok(!body.errors, JSON.stringify(body.errors))
    return body.data.multiply_player_link_action[0].result
  }
  const practice = async (token, actionName = "load", gameSession) => {
    const response = await fetch(`${endpoint}/v1/graphql`, { method: "POST", headers: { "content-type": "application/json", "x-hasura-role": "public" }, body: JSON.stringify({ query: "mutation Practice($action:String!,$payload:jsonb!){multiply_practice_action(args:{action:$action,payload:$payload}){result}}", variables: { action: actionName, payload: { token, gameSession } } }) })
    const body = await response.json()
    assert.ok(!body.errors, JSON.stringify(body.errors))
    return body.data.multiply_practice_action[0].result
  }
  assert.equal((await linkAction("outsider", "create")).error.code, "42501")
  assert.equal((await linkAction("parent", "create")).error.code, "42501", "removed parent cannot create child links")
  const childLink = (await linkAction("owner", "create")).link
  assert.match(childLink.token, /^[a-f0-9]{64}$/)
  let childSnapshot = await practice(childLink.token)
  assert.deepEqual(childSnapshot.data.players.map(p => p.id), ["child"])
  assert.deepEqual(Object.keys(childSnapshot).sort(), ["data", "family", "standings", "userId"])
  assert.deepEqual(Object.keys(childSnapshot.family), ["id"])
  assert.deepEqual(Object.keys(childSnapshot.data.xp), ["child"])
  assert.equal(childSnapshot.data.preserveMe, undefined)
  assert.equal(JSON.stringify(childSnapshot).includes("owner@example.test"), false)
  assert.deepEqual(childSnapshot.standings.map(row => row.player.id).sort(), ["child", "owner", "parent"])
  for (const row of childSnapshot.standings) {
    assert.deepEqual(Object.keys(row).sort(), ["count", "hasEvidence", "player", "total", "xp"])
    assert.deepEqual(Object.keys(row.player).sort(), ["id", "maxMultiplier", "maxTable", "name"])
  }
  // A sibling game changes the read-only standings, never the child's playable
  // roster, fact histories, sessions, or awards. Foreign families stay excluded.
  await action("owner", "save_session", { familyId, gameSession: {
    ...game("sibling-game"), playerId: "owner",
    results: Array.from({ length: 5 }, () => ({ table: 1, multiplier: 1, correct: true })),
  } })
  childSnapshot = await practice(childLink.token)
  const sibling = childSnapshot.standings.find(row => row.player.id === "owner")
  assert.equal(sibling.xp, 30)
  assert.equal(sibling.count, 1)
  assert.equal(sibling.total, 25)
  assert.equal(sibling.hasEvidence, true)
  const ranked = rows => rows.map(row => [row.player.id, row.xp, row.count, row.total, row.rank])
  assert.deepEqual(ranked(rankStandings(childSnapshot.standings)), ranked(familyStandings((await action("owner", "load", { familyId })).data)))
  assert.deepEqual(childSnapshot.data.players.map(player => player.id), ["child"])
  assert.ok(Object.keys(childSnapshot.data.stats).every(key => key.startsWith("child:")))
  assert.ok(childSnapshot.data.sessions.every(session => session.playerId === "child"))
  assert.deepEqual(Object.keys(childSnapshot.data.awardedFacts), ["child"])
  assert.equal(JSON.stringify(childSnapshot).includes("Original child"), false)
  assert.equal(JSON.stringify(childSnapshot).includes("sibling-game"), false)
  assert.equal((await practice("a".repeat(64))).error.code, "42501")
  assert.equal((await practice(childLink.token, "save_player")).error.code, "22023")
  assert.equal((await practice(childLink.token, "save_session", { ...game("wrong-child"), playerId: "owner" })).error.code, "22023")
  assert.equal((await practice(childLink.token, "save_session", { ...game("out-of-range"), table: 6, results: [{ table: 6, multiplier: 1, correct: true }] })).error.code, "22023")
  const balanceBefore = childSnapshot.data.xp.child
  const childGame = game("phone-game")
  const saved = await practice(childLink.token, "save_session", childGame)
  assert.equal(saved.data.xp.child, balanceBefore + 1)
  assert.equal(saved.standings.find(row => row.player.id === "child").xp, saved.data.xp.child)
  assert.equal(saved.standings.find(row => row.player.id === "owner").xp, 30)
  assert.deepEqual((await practice(childLink.token, "save_session", childGame)).award, saved.award)
  assert.equal((await action("owner", "load", { familyId })).data.xp.child, saved.data.xp.child)
  const replacement = (await linkAction("owner", "create")).link
  assert.equal((await practice(childLink.token)).error.code, "42501", "replacement immediately disables old link")
  assert.equal((await practice(childLink.token, "save_session", childGame)).error.code, "42501", "revoked link cannot even retry a previously saved game")
  assert.ok(!(await practice(replacement.token)).error)
  await linkAction("owner", "revoke")
  assert.equal((await practice(replacement.token)).error.code, "42501")
  assert.equal((await linkAction("owner", "list")).links.length, 0)
  const publicSchema = await fetch(`${endpoint}/v1/graphql`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: '{__type(name:"mutation_root"){fields{name}}}' }) }).then(r => r.json())
  assert.deepEqual(publicSchema.data.__type.fields.map(field => field.name), ["multiply_practice_action"])
  const publicResults = await fetch(`${endpoint}/v1/graphql`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: '{multiply_practice_action_results{result}}' }) }).then(r => r.json())
  assert.deepEqual(publicResults.data.multiply_practice_action_results, [])
  console.log("Child practice API checks passed: anonymous token access, private snapshots, player/range isolation, parent-visible progress, XP retry idempotence, replacement, revocation, and restricted public schema.")
  console.log("Shared-family API checks passed: real JWT identity, production errors, concurrent games and XP awards, authoritative opening balances, retry idempotence, invitations, family isolation, access removal.")
  const standingsRollback = await readFile(new URL("../nhost/migrations/default/20261011030000_child_family_standings/down.sql", import.meta.url), "utf8")
  const rollbackLink = (await linkAction("owner", "create")).link
  const beforeRollback = await practice(rollbackLink.token)
  execFileSync("docker", ["exec", "-i", pg, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1"], { input: standingsRollback, stdio: ["pipe", "pipe", "pipe"] })
  const afterRollback = await practice(rollbackLink.token)
  assert.equal(afterRollback.standings, undefined)
  assert.deepEqual(afterRollback.data, beforeRollback.data, "rollback preserves linked player progress")
  execFileSync("docker", ["exec", "-i", pg, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1"], { input: childStandingsMigration, stdio: ["pipe", "pipe", "pipe"] })
  assert.deepEqual((await practice(rollbackLink.token)).standings, beforeRollback.standings)
  console.log("Child standings checks passed: family-only summaries, shared mastery ranks, saved XP updates, private histories, and reversible migration.")
  const streakMigration = await readFile(new URL("../nhost/migrations/default/20261012000000_varied_fact_streaks/up.sql", import.meta.url), "utf8")
  execFileSync("docker", ["exec", "-i", pg, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1"], { input: streakMigration, stdio: ["pipe", "pipe", "pipe"] })
  const streakLink = (await linkAction("owner", "create")).link
  const variedGame = { ...game("streak-five"), table: 2, results: Array.from({ length: 5 }, (_, i) => ({ table: 2, multiplier: i + 1, correct: true })) }
  const streakSaved = await practice(streakLink.token, "save_session", variedGame)
  assert.equal(streakSaved.data.streaks.child.current, 5)
  assert.equal(streakSaved.data.streaks.child.best, 5)
  assert.deepEqual(Object.keys(streakSaved.data.streaks), ["child"])
  assert.deepEqual((await practice(streakLink.token, "save_session", variedGame)).data.streaks, streakSaved.data.streaks)
  const repeated = await practice(streakLink.token, "save_session", { ...variedGame, id: "streak-repeat" })
  assert.deepEqual(repeated.data.streaks.child, streakSaved.data.streaks.child)
  const broken = await practice(streakLink.token, "save_session", { ...variedGame, id: "streak-break", results: [{ table: 2, multiplier: 3, correct: false }] })
  assert.equal(broken.data.streaks.child.current, 0)
  assert.equal(broken.data.streaks.child.best, 5)
  assert.deepEqual((await action("owner", "load", { familyId })).data.streaks.child, broken.data.streaks.child)
  assert.deepEqual((await practice(streakLink.token, "save_session", variedGame)).data.streaks.child, broken.data.streaks.child, "late retry cannot grow or restore a broken streak")
  assert.ok((await graphql("owner", '{multiply_player_streaks{player_id}}')).errors, "streak ledger stays private")
  console.log("Streak API checks passed: varied facts, replay protection, mistakes, saved best, private child snapshots, and parent visibility.")
  if (process.env.MULTIPLY_BROWSER_FIXTURE) {
    const link = (await linkAction("owner", "create")).link
    await writeFile(process.env.MULTIPLY_BROWSER_FIXTURE, JSON.stringify({ endpoint, token: link.token, familyId, ownerSession: { accessToken: jwt("owner"), refreshToken: "local-fixture", accessTokenExpiresIn: 600, user: { id: ids.owner, email: "owner@example.test" }, decodedToken: { exp: Date.now() + 600000 } } }), { mode: 0o600 })
    console.log("Browser fixture ready. Interrupt this process to remove disposable containers.")
    const keepAlive = setInterval(() => {}, 1000)
    await new Promise(resolve => { process.once("SIGINT", resolve); process.once("SIGTERM", resolve) })
    clearInterval(keepAlive)
  }
} finally {
  for (const container of [engine, pg]) { try { docker("rm", "-f", container) } catch {} }
  try { docker("network", "rm", name) } catch {}
}
