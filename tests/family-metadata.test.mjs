import assert from "node:assert/strict"
import { test } from "node:test"
import { withFamilyMetadata } from "../scripts/apply-family-metadata.mjs"

test("family metadata preserves Nhost sources and permissions, and removes full-profile writes", () => {
  const original = { version: 3, sources: [{ name: "default", kind: "postgres", configuration: { connection_info: { database_url: { from_env: "NHOST_DATABASE_URL" } } }, tables: [
    { table: { schema: "auth", name: "users" }, select_permissions: [{ role: "me", permission: { columns: ["id"] } }] },
    { table: { schema: "public", name: "multiply_profiles" }, select_permissions: [{ role: "user", permission: { columns: ["data"] } }], insert_permissions: [{ role: "user" }, { role: "support" }], update_permissions: [{ role: "user" }] },
  ] }], actions: [{ name: "existing_action" }] }
  const merged = withFamilyMetadata(original)
  assert.deepEqual(merged.actions, original.actions)
  assert.deepEqual(merged.sources[0].configuration, original.sources[0].configuration)
  assert.deepEqual(merged.sources[0].tables[0], original.sources[0].tables[0])
  const profile = merged.sources[0].tables[1]
  assert.deepEqual(profile.insert_permissions, [{ role: "support" }])
  assert.deepEqual(profile.update_permissions, [])
  assert.equal(original.sources[0].tables[1].update_permissions.length, 1)
  assert.deepEqual(withFamilyMetadata(merged), merged)
  const result = merged.sources[0].tables[2]
  assert.deepEqual(result.select_permissions[0].permission.filter, { user_id: { _eq: "X-Hasura-User-Id" } })
  assert.equal(merged.sources[0].functions[0].configuration.session_argument, "hasura_session")
})

test("refuses to apply against a missing or unexpected source", () => {
  assert.throws(() => withFamilyMetadata({ sources: [] }), /source/)
  assert.throws(() => withFamilyMetadata({ sources: [{ name: "default", kind: "postgres" }] }), /multiply_profiles/)
})

test("child practice exposes only its token-checked RPC to the public role", () => {
  const merged = withFamilyMetadata({ version: 3, sources: [{ name: "default", kind: "postgres", tables: [{ table: { schema: "public", name: "multiply_profiles" } }] }] })
  const source = merged.sources[0]
  assert.deepEqual(source.functions.filter(fn => fn.permissions.some(p => p.role === "public")).map(fn => fn.function.name), ["multiply_practice_action"])
  const practice = source.tables.find(table => table.table.name === "multiply_practice_action_results")
  assert.deepEqual(practice.select_permissions, [{ role: "public", permission: { columns: ["result"], filter: {} } }])
  assert.equal(practice.insert_permissions, undefined)
  assert.equal(source.tables.some(table => table.table.name === "multiply_player_links"), false)
})
