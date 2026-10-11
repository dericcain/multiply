import { readFile } from "node:fs/promises"
import { spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"

// An isolated disposable database on a local PostgreSQL Docker container.
const container = process.env.PG_CONTAINER
if (!container) throw new Error("Set PG_CONTAINER to a local test PostgreSQL container (for example multiply-family-pg).")
const database = `multiply_test_${randomUUID().replaceAll("-", "")}`
const command = (program, args, input) => {
  const result = spawnSync("docker", ["exec", "-i", container, program, "-U", "postgres", ...args], { input, encoding: "utf8" })
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message || `${program} failed`)
  return result.stdout
}
const fixture = `CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, email_verified boolean NOT NULL DEFAULT true);
INSERT INTO auth.users (id, email, email_verified) VALUES
('10000000-0000-4000-8000-000000000001','owner@example.test',true),
('10000000-0000-4000-8000-000000000002','parent@example.test',true),
('10000000-0000-4000-8000-000000000003','outsider@example.test',true),
('10000000-0000-4000-8000-000000000004','unverified@example.test',false);
`
const legacy = `INSERT INTO public.multiply_profiles (user_id, data) VALUES ('10000000-0000-4000-8000-000000000001', '{"players":[{"id":"legacy","name":"Legacy child","maxTable":7,"maxMultiplier":8}],"stats":{"legacy:2x3":{"attempts":12,"correct":11,"recent":[true,false]}},"sessions":[{"id":"legacy-game","playerId":"legacy","score":123}],"customField":{"keep":"exactly"}}');`
try {
  command("createdb", [database])
  const files = await Promise.all([
    readFile(new URL("../nhost/migrations/default/20261004000000_create_multiply_profiles/up.sql", import.meta.url), "utf8"),
    readFile(new URL("../nhost/migrations/default/20261011000000_shared_families/up.sql", import.meta.url), "utf8"),
    readFile(new URL("family-database.sql", import.meta.url), "utf8"),
  ])
  command("psql", ["-d", database, "-v", "ON_ERROR_STOP=1"], [fixture, files[0], legacy, files[1], files[2]].join("\n"))
  console.log("Shared-family database assertions passed: migration, permissions, invitations, independent saves, retries, eviction, and access removal.")
} finally {
  command("dropdb", [database])
}
