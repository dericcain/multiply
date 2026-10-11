"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { emailFamilyInvitation, cancelFamilyInvitation, removeFamilyMember } from "@/lib/nhost"

export function FamilySettings({ snapshot, refresh, switchFamily, signOut }) {
  const [email, setEmail] = useState("")
  const [invite, setInvite] = useState(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState(null)
  const owner = snapshot.family.ownerId === snapshot.userId
  const run = async action => {
    setBusy(true); setError(""); setNotice("")
    try { await action(); await refresh() } catch (failure) { setError(failure.message || "Something went wrong. Please try again.") } finally { setBusy(false) }
  }
  return <div className="grid gap-5">
    <div><h1 className="font-[family-name:var(--font-display)] text-4xl font-black">Settings</h1></div>
    {snapshot.families.length > 1 && <div className="grid gap-2"><Label htmlFor="family-choice">Family</Label><select id="family-choice" disabled={busy} className="h-12 w-full rounded-xl border bg-background px-3" value={snapshot.family.id} onChange={event => switchFamily(event.target.value)}>{snapshot.families.map((family, index) => <option key={family.id} value={family.id}>{family.label || `Family ${index + 1}`}</option>)}</select><p className="text-sm text-muted-foreground">Each family keeps its own players and history.</p></div>}
    <Card><CardContent className="grid gap-4 p-5"><h2 className="text-xl font-black">Parents</h2>{snapshot.members.map(member => <div key={member.userId} className="flex flex-wrap items-center justify-between gap-2"><div><p className="break-all font-bold">{member.email}{member.userId === snapshot.userId && " (you)"}</p><p className="text-sm text-muted-foreground">{member.role === "owner" ? "Family owner" : "Parent"}</p></div>{owner && member.userId !== snapshot.userId && (removing === member.userId ? <div className="grid gap-2"><p className="text-sm">Remove their access? Kids’ history will stay.</p><div className="flex gap-2"><Button disabled={busy} variant="destructive" onClick={() => run(async () => { await removeFamilyMember(snapshot.family.id, member.userId); setRemoving(null) })}>Remove access</Button><Button disabled={busy} variant="outline" onClick={() => setRemoving(null)}>Keep access</Button></div></div> : <Button disabled={busy} variant="outline" onClick={() => setRemoving(member.userId)}>Remove</Button>)}</div>)}</CardContent></Card>
    {owner ? <Card><CardContent className="grid gap-4 p-5"><h2 className="text-xl font-black">Invite a parent</h2><p className="text-sm text-muted-foreground">They can see all players’ progress and edit learning settings. Only you manage parent access.</p><form className="grid gap-3" onSubmit={event => { event.preventDefault(); run(async () => { const result = await emailFamilyInvitation(snapshot.family.id, email.trim()); const url = new URL(window.location.href); url.search = ""; url.hash = ""; url.searchParams.set("invite", result.invitation.token); setInvite({ ...result.invitation, emailSent: result.emailSent, emailError: result.emailError, url: url.toString() }); setEmail(""); setNotice(result.emailSent ? `Invitation email sent to ${result.invitation.email}.` : result.emailError || "Invitation created. Copy and share the link below.") }) }}><Label htmlFor="parent-email">Parent’s email</Label><Input id="parent-email" type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="parent@example.com" /><Button type="submit" disabled={busy}>{busy ? "Working…" : "Send invitation"}</Button></form>{invite && <div className="grid gap-2 rounded-xl bg-secondary p-4"><p className="text-sm font-semibold">{invite.emailSent ? `Sign in with the verified email ${invite.email} to accept.` : `Share this link with ${invite.email}. They must sign in with that verified email to accept.`}</p><Label htmlFor="invite-link">Invitation link</Label><Input id="invite-link" readOnly value={invite.url} onFocus={event => event.target.select()} /><Button disabled={busy} variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(invite.url); setNotice("Invitation link copied.") } catch { setNotice("Select the link above to copy it.") } }}>Copy link</Button></div>}{snapshot.invitations.length > 0 && <div className="grid gap-3"><h3 className="font-bold">Pending invitations</h3>{snapshot.invitations.map(invitation => <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-2"><div><p className="break-all font-semibold">{invitation.email}</p><p className="text-xs text-muted-foreground">Expires {new Date(invitation.expiresAt).toLocaleDateString()}</p></div><Button disabled={busy} variant="outline" onClick={() => run(async () => { await cancelFamilyInvitation(snapshot.family.id, invitation.id); if (invite?.id === invitation.id) setInvite(null) })}>Cancel invitation</Button></div>)}</div>}</CardContent></Card> : <p className="text-sm text-muted-foreground">The family owner manages invitations and parent access.</p>}
    {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}{notice && <p role="status" className="text-sm">{notice}</p>}
    <Button disabled={busy} variant="outline" onClick={signOut}>Sign out</Button>
  </div>
}
