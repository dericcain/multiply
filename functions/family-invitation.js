const allowedOrigins = new Set([
  "https://playmultiply.com",
  "https://www.playmultiply.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
])

const mutation = `
  mutation MultiplyFamilyAction($action: String!, $payload: jsonb!) {
    multiply_family_action(args: { action: $action, payload: $payload }) {
      result
    }
  }
`

function reply(res, status, body) {
  return res.status(status).json(body)
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character])
}

export default async function familyInvitation(req, res) {
  const origin = req.headers.origin
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin)
    res.setHeader("Vary", "Origin")
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type")
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  }

  if (req.method === "OPTIONS") return res.status(204).end()
  if (req.method !== "POST") return reply(res, 405, { error: "Method not allowed." })
  if (origin && !allowedOrigins.has(origin)) return reply(res, 403, { error: "Origin not allowed." })

  const authorization = req.headers.authorization
  if (typeof authorization !== "string" || !/^Bearer\s+\S+$/i.test(authorization)) {
    return reply(res, 401, { error: "Please sign in and try again." })
  }

  const { familyId, email } = req.body || {}
  if (typeof familyId !== "string" || !/^[0-9a-f-]{36}$/i.test(familyId)) {
    return reply(res, 400, { error: "Choose a valid family and try again." })
  }
  if (typeof email !== "string" || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return reply(res, 400, { error: "Enter a valid email address." })
  }

  let invitation
  try {
    const graphql = await fetch(process.env.NHOST_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization,
      },
      body: JSON.stringify({
        query: mutation,
        variables: { action: "invite", payload: { familyId, email: email.trim() } },
      }),
    })
    const result = await graphql.json()
    if (!graphql.ok || result.errors?.length) {
      const message = result.errors?.[0]?.message || "We couldn’t create the invitation. Please try again."
      const status = graphql.status === 401 || graphql.status === 403 ? graphql.status : 400
      return reply(res, status, { error: message })
    }
    invitation = result.data?.multiply_family_action?.[0]?.result
    if (!invitation?.token || !invitation?.email) throw new Error("The family service returned an incomplete invitation.")
  } catch (error) {
    console.error("Family invitation creation failed", error.message)
    return reply(res, 502, { error: "We couldn’t create the invitation. Please try again." })
  }

  const inviteUrl = `https://playmultiply.com/?invite=${encodeURIComponent(invitation.token)}`
  if (!process.env.BREVO_API_KEY) {
    return reply(res, 200, { invitation, emailSent: false, emailError: "Email isn’t configured yet. Copy and share the invitation link." })
  }

  try {
    const brevo = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": process.env.BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Multiply", email: "noreply@playmultiply.com" },
        to: [{ email: invitation.email }],
        subject: "You’re invited to join a family on Multiply",
        textContent: `You’ve been invited to join a family on Multiply. Sign in with ${invitation.email} to accept the invitation:\n\n${inviteUrl}\n\nIf you weren’t expecting this email, you can ignore it.`,
        htmlContent: `<html><body style="font-family:Arial,sans-serif;color:#18181b;line-height:1.6"><h1 style="font-size:24px">You’re invited to Multiply</h1><p>You’ve been invited to join a family on Multiply. Sign in with <strong>${escapeHtml(invitation.email)}</strong> to accept:</p><p><a href="${inviteUrl}" style="display:inline-block;padding:12px 18px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">Accept invitation</a></p><p style="font-size:13px;color:#52525b">If you weren’t expecting this email, you can ignore it.</p></body></html>`,
      }),
    })

    if (!brevo.ok) {
      console.error("Brevo rejected family invitation email", { status: brevo.status })
      return reply(res, 200, { invitation, emailSent: false, emailError: "The invitation was created, but the email couldn’t be sent. Copy and share the link instead." })
    }
    return reply(res, 200, { invitation, emailSent: true })
  } catch (error) {
    console.error("Brevo family invitation request failed", error.message)
    return reply(res, 200, { invitation, emailSent: false, emailError: "The invitation was created, but the email couldn’t be sent. Copy and share the link instead." })
  }
}
