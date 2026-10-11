"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { playerLinkAction } from "@/lib/nhost"
import { practiceLink } from "@/lib/practice-links"

export function PracticeLinks({ familyId, players }) {
  const [links, setLinks] = useState(null)
  const [created, setCreated] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [replacing, setReplacing] = useState(null)
  const load = async () => {
    setBusy(true); setError("")
    try { setLinks((await playerLinkAction("list", familyId)).links) }
    catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  useEffect(() => { let active = true; playerLinkAction("list", familyId).then(result => { if (active) setLinks(result.links) }).catch(failure => { if (active) setError(failure.message) }); return () => { active = false } }, [familyId])
  const update = async (action, player) => {
    setBusy(true); setError(""); setNotice("")
    try {
      const result = await playerLinkAction(action, familyId, player.id)
      setLinks(result.links); setReplacing(null)
      if (action === "create") { setCreated({ playerId: player.id, name: player.name, url: practiceLink(window.location.origin, result.link.token) }); setNotice(`Practice link ready for ${player.name}.`) }
      else { if (created?.playerId === player.id) setCreated(null); setNotice(`${player.name}’s practice link is disabled.`) }
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  return <Card><CardContent className="grid gap-4 p-5">
    <h2 className="text-xl font-black">Kids’ practice links</h2>
    <p className="text-sm text-muted-foreground">Send each child a link to play on their phone without a parent login. Their progress saves here. Wi-Fi or mobile data is needed.</p>
    <p className="text-sm text-muted-foreground">Anyone with a link can practice as that child. It opens only their player and has no parent settings. Allow this website’s domain on their phone.</p>
    {links && players.map(player => {
      const active = links.some(link => link.playerId === player.id)
      return <div key={player.id} className="grid gap-2 rounded-xl bg-muted p-3">
        <p className="break-words font-bold">{player.name}</p>
        <p className="text-sm">{active ? "Practice link enabled" : "No active practice link"}</p>
        {replacing === player.id ? <><p className="text-sm">The previous link will stop working. Send the new link to {player.name} afterward.</p><div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => update("create", player)}>Replace link</Button><Button disabled={busy} variant="outline" onClick={() => setReplacing(null)}>Keep current link</Button></div></> : <div className="flex flex-wrap gap-2"><Button disabled={busy} variant="outline" onClick={() => active ? setReplacing(player.id) : update("create", player)}>{active ? "Create replacement link" : "Create practice link"}</Button>{active && <Button disabled={busy} variant="outline" onClick={() => update("revoke", player)}>Disable link</Button>}</div>}
      </div>
    })}
    {created && <div className="grid gap-3 rounded-xl border border-primary/30 p-4">
      <Label htmlFor="practice-link">{created.name}’s practice link</Label>
      <Input id="practice-link" readOnly value={created.url} onFocus={event => event.target.select()} />
      <p className="text-xs text-muted-foreground">Copy or share it now. To share again later, create a replacement.</p>
      <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={async () => { try { await navigator.clipboard.writeText(created.url); setNotice("Practice link copied.") } catch { setNotice("Select the link above to copy it.") } }}>Copy link</Button>{typeof navigator !== "undefined" && navigator.share && <Button disabled={busy} variant="outline" onClick={async () => { try { await navigator.share({ title: "Multiply practice", text: `Practice your times tables, ${created.name}!`, url: created.url }) } catch (failure) { if (failure.name !== "AbortError") setNotice("Copy the link above to share it.") } }}>Share link</Button>}</div>
    </div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {!links && <Button disabled={busy} variant="outline" onClick={load}>{busy ? "Loading…" : "Load practice links"}</Button>}
  </CardContent></Card>
}
