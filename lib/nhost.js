import { createClient } from "@nhost/nhost-js"

export const nhost = createClient({
  subdomain: process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || "ykevmgaitwkucccphxbv",
  region: process.env.NEXT_PUBLIC_NHOST_REGION || "us-east-1",
  ...(process.env.NEXT_PUBLIC_NHOST_AUTH_URL && { authUrl: process.env.NEXT_PUBLIC_NHOST_AUTH_URL }),
  ...(process.env.NEXT_PUBLIC_NHOST_GRAPHQL_URL && { graphqlUrl: process.env.NEXT_PUBLIC_NHOST_GRAPHQL_URL }),
})

export const FAMILY_ACTION_MUTATION = `
  mutation MultiplyFamilyAction($action: String!, $payload: jsonb!) {
    multiply_family_action(args: { action: $action, payload: $payload }) {
      result
    }
  }
`

async function familyAction(action, payload = {}) {
  let response
  try {
    response = await nhost.graphql.request({
      query: FAMILY_ACTION_MUTATION,
      variables: { action, payload },
    })
  } catch (error) {
    if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
      throw new Error("We couldn’t connect. Check your connection and try again.", { cause: error })
    }
    throw error
  }
  const graphqlError = response.body.errors?.[0]
  if (graphqlError) {
    const error = new Error(graphqlError.message)
    error.code = graphqlError.extensions?.code
    error.sqlState = graphqlError.extensions?.internal?.error?.status_code
    throw error
  }
  const result = response.body.data?.multiply_family_action?.[0]?.result
  if (result?.error) {
    const error = new Error(result.error.message)
    error.sqlState = result.error.code
    error.code = result.error.message === "Family access denied" ? "FAMILY_ACCESS_REVOKED" : result.error.code
    throw error
  }
  if (!result) throw new Error("We couldn’t load your family. Please try again.")
  return result
}

export function loadFamily(familyId) {
  return familyAction("load", familyId ? { familyId } : {})
}

export function createFamilyInvitation(familyId, email) {
  return familyAction("invite", { familyId, email })
}

export async function emailFamilyInvitation(familyId, email) {
  const session = nhost.getUserSession()
  if (!session?.accessToken) throw new Error("Please sign in and try again.")

  const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || "ykevmgaitwkucccphxbv"
  const region = process.env.NEXT_PUBLIC_NHOST_REGION || "us-east-1"
  const endpoint = `https://${subdomain}.functions.${region}.nhost.run/v1/family-invitation`

  let response
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({ familyId, email }),
    })
  } catch (error) {
    throw new Error("We couldn’t connect to send the invitation. Please try again.", { cause: error })
  }

  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || "We couldn’t create the invitation. Please try again.")
  if (!result.invitation?.token) throw new Error("We couldn’t create the invitation. Please try again.")
  return result
}

export function cancelFamilyInvitation(familyId, invitationId) {
  return familyAction("cancel_invitation", { familyId, invitationId })
}

export function acceptFamilyInvitation(token) {
  return familyAction("accept_invitation", { token })
}

export function removeFamilyMember(familyId, userId) {
  return familyAction("remove_member", { familyId, userId })
}

export function saveFamilyPlayer(familyId, player) {
  return familyAction("save_player", { familyId, player })
}

export function saveFamilySession(familyId, gameSession) {
  return familyAction("save_session", { familyId, gameSession })
}
