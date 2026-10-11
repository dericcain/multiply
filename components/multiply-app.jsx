"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowRight, Check, ChevronLeft, Clock3, Pencil, Plus, Settings, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import playerModalStyles from "@/components/player-modal.module.css"
import { loadFamily, nhost, saveFamilyPlayer, saveFamilySession, acceptFamilyInvitation } from "@/lib/nhost"
import { FamilySettings } from "@/components/family-settings"
import { pendingGames, storePendingGame, removePendingGame } from "@/components/family-outbox"

import { statKey, isMastered, playerProgress, MASTERY_BONUS } from "@/lib/progression"
import { Journey, FamilyStandings, MasteryCelebration } from "@/components/progression"

const accessDenied = error => error.code === "FAMILY_ACCESS_REVOKED" || /Family access denied/i.test(error.message)
const activeFamilyKey = userId => `multiply:active-family:${userId}`
const emptyData = { players: [], stats: {}, sessions: [] }
const fisherYates = items => { const copy = [...items]; for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]] } return copy }
const pct = (right, total) => total ? Math.round(right / total * 100) : 0


function Shell({ player, back, settings, children }) { return <main className="mx-auto min-h-dvh max-w-xl bg-background px-4 pb-9 sm:shadow-2xl"><header className="flex h-20 items-center justify-between">{back ? <Button variant="ghost" size="icon" aria-label="Go back" className="size-11 rounded-2xl" onClick={back}><ChevronLeft className="size-5" /></Button> : <div className="size-11" aria-hidden="true" />}<div className="text-3xl font-black tracking-tight text-foreground">multiply<span className="text-[var(--coral)]">!</span></div>{settings ? <Button variant="ghost" size="icon" aria-label="Settings" title="Settings" className="size-11 rounded-2xl" onClick={settings}><Settings className="size-5" aria-hidden="true" /></Button> : player ? <div className="grid size-10 place-items-center rounded-2xl bg-[var(--coral)] font-black text-white">{player.name[0]}</div> : <div className="size-11" />}</header><section>{children}</section></main> }
function Title({ children, subtitle }) { return <><h1 className="font-[family-name:var(--font-display)] text-4xl font-black tracking-tight text-foreground">{children}</h1>{subtitle && <p className="mt-1 text-base font-semibold text-muted-foreground">{subtitle}</p>}</> }

export function MultiplyApp() {
  const [data, setData] = useState(emptyData), [ready, setReady] = useState(false), [session, setSession] = useState(null), [screen, setScreen] = useState("players"), [playerId, setPlayerId] = useState(null)
  const [mode, setMode] = useState("practice"), [table, setTable] = useState(1), [max, setMax] = useState(1), [answerMode, setAnswerMode] = useState("choice"), [timed, setTimed] = useState(false), [minutes, setMinutes] = useState(5)
  const [questions, setQuestions] = useState([]), [index, setIndex] = useState(0), [results, setResults] = useState([]), [feedback, setFeedback] = useState(null), [answerProgress, setAnswerProgress] = useState(0), [input, setInput] = useState(""), [endPending, setEndPending] = useState(false), [secondsLeft, setSecondsLeft] = useState(null), [editing, setEditing] = useState(null)
  const progressionTimers = useRef({ interval: null, timeout: null })
  const answerInputRef = useRef(null)
  const player = data.players.find(p => p.id === playerId)
  const [snapshot, setSnapshot] = useState(null), [loadError, setLoadError] = useState(""), [inviteToken, setInviteToken] = useState(null)
  const [pendingSession, setPendingSession] = useState(null), [saving, setSaving] = useState(false), [saveError, setSaveError] = useState("")
  const [reward, setReward] = useState(null)
  const rewardBaseline = useRef(null)
  const accountId = useRef(null)
  const scope = useRef(0), request = useRef(0), busyRef = useRef(false)
  const stateRef = useRef({})
  stateRef.current = { screen, editing, pendingSession, familyId: snapshot?.family.id }
  const applySnapshot = next => { setSnapshot(next); setData(next.data); setLoadError(""); try { window.localStorage.setItem(activeFamilyKey(next.userId), next.family.id) } catch {} }
  const revokeAccess = message => {
    scope.current++; request.current++; clearAnswerProgress(); setPendingSession(null); setResults([]); setSaving(false); busyRef.current = false
    try { window.localStorage.removeItem(activeFamilyKey(nhost.getUserSession()?.user.id)) } catch {}
    setSnapshot(null); setData(emptyData); setPlayerId(null); setEditing(null); setScreen("players"); setLoadError(message)
  }
  const restoreOutbox = next => {
    try {
      const game = pendingGames(window.localStorage, next.userId, next.family.id).find(game => next.data.players.some(p => p.id === game.playerId))
      if (game) {
        setReward(null); rewardBaseline.current = null; setPendingSession(game); setResults(game.results); setPlayerId(game.playerId); setMode(game.mode); setAnswerMode(game.answerMode); setMax(game.maxMultiplier); setScreen("results"); setSaveError("Your last game is waiting to save. Retry to keep its progress.")
        return true
      }
    } catch {}
    return false
  }
  const activateFamily = next => {
    clearAnswerProgress(); setPendingSession(null); setResults([]); setSaving(false); setSaveError(""); setEditing(null); setPlayerId(null); setScreen("players"); applySnapshot(next); restoreOutbox(next)
  }
  const fetchFamily = async (familyId, background = false) => {
    if (!familyId) { try { familyId = window.localStorage.getItem(activeFamilyKey(nhost.getUserSession()?.user.id)) || undefined } catch {} }
    const epoch = scope.current, sequence = ++request.current
    if (!background) { setReady(false); setLoadError("") }
    try {
      const next = await loadFamily(familyId)
      if (epoch !== scope.current || sequence !== request.current) return
      if (background && familyId && next.family.id !== familyId) {
        revokeAccess("Your access to this family has changed. Reload to choose an available family."); setReady(true); return
      }
      if (background && (stateRef.current.screen === "play" || stateRef.current.editing || stateRef.current.pendingSession || busyRef.current)) return
      applySnapshot(next)
      restoreOutbox(next)
      if (familyId && next.family.id !== familyId) { setPlayerId(null); setScreen("players") }
    } catch (error) {
      if (epoch !== scope.current || sequence !== request.current) return
      if (accessDenied(error)) {
        revokeAccess("Your access to this family has changed. Try again to choose an available family."); setReady(true)
      } else if (!background) {
        setSnapshot(null); setData(emptyData); setPlayerId(null); setEditing(null); setScreen("players"); setLoadError(error.message || "We couldn’t load your family. Please try again.")
      }
    } finally { if (epoch === scope.current && sequence === request.current) setReady(true) }
  }
  const syncAccount = current => {
    if ((current?.user.id || null) === accountId.current) return false
    accountId.current = current?.user.id || null
    scope.current++; request.current++; clearAnswerProgress(); busyRef.current = false
    setPendingSession(null); setResults([]); setSaveError(""); setSaving(false); setSnapshot(null); setData(emptyData); setEditing(null); setPlayerId(null); setScreen("players"); setLoadError(""); setSession(current)
    if (current) fetchFamily(); else setReady(true)
    return true
  }
  useEffect(() => {
    setInviteToken(new URL(window.location.href).searchParams.get("invite"))
    const unsubscribe = nhost.sessionStorage.onChange(syncAccount)
    const current = nhost.getUserSession()
    if (current) { if (!syncAccount(current)) { setSession(current); fetchFamily() } } else setReady(true)
    const storage = () => syncAccount(nhost.getUserSession())
    window.addEventListener("storage", storage)
    return () => { scope.current++; request.current++; unsubscribe(); window.removeEventListener("storage", storage) }
  }, [])
  useEffect(() => {
    if (!session) return
    const refresh = () => {
      const current = nhost.getUserSession()
      if (syncAccount(current)) return
      if (current && document.visibilityState === "visible") fetchFamily(stateRef.current.familyId, true)
    }
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh)
    const poll = setInterval(refresh, 30000)
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); clearInterval(poll) }
  }, [session])
  useEffect(() => {
    if (!pendingSession && screen !== "play") return
    const guard = event => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", guard)
    return () => window.removeEventListener("beforeunload", guard)
  }, [pendingSession, screen])
  const clearInvite = () => { setInviteToken(null); const url = new URL(window.location.href); url.searchParams.delete("invite"); window.history.replaceState(null, "", url) }
  const signOut = async () => {
    scope.current++; request.current++; clearAnswerProgress(); setReady(false)
    const current = nhost.getUserSession()
    try { if (current) await nhost.auth.signOut({ refreshToken: current.refreshToken }) } catch {}
    finally {
      nhost.clearSession(); setSession(null); setSnapshot(null); setData(emptyData); setEditing(null); setPlayerId(null); setScreen("players"); setLoadError(""); setPendingSession(null); setResults([]); setSaveError(""); setSaving(false); busyRef.current = false; setReady(true)
    }
  }
  const savePlayer = async proposed => {
    const epoch = scope.current; const familyId = snapshot.family.id
    request.current++; busyRef.current = true
    try { const next = await saveFamilyPlayer(familyId, { ...proposed, id: proposed.id || crypto.randomUUID() }); if (epoch !== scope.current) return false; request.current++; applySnapshot(next); return true }
    catch (error) { if (epoch === scope.current) { if (accessDenied(error)) { revokeAccess("Your access to this family has changed. Try again to choose an available family."); return false } throw error } return false }
    finally { if (epoch === scope.current) busyRef.current = false }
  }
  const persistSession = async gameSession => {
    if (busyRef.current) return
    const epoch = scope.current; const userId = snapshot.userId, familyId = snapshot.family.id; request.current++; busyRef.current = true; setSaving(true); setSaveError("")
    try { const next = await saveFamilySession(snapshot.family.id, gameSession); if (epoch === scope.current) { request.current++; try { removePendingGame(window.localStorage, userId, familyId, gameSession.id) } catch {} if (rewardBaseline.current?.id === gameSession.id) {
      const before = rewardBaseline.current.progress, after = playerProgress(next.data.stats, gameSession.playerId)
      const earned = after.mastered.filter(fact => !before.mastered.includes(fact) && gameSession.results.some(r => `${r.table} × ${r.multiplier}` === fact))
      setReward({ earned, level: after.level > before.level ? after.level : null, xp: gameSession.correct + earned.length * MASTERY_BONUS })
      rewardBaseline.current = null
    }
    applySnapshot(next); setPendingSession(null); restoreOutbox(next) } }
    catch (error) { if (epoch === scope.current) { if (accessDenied(error)) revokeAccess("Your access to this family has changed. Try again to choose an available family."); else setSaveError(error.message || "Your results haven’t saved yet. Try again.") } }
    finally { if (epoch === scope.current) { setSaving(false); busyRef.current = false } }
  }
  useEffect(() => { if (screen !== "play" || mode !== "practice" || !timed || secondsLeft === null) return; if (secondsLeft <= 0) { setEndPending(true); return } const timer = setTimeout(() => setSecondsLeft(s => s - 1), 1000); return () => clearTimeout(timer) }, [screen, mode, timed, secondsLeft])
  useEffect(() => { if (screen === "play" && answerMode === "type" && !feedback) answerInputRef.current?.focus({ preventScroll: true }) }, [screen, answerMode, index, questions, feedback])
  useEffect(() => () => { clearInterval(progressionTimers.current.interval); clearTimeout(progressionTimers.current.timeout) }, [])
  const facts = useMemo(() => player ? Array.from({ length: player.maxTable * player.maxMultiplier }, (_, i) => data.stats[statKey(playerId, Math.floor(i / player.maxMultiplier) + 1, i % player.maxMultiplier + 1)]) : [], [data.stats, player, playerId])
  const answerChoices = useMemo(() => {
    const q = questions[index]
    if (!q) return []

    const values = new Set([q.table * q.multiplier])
    for (let n = 1; values.size < 4; n++) {
      values.add(Math.max(0, q.table * q.multiplier - n))
      values.add(q.table * q.multiplier + n)
    }
    return fisherYates([...values])
  }, [questions, index])
  const clearAnswerProgress = () => { clearInterval(progressionTimers.current.interval); clearTimeout(progressionTimers.current.timeout); progressionTimers.current = { interval: null, timeout: null } }
  const begin = () => { setReward(null); rewardBaseline.current = null; clearAnswerProgress(); setQuestions(fisherYates(Array.from({ length: max }, (_, i) => ({ table, multiplier: i + 1 })))); setIndex(0); setResults([]); setFeedback(null); setAnswerProgress(0); setInput(""); setEndPending(false); setSecondsLeft(mode === "practice" && timed ? minutes * 60 : null); setScreen("play") }
  const saveSession = final => {
    if (busyRef.current || stateRef.current.pendingSession) return
    clearAnswerProgress()
    const correct = final.filter(r => r.correct).length, attempts = final.length
    const gameSession = { id: crypto.randomUUID(), playerId, mode, answerMode, table, maxMultiplier: max, correct, attempts, percentage: pct(correct, attempts), score: mode === "challenge" ? Math.round(correct / max * (answerMode === "type" ? 125 : 100)) : null, date: Date.now(), results: final }
    rewardBaseline.current = { id: gameSession.id, progress: playerProgress(data.stats, playerId) }
    try { storePendingGame(window.localStorage, snapshot.userId, snapshot.family.id, gameSession) } catch {}
    setPendingSession(gameSession); setScreen("results"); persistSession(gameSession)
  }
  const advance = final => { clearAnswerProgress(); setFeedback(null); setAnswerProgress(0); setInput(""); if (endPending || (mode === "challenge" && index + 1 >= questions.length)) return saveSession(final); if (mode === "practice" && index + 1 >= questions.length) { setQuestions(fisherYates(Array.from({ length: max }, (_, i) => ({ table, multiplier: i + 1 })))); setIndex(0) } else setIndex(i => i + 1) }
  const scheduleAdvance = final => { clearAnswerProgress(); const started = Date.now(); progressionTimers.current.interval = setInterval(() => setAnswerProgress(Math.min(100, (Date.now() - started) / 70)), 100); progressionTimers.current.timeout = setTimeout(() => advance(final), 7000) }
  const answer = value => { if (feedback) return; const q = questions[index], submitted = Number(value), correct = submitted === q.table * q.multiplier, next = [...results, { ...q, correct }]; setResults(next); setFeedback({ correct, answer: q.table * q.multiplier, submitted, results: next }); setAnswerProgress(0); setInput(""); scheduleAdvance(next) }
  if (!ready) return <Shell><div className="py-20 text-center text-muted-foreground">Loading…</div></Shell>
  if (!session) return <AuthScreen invited={!!inviteToken} onAuthenticated={syncAccount} />
  if (loadError || !snapshot) return <Shell><Title subtitle={loadError || "Please load your family to continue."}>Let’s try again</Title><Primary onClick={() => fetchFamily()}>Retry loading family</Primary><Button variant="ghost" className="mt-3 w-full" onClick={signOut}>Sign out</Button></Shell>
  if (inviteToken && !pendingSession) return <InvitationScreen email={session.user.email} cancel={clearInvite} accept={async () => { const epoch = scope.current; const next = await acceptFamilyInvitation(inviteToken); if (epoch !== scope.current) return; request.current++; activateFamily(next); clearInvite() }} />
  if (screen === "family") {
    const epoch = scope.current
    return <Shell back={() => { scope.current++; request.current++; setScreen("players") }}><FamilySettings key={snapshot.family.id} snapshot={snapshot} refresh={() => { if (epoch === scope.current && accountId.current === snapshot.userId && stateRef.current.familyId === snapshot.family.id) return fetchFamily(snapshot.family.id, true) }} switchFamily={familyId => { if (epoch !== scope.current) return; scope.current++; setPlayerId(null); setScreen("players"); fetchFamily(familyId) }} signOut={signOut} /></Shell>
  }
  if (screen === "players") return <Shell settings={() => setScreen("family")}><div className="flex items-center justify-between"><div><Title>Who&apos;s playing?</Title></div><Button variant="secondary" size="icon" className="rounded-2xl" onClick={() => setScreen("leaderboard")}><Trophy /><span className="sr-only">Family scores</span></Button></div><div className="mt-7 grid gap-3">{data.players.map((p, i) => <Card key={p.id} className={`overflow-hidden border-0 shadow-md ${["bg-[var(--coral)]", "bg-[var(--sky)]", "bg-[var(--success)]", "bg-[var(--grape)]"][i % 4]}`}><CardContent className="flex items-center gap-3 p-3"><Button variant="ghost" className="h-16 flex-1 justify-start gap-3 rounded-2xl px-2 text-left text-white hover:bg-white/15 hover:text-white" onClick={() => { setPlayerId(p.id); setTable(1); setMax(p.maxMultiplier); setScreen("activity") }}><span className="grid size-11 place-items-center rounded-full bg-white/20 text-xl font-black">{p.name[0]}</span><span><span className="block text-xl font-black">{p.name}</span><span className="block text-sm font-bold opacity-90">Level {playerProgress(data.stats, p.id).level} · {playerProgress(data.stats, p.id).count}/225 mastered</span></span></Button><Button variant="ghost" size="icon" className="rounded-xl text-white hover:bg-white/15 hover:text-white" onClick={() => setEditing(p)}><Pencil /><span className="sr-only">Edit {p.name}</span></Button></CardContent></Card>)}</div><Button className="mt-5 h-12 w-full rounded-2xl" variant="secondary" onClick={() => setEditing({ id: null, name: "", maxTable: 5, maxMultiplier: 5 })}><Plus /> Add a player</Button><FamilyStandings data={data} /><PlayerSheet player={editing} close={() => setEditing(null)} save={savePlayer} /></Shell>
  if (screen === "leaderboard") return <Leaderboard data={data} back={() => setScreen("players")} />
  if (screen === "activity") return <Shell player={player} back={() => setScreen("players")}><Title>Choose an activity</Title><Journey progress={playerProgress(data.stats, playerId)} /><div className="mt-7 grid grid-cols-2 gap-4"><ModeCard emoji="🌱" title="Practice" note="No score" color="bg-[var(--coral)]" onClick={() => { setMode("practice"); setScreen("table") }} /><ModeCard emoji="🏆" title="Challenge" note="Earn points" color="bg-[var(--grape)]" onClick={() => { setMode("challenge"); setScreen("table") }} /></div><Card className="mt-7"><CardContent className="p-5"><h2 className="font-[family-name:var(--font-display)] text-xl font-black">Your progress</h2><Progress aria-label="Facts mastered in your practice range" className="mt-4 h-3" value={pct(facts.filter(isMastered).length, facts.length)} /><div className="mt-4 grid grid-cols-3 gap-2 text-center"><Metric value={`${pct(facts.filter(Boolean).reduce((n, s) => n + s.correct, 0), facts.filter(Boolean).reduce((n, s) => n + s.attempts, 0))}%`} label="correct" /><Metric value={`${facts.filter(isMastered).length}/${facts.length}`} label="facts mastered" /><Metric value={facts.length - facts.filter(isMastered).length} label="to practice" /></div><p className="mt-3 text-center text-xs text-muted-foreground">Tables 1–{player.maxTable}, multiplied by 1–{player.maxMultiplier}</p></CardContent></Card><FamilyStandings data={data} activePlayer={playerId} /></Shell>
  if (screen === "table") return <Shell player={player} back={() => setScreen("activity")}><Title>Choose a times table</Title><div className="mt-7 grid grid-cols-4 gap-3">{Array.from({ length: player.maxTable }, (_, i) => { const t = i + 1, done = Array.from({ length: player.maxMultiplier }, (_, m) => isMastered(data.stats[statKey(playerId, t, m + 1)])).every(Boolean); return <Button key={t} variant="secondary" className="relative h-16 rounded-2xl text-xl font-black" onClick={() => { setTable(t); setMax(player.maxMultiplier); setScreen("range") }}>{t}{done && <Check className="absolute right-2 top-2 size-4 text-[var(--success)]" />}</Button> })}</div></Shell>
  if (screen === "range") return <Shell player={player} back={() => setScreen("table")}><Title>Up to what number?</Title><Card className="mt-8"><CardContent className="p-7 text-center"><p className="font-[family-name:var(--font-display)] text-2xl font-black">{table} × 1 <span className="text-[var(--coral)]">→</span> {table} × {max}</p><p className="my-5 font-[family-name:var(--font-display)] text-6xl font-black text-primary">{max}</p><Slider aria-label="Multiply by numbers up to" min={1} max={player.maxMultiplier} value={[max]} onValueChange={v => setMax(v[0])} /></CardContent></Card><Primary onClick={() => setScreen("answer")}>Next</Primary></Shell>
  if (screen === "answer") return <Shell player={player} back={() => setScreen("range")}><Title>How do you want to answer?</Title><OptionGroup value={answerMode} onChange={setAnswerMode} options={[{ value: "choice", icon: "🔘", title: "Pick an answer" }, { value: "type", icon: "⌨️", title: "Type an answer", note: mode === "challenge" ? "25% more points" : null }]} />{mode === "practice" ? <Primary onClick={() => setScreen("length")}>Next</Primary> : <Primary onClick={begin}>Start challenge</Primary>}</Shell>
  if (screen === "length") return <Shell player={player} back={() => setScreen("answer")}><Title>How long?</Title><OptionGroup value={timed ? "timed" : "keep"} onChange={v => setTimed(v === "timed")} options={[{ value: "keep", icon: "∞", title: "Keep going", note: "Stop when you choose" }, { value: "timed", icon: "⏱", title: "Use a timer" }]} />{timed && <Card className="mt-5"><CardContent className="p-5"><Label className="font-bold">{minutes} minute{minutes > 1 ? "s" : ""}</Label><Slider aria-label="Practice time in minutes" className="mt-5" min={1} max={10} value={[minutes]} onValueChange={v => setMinutes(v[0])} /></CardContent></Card>}<Primary onClick={begin}>Start practice</Primary></Shell>
  if (screen === "play") { const q = questions[index]; return <Shell player={player} back={() => results.length ? saveSession(results) : setScreen("activity")}><div className="flex justify-between text-sm font-bold text-muted-foreground"><span>{mode === "challenge" ? `${index + 1} of ${questions.length}` : "Practice"}</span>{secondsLeft !== null && <span className="flex items-center gap-1"><Clock3 className="size-4" /> {Math.ceil(secondsLeft / 60)} min</span>}</div><div className="py-12 text-center"><div className="font-[family-name:var(--font-display)] text-7xl font-black tracking-tighter">{q.table} <span className="text-[var(--coral)]">×</span> {q.multiplier}</div>{feedback ? <><p className="mt-2 font-semibold text-muted-foreground">Your answer: {feedback.submitted}</p><p role="status" className={`mt-3 font-[family-name:var(--font-display)] text-3xl font-black ${feedback.correct ? "text-[var(--success)]" : "text-[var(--coral)]"}`}>{feedback.correct ? "✓ Correct!" : `The answer is ${feedback.answer}`}</p><Progress aria-label="Time until next question" className="mt-5 h-3" value={answerProgress} /><p className="mt-2 text-sm font-semibold text-muted-foreground">Next question in {Math.max(0, Math.ceil((100 - answerProgress) * .07))} seconds</p><Button className="mt-5 h-12 w-full rounded-2xl text-lg font-black" onClick={() => advance(feedback.results)}>Next question <ArrowRight /></Button></> : null}</div>{answerMode === "choice" ? <div className="grid grid-cols-2 gap-3">{answerChoices.map(v => <Button key={v} variant="secondary" className="h-24 rounded-3xl font-black" style={{ fontSize: "3rem" }} onClick={() => answer(v)}>{v}</Button>)}</div> : <form onSubmit={e => { e.preventDefault(); if (input) answer(input) }}><Input aria-label="Your answer" ref={answerInputRef} autoFocus inputMode="numeric" className="h-20 rounded-3xl px-4 py-0 text-center font-black" style={{ fontSize: "2.5rem", lineHeight: 1 }} value={input} onChange={e => setInput(e.target.value.replace(/\D/g, ""))} /><Primary type="submit">Check answer</Primary></form>}{mode === "practice" && <Button variant="outline" className="h-12 w-full rounded-2xl border-2 border-[var(--coral)] bg-transparent font-black text-[var(--coral)] hover:bg-[var(--coral)]/10 hover:text-[var(--coral)]" style={{ marginTop: "2.5rem" }} onClick={() => results.length ? saveSession(results) : setScreen("activity")}>End practice</Button>}</Shell> }
  return <Results reward={reward} progress={playerProgress(data.stats, playerId)} player={player} results={results} mode={mode} answerMode={answerMode} max={max} pending={pendingSession} saving={saving} error={saveError} retry={() => persistSession(pendingSession)} again={() => setScreen("table")} home={() => setScreen("activity")} />
}

function AuthScreen({ onAuthenticated, invited }) {
  const [mode, setMode] = useState("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const submit = async event => {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      const response = mode === "signin"
        ? await nhost.auth.signInEmailPassword({ email, password })
        : await nhost.auth.signUpEmailPassword({ email, password })
      if (response.body.error) throw new Error(response.body.error.message || (mode === "signup" ? "We couldn’t create your account. Please try again." : "We couldn’t sign you in. Please try again."))
      const current = nhost.getUserSession()
      if (!current) {
        setError(mode === "signup" ? "Check your email to verify your account, then sign in." : "We couldn’t sign you in. Please try again.")
      } else {
        onAuthenticated(current)
      }
    } catch (authError) {
      setError(authError.message || (mode === "signup" ? "We couldn’t create your account. Please try again." : "We couldn’t sign you in. Please try again."))
    } finally {
      setBusy(false)
    }
  }
  return <Shell><div className="mx-auto max-w-md py-12"><Title subtitle={invited ? "Sign in with the email the invitation was sent to, then accept it." : "For parents: save your family’s progress."}>{mode === "signin" ? "Welcome back" : "Create your account"}</Title><form className="mt-8 grid gap-4" onSubmit={submit}><div className="grid gap-2"><Label htmlFor="auth-email" className="font-bold">Email</Label><Input id="auth-email" type="email" required autoComplete="email" className="h-12 rounded-xl px-4" value={email} onChange={event => setEmail(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="auth-password" className="font-bold">Password</Label><Input id="auth-password" type="password" required minLength={9} autoComplete={mode === "signin" ? "current-password" : "new-password"} className="h-12 rounded-xl px-4" value={password} onChange={event => setPassword(event.target.value)} /></div>{mode === "signup" && <p className="text-sm text-muted-foreground">Use at least 9 characters for your password.</p>}{error && <p role="alert" className="rounded-xl bg-[var(--coral)]/10 p-3 text-sm font-semibold text-[var(--coral)]">{error}</p>}<Primary type="submit" disabled={busy}>{busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}</Primary></form><Button variant="ghost" className="mt-4 w-full" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError("") }}>{mode === "signin" ? "Create an account" : "Sign in"}</Button></div></Shell>
}

function Primary(props) { return <Button {...props} className={`mt-7 h-14 w-full rounded-2xl text-lg font-black shadow-lg shadow-primary/20 ${props.className || ""}`} /> }
function Metric({ value, label }) { return <div><b className="block font-[family-name:var(--font-display)] text-xl">{value}</b><span className="text-xs font-bold text-muted-foreground">{label}</span></div> }
function ModeCard({ emoji, title, note, color, onClick }) { return <Button onClick={onClick} className={`h-44 flex-col rounded-3xl ${color} text-white shadow-lg hover:opacity-90`}><span className="text-4xl">{emoji}</span><b className="mt-2 text-xl">{title}</b><small className="font-semibold opacity-90">{note}</small></Button> }
function OptionGroup({ value, onChange, options }) { return <RadioGroup className="mt-7 grid gap-3" value={value} onValueChange={onChange}>{options.map(o => <Label key={o.value} className={`flex cursor-pointer items-center gap-4 rounded-2xl border-2 p-4 ${value === o.value ? "border-primary bg-primary/5" : "bg-card"}`}><RadioGroupItem value={o.value} /><span className="text-2xl">{o.icon}</span><span><b className="block text-lg">{o.title}</b>{o.note && <small className="font-semibold text-muted-foreground">{o.note}</small>}</span></Label>)}</RadioGroup> }
function PlayerSheet({ player, close, save }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("")
  const draftId = useRef(null)
  const [name, setName] = useState("")
  const [maxTable, setTable] = useState(5)
  const [maxMultiplier, setMultiplier] = useState(5)

  useEffect(() => {
    draftId.current = player?.id || crypto.randomUUID(); setError(""); setName(player?.name || "")
    setTable(player?.maxTable || 5)
    setMultiplier(player?.maxMultiplier || 5)
  }, [player])

  return <Sheet open={!!player} onOpenChange={open => !open && !busy && close()}>
    <SheetContent side="center" className={`${playerModalStyles.content} rounded-3xl`}>
      <SheetHeader className={playerModalStyles.header}>
        <SheetTitle className="font-[family-name:var(--font-display)] text-2xl font-black">
          {player?.id ? "Edit player" : "Add player"}
        </SheetTitle>
        <SheetDescription className="sr-only">Set the player’s name and multiplication range.</SheetDescription>
      </SheetHeader>
      <form className={playerModalStyles.form} onSubmit={async e => {
        e.preventDefault()
        if (name.trim()) {
          setBusy(true); setError("")
          try { if (await save({ ...player, id: draftId.current, name: name.trim(), maxTable, maxMultiplier })) close() } catch (failure) { setError(failure.message || "Couldn’t save this player. Try again.") } finally { setBusy(false) }
        }
      }}>
        <div className={playerModalStyles.field}>
          <Label htmlFor="player-name" className="font-bold">Name</Label>
          <Input id="player-name" className="h-12 rounded-xl px-4" value={name} onChange={e => setName(e.target.value)} autoFocus />
        </div>
        <div className={playerModalStyles.sliderField}>
          <Label className="flex items-center justify-between font-bold">Times tables up to <b className="text-primary">{maxTable}</b></Label>
          <Slider aria-label="Times tables up to" min={1} max={15} value={[maxTable]} onValueChange={v => setTable(v[0])} />
        </div>
        <div className={playerModalStyles.sliderField}>
          <Label className="flex items-center justify-between font-bold">Multiply each by numbers up to <b className="text-primary">{maxMultiplier}</b></Label>
          <Slider aria-label="Multiply each by numbers up to" min={1} max={15} value={[maxMultiplier]} onValueChange={v => setMultiplier(v[0])} />
        </div>
        <p className="text-sm text-muted-foreground">Tables 1–{maxTable}, multiplied by 1–{maxMultiplier}.</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button disabled={busy} type="submit" className={`${playerModalStyles.saveButton} h-12 w-full rounded-2xl text-lg font-black`}>{busy ? "Saving…" : "Save player"}</Button>
      </form>
    </SheetContent>
  </Sheet>
}
function Results({ reward, progress, player, results, mode, answerMode, max, again, home, pending, saving, error, retry }) { const correct = results.filter(r => r.correct).length, grouped = Object.values(results.reduce((all, r) => { const key = `${r.table}x${r.multiplier}`; (all[key] ||= []).push(r); return all }, {})).map(list => ({ ...list[0], accuracy: pct(list.filter(x => x.correct).length, list.length) })).sort((a, b) => a.accuracy - b.accuracy), weak = grouped.filter(x => x.accuracy < 80).slice(0, 3), score = mode === "challenge" ? Math.round(correct / max * (answerMode === "type" ? 125 : 100)) : null; return <Shell player={player}><div className="pt-4 text-center"><div className="text-5xl">{correct / results.length >= .8 ? "🌟" : "💪"}</div><Title>{mode === "challenge" ? "Challenge complete!" : "Nice work!"}</Title>{!pending && reward && <MasteryCelebration reward={reward} />}{score !== null && <p className="mt-3 font-[family-name:var(--font-display)] text-6xl font-black text-[var(--coral)]">{score}<small className="block text-sm text-muted-foreground">points</small></p>}<b className="mt-4 block text-xl">{pct(correct, results.length)}% correct</b><p className="font-semibold text-muted-foreground">{correct} of {results.length} correct</p>{weak.length > 0 && <Card className="mt-7 text-left"><CardContent className="p-5"><h2 className="font-[family-name:var(--font-display)] text-xl font-black">Keep practicing</h2>{weak.map(x => <div key={`${x.table}x${x.multiplier}`} className="flex justify-between py-3 font-bold"><span>{x.table} × {x.multiplier}</span><span className="text-[var(--coral)]">{x.accuracy}% correct</span></div>)}</CardContent></Card>}{pending && <div className="mt-5 rounded-xl border p-4" role="status"><p>{saving ? "Saving your results…" : error || "Your results are waiting to save."}</p>{!saving && <Button className="mt-3" onClick={retry}>Save results</Button>}</div>}<Journey progress={progress} /><Primary disabled={!!pending} onClick={again}>Try another times table</Primary><Button disabled={!!pending} variant="ghost" className="mt-3" onClick={home}>Activities</Button></div></Shell> }
function Leaderboard({ data, back }) { const rows = data.players.map(player => { const sessions = data.sessions.filter(s => s.playerId === player.id), challenges = sessions.filter(s => s.mode === "challenge" && typeof s.score === "number"), avg = group => group.length ? Math.round(group.reduce((n, s) => n + s.percentage, 0) / group.length) : null; return { player, best: challenges.length ? Math.max(...challenges.map(s => s.score)) : null, improvement: avg(sessions.slice(-5)) !== null && avg(sessions.slice(-10, -5)) !== null ? avg(sessions.slice(-5)) - avg(sessions.slice(-10, -5)) : null } }).sort((a, b) => (b.best ?? -1) - (a.best ?? -1)); return <Shell back={back}><Title>Family scores</Title><FamilyStandings data={data} alwaysShow /><LeaderboardCard title="🏆 Personal best" rows={rows} value={r => r.best ?? "—"} /><LeaderboardCard title="🌱 Recent accuracy change" rows={rows} value={r => r.improvement === null ? "—" : `${r.improvement >= 0 ? "↑ +" : "↓ "}${r.improvement} percentage points`} /></Shell> }
function LeaderboardCard({ title, rows, value }) { return <Card className="mt-6"><CardContent className="p-5"><h2 className="font-[family-name:var(--font-display)] text-xl font-black">{title}</h2>{rows.map((r, i) => <div key={r.player.id}><div className="flex items-center gap-3 py-3"><Badge variant="secondary" className="size-7 justify-center rounded-full">{i + 1}</Badge><b className="flex-1">{r.player.name}</b><span className="font-black text-primary text-right">{value(r)}</span></div>{i < rows.length - 1 && <Separator />}</div>)}</CardContent></Card> }

function InvitationScreen({ email, accept, cancel }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("")
  return <Shell><Title>You’re invited</Title><Card className="mt-7"><CardContent className="grid gap-4 p-5"><p>Signed in as <strong className="break-all">{email}</strong>.</p><p className="text-sm text-muted-foreground">Accept with the verified email this invitation was sent to. You’ll have access to all the kids in this family. Your existing family and its history will stay separate.</p>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await accept() } catch (failure) { setError(failure.message === "Invitation unavailable or expired" ? "This invitation is unavailable or expired. Ask the family owner for a new link." : failure.message || "Couldn’t accept this invitation. Try again.") } finally { setBusy(false) } }}>{busy ? "Joining…" : "Accept invitation"}</Button><Button disabled={busy} variant="outline" onClick={cancel}>Cancel</Button></CardContent></Card></Shell>
}
