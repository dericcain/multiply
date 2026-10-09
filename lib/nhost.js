import { createClient } from "@nhost/nhost-js"

export const nhost = createClient({
  subdomain: process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || "ykevmgaitwkucccphxbv",
  region: process.env.NEXT_PUBLIC_NHOST_REGION || "us-east-1",
})

export const PROFILE_QUERY = `
  query GetMultiplyProfile {
    multiply_profiles {
      data
    }
  }
`

export const PROFILE_UPSERT = `
  mutation SaveMultiplyProfile($data: jsonb!) {
    insert_multiply_profiles_one(
      object: { data: $data }
      on_conflict: {
        constraint: multiply_profiles_pkey
        update_columns: [data, updated_at]
      }
    ) {
      user_id
    }
  }
`

export async function loadRemoteData() {
  const response = await nhost.graphql.request({ query: PROFILE_QUERY })
  if (response.body.errors?.length) throw new Error(response.body.errors[0].message)
  return response.body.data?.multiply_profiles?.[0]?.data || null
}

export async function saveRemoteData(data) {
  const response = await nhost.graphql.request({ query: PROFILE_UPSERT, variables: { data } })
  if (response.body.errors?.length) throw new Error(response.body.errors[0].message)
}
