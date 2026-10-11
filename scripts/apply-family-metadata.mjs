import { pathToFileURL } from "node:url"

// Merge these entries into an export from the running engine. Do not replace
// Nhost's auth/storage source configuration with this repo's partial fragments.
export function withFamilyMetadata(existing) {
  const metadata = structuredClone(existing)
  const source = metadata.sources?.find(item => item.name === "default")
  if (!source || source.kind !== "postgres") throw new Error("The default PostgreSQL source was not found.")
  source.tables ||= []
  const profile = source.tables.find(item => item.table?.schema === "public" && item.table?.name === "multiply_profiles")
  if (!profile) throw new Error("The legacy multiply_profiles table must already be tracked.")
  for (const type of ["insert_permissions", "update_permissions", "delete_permissions"]) {
    if (profile[type]) profile[type] = profile[type].filter(item => item.role !== "user")
  }
  const resultTable = {
    table: { schema: "public", name: "multiply_family_action_results" },
    select_permissions: [{ role: "user", permission: { columns: ["result"], filter: { user_id: { _eq: "X-Hasura-User-Id" } } } }],
  }
  source.tables = source.tables.filter(item => !(item.table?.schema === "public" && item.table?.name === "multiply_family_action_results"))
  source.tables.push(resultTable)
  source.functions = (source.functions || []).filter(item => !(item.function?.schema === "public" && item.function?.name === "multiply_family_action"))
  source.functions.push({
    function: { schema: "public", name: "multiply_family_action" },
    configuration: { exposed_as: "mutation", session_argument: "hasura_session" },
    permissions: [{ role: "user" }],
  })
  return metadata
}

async function main() {
  const endpoint = process.env.HASURA_METADATA_URL
  const secret = process.env.HASURA_GRAPHQL_ADMIN_SECRET
  if (!endpoint || !secret) throw new Error("Set HASURA_METADATA_URL (ending in /v1/metadata) and HASURA_GRAPHQL_ADMIN_SECRET.")
  const call = async (type, args) => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", "x-hasura-admin-secret": secret },
      body: JSON.stringify({ type, args }),
    })
    const body = await response.json()
    if (!response.ok) throw new Error(`${type} failed: ${body.error || response.status}`)
    return body
  }
  // v2 export supplies resource_version to prevent overwriting simultaneous
  // changes made in the console or by another deployment.
  const exportedResponse = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", "x-hasura-admin-secret": secret },
    body: JSON.stringify({ type: "export_metadata", version: 2, args: {} }),
  })
  const exported = await exportedResponse.json()
  if (!exportedResponse.ok || !exported.metadata || !exported.resource_version) throw new Error("Could not export versioned Hasura metadata.")
  const replacement = withFamilyMetadata(exported.metadata)
  const appliedResponse = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", "x-hasura-admin-secret": secret },
    body: JSON.stringify({ type: "replace_metadata", version: 2, resource_version: exported.resource_version, args: { allow_inconsistent_metadata: false, metadata: replacement } }),
  })
  const applied = await appliedResponse.json()
  if (!appliedResponse.ok || applied.is_consistent === false) throw new Error(`Metadata apply failed: ${applied.error || "inconsistent metadata"}`)
  const consistency = await call("get_inconsistent_metadata", {})
  if (!consistency.is_consistent) throw new Error("Hasura metadata is inconsistent after apply.")
  console.log("Shared-family metadata applied; existing Nhost metadata preserved.")
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
