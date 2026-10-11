import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHmac, randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
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
  execFileSync("docker", ["exec", "-i", pg, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1"], { input: [fixture, oldMigration, legacy, migration].join("\n"), stdio: ["pipe", "pipe", "pipe"] })
  docker("run", "-d", "--rm", "--name", engine, "--network", name, "-p", "127.0.0.1::8080", "-e", `HASURA_GRAPHQL_DATABASE_URL=postgres://postgres:${password}@${pg}:5432/postgres`, "-e", `HASURA_GRAPHQL_ADMIN_SECRET=${admin}`, "-e", `HASURA_GRAPHQL_JWT_SECRET=${JSON.stringify({ type: "HS256", key: jwtKey })}`, "-e", "HASURA_GRAPHQL_DEV_MODE=false", "hasura/graphql-engine:v2.48.10-ce")
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
  await assert.rejects(action("outsider", "load", { familyId }), { code: "42501", message: "Family access denied" })
  const invite = await action("owner", "invite", { familyId, email: "PARENT@example.test" })
  await assert.rejects(action("outsider", "accept_invitation", { token: invite.token }), /verified invited email/)
  const joined = await action("parent", "accept_invitation", { token: invite.token })
  assert.equal(joined.family.id, familyId)
  assert.equal(joined.families.length, 2)
  assert.equal((await action("parent", "load", { familyId: original.family.id })).data.players[0].name, "Original child")
  await assert.rejects(action("parent", "invite", { familyId, email: "outsider@example.test" }), /Only the family owner/)
  const game = id => ({ id, playerId: "child", mode: "practice", answerMode: "choice", table: 1, maxMultiplier: 5, date: Date.now(), results: [{ table: 1, multiplier: 1, correct: true }] })
  await Promise.all(Array.from({ length: 10 }, (_, i) => action(i % 2 ? "parent" : "owner", "save_session", { familyId, gameSession: game(`concurrent-${i}`) })))
  let loaded = await action("parent", "load", { familyId })
  assert.equal(loaded.data.stats["child:1x1"].attempts, 12)
  assert.equal(loaded.data.stats["child:1x1"].correct, 11)
  await action("parent", "save_session", { familyId, gameSession: game("concurrent-0") })
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
  console.log("Shared-family API checks passed: real JWT identity, production errors, concurrent games/players, retry idempotence, invitations, family isolation, access removal.")
} finally {
  for (const container of [engine, pg]) { try { docker("rm", "-f", container) } catch {} }
  try { docker("network", "rm", name) } catch {}
}
