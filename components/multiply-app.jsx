"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronLeft, Clock3, Pencil, Plus, Settings, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import playerModalStyles from "@/components/player-modal.module.css"
import { loadFamily, nhost, saveFamilyPlayer, saveFamilySession, acceptFamilyInvitation } from "@/lib/nhost"
import { useFeatureFlags } from "@/components/feature-flags"
import { FamilySettings } from "@/components/family-settings"
import { pendingGames, storePendingGame, removePendingGame } from "@/components/family-outbox"

import { statKey, isMastered, playerProgress } from "@/lib/progression"
import { Journey, FamilyStandings, MasteryCelebration } from "@/components/progression"
import { MultiplyLogo } from "@/components/multiply-logo"
import { FeedbackCountdown } from "@/components/feedback-countdown"
import { StreakBadge } from "@/components/streak-badge"
import { streakProgress } from "@/lib/streaks"
import { practiceAction } from "@/lib/practice-links"

const accessDenied = error => error.code === "42501" || error.code === "FAMILY_ACCESS_REVOKED" || /Family access denied/i.test(error.message)
const activeFamilyKey = userId => `multiply:active-family:${userId}`
const emptyData = { players: [], stats: {}, sessions: [] }
const fisherYates = items => { const copy = [...items]; for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]] } return copy }
const pct = (right, total) => total ? Math.round(right / total * 100) : 0


function Shell({ player, xp = 0, pendingXp = 0, back, settings, children }) {
  return (
    <main className="mx-auto min-h-dvh max-w-xl bg-background px-4 pb-9 sm:shadow-2xl">
      <header className="flex h-20 items-center gap-2">
        {back && <Button variant="ghost" size="icon" aria-label="Go back" className="size-11 shrink-0 rounded-2xl" onClick={back}><ChevronLeft className="size-5" /></Button>}
        <MultiplyLogo />
        <div className="ml-auto shrink-0">
          {settings ? <Button variant="ghost" size="icon" aria-label="Settings" title="Settings" className="size-11 rounded-2xl" onClick={settings}><Settings className="size-5" aria-hidden="true" /></Button> : player ? <div className="grid size-10 place-items-center rounded-2xl bg-[var(--coral)] font-black text-white">{player.name[0]}</div> : null}
        </div>
      </header>
      <section>{player && <div className="mb-5 flex items-center gap-3 rounded-2xl bg-muted p-3"><span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-lg font-black text-primary-foreground">{player.name[0]}</span><div className="min-w-0 flex-1"><p className="break-words font-black">{player.name}</p><p className="text-sm font-bold">{xp.toLocaleString()} XP{pendingXp > 0 && <span className="ml-2">+{pendingXp} pending</span>}</p></div></div>}{children}</section>
    </main>
  )
}
function Title({ children, subtitle }) { return <><h1 className="font-[family-name:var(--font-display)] text-4xl font-black tracking-tight text-foreground">{children}</h1>{subtitle && <p className="mt-1 text-base font-semibold text-muted-foreground">{subtitle}</p>}</> }

export function MultiplyApp() {
  const { childPracticeLinks } = useFeatureFlags()
  const [childToken, setChildToken] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("play"))
  useEffect(() => {
    const changed = () => setChildToken(new URLSearchParams(window.location.hash.slice(1)).get("play"))
    window.addEventListener("hashchange", changed)
    return () => window.removeEventListener("hashchange", changed)
  }, [])
  if (childToken && !childPracticeLinks) return <Shell><Title subtitle="Practice links are not available right now. Please try again later.">Practice is paused</Title></Shell>
  return <GameApp key={childToken || "parent"} childToken={childToken} />
}

function GameApp({ childToken }) {
  const [data, setData] = useState(emptyData), [ready, setReady] = useState(false), [session, setSession] = useState(null), [screen, setScreen] = useState("players"), [playerId, setPlayerId] = useState(null)
  const [mode, setMode] = useState("practice"), [table, setTable] = useState(1), [max, setMax] = useState(1), [answerMode, setAnswerMode] = useState("choice"), [timed, setTimed] = useState(false), [minutes, setMinutes] = useState(5)
  const [questions, setQuestions] = useState([]), [index, setIndex] = useState(0), [results, setResults] = useState([]), [feedback, setFeedback] = useState(null), [input, setInput] = useState(""), [endPending, setEndPending] = useState(false), [secondsLeft, setSecondsLeft] = useState(null), [editing, setEditing] = useState(null)
  const [streakStart, setStreakStart] = useState(null)
  const answerInputRef = useRef(null)
  const player = data.players.find(p => p.id === playerId)
  const currentProgress = playerProgress(data.stats, playerId, player || {}, data.xp?.[playerId] ?? 0)
  const liveStreak = streakProgress(streakStart ?? data.streaks?.[playerId], results)
  const nextTargetStat = currentProgress.nextTarget && data.stats[statKey(playerId, currentProgress.nextTarget.table, currentProgress.nextTarget.multiplier)]
  const [snapshot, setSnapshot] = useState(null), [loadError, setLoadError] = useState(""), [inviteToken, setInviteToken] = useState(null)
  const [pendingSession, setPendingSession] = useState(null), [saving, setSaving] = useState(false), [saveError, setSaveError] = useState("")
  const [reward, setReward] = useState(null)
  const [saveErrorCode, setSaveErrorCode] = useState(null)
  const answerLocked = useRef(false)
  const accountId = useRef(null)
  const scope = useRef(0), request = useRef(0), busyRef = useRef(false)
  const stateRef = useRef({})
  stateRef.current = { screen, editing, pendingSession, familyId: snapshot?.family.id }
  const applySnapshot = next => {
    setSnapshot(next); setData(next.data); setLoadError("")
    if (childToken) { setPlayerId(next.data.players[0].id); setMax(current => Math.min(current, next.data.players[0].maxMultiplier)); setTable(current => Math.min(current, next.data.players[0].maxTable)) }
    else { try { window.localStorage.setItem(activeFamilyKey(next.userId), next.family.id) } catch {} }
  }
  const revokeAccess = message => {
    scope.current++; request.current++; resetAnswerLock(); setPendingSession(null); setResults([]); setSaving(false); busyRef.current = false
    try { window.localStorage.removeItem(activeFamilyKey(nhost.getUserSession()?.user.id)) } catch {}
    setSnapshot(null); setData(emptyData); setPlayerId(null); setEditing(null); setScreen("players"); setLoadError(message)
  }
  const restoreOutbox = next => {
    try {
      const game = pendingGames(window.localStorage, next.userId, next.family.id).find(game => next.data.players.some(p => p.id === game.playerId))
      if (game) {
        setReward(null); setStreakStart(next.data.streaks?.[game.playerId] ?? null); answerLocked.current = false; setPendingSession(game); setResults(game.results); setPlayerId(game.playerId); setMode(game.mode); setAnswerMode(game.answerMode); setMax(game.maxMultiplier); setScreen("results"); setSaveError("Your last game is waiting to save. Retry to keep its progress.")
        return true
      }
    } catch {}
    return false
  }
  const activateFamily = next => {
    resetAnswerLock(); setPendingSession(null); setResults([]); setSaving(false); setSaveError(""); setEditing(null); setPlayerId(null); setScreen("players"); applySnapshot(next); restoreOutbox(next)
  }
  const fetchFamily = async (familyId, background = false) => {
    if (!childToken && !familyId) { try { familyId = window.localStorage.getItem(activeFamilyKey(nhost.getUserSession()?.user.id)) || undefined } catch {} }
    const epoch = scope.current, sequence = ++request.current
    if (!background) { setReady(false); setLoadError("") }
    try {
      const next = childToken ? await practiceAction(childToken, "load") : await loadFamily(familyId)
      if (epoch !== scope.current || sequence !== request.current) return
      if (background && familyId && next.family.id !== familyId) {
        revokeAccess("Your access to this family has changed. Reload to choose an available family."); setReady(true); return
      }
      if (background && (stateRef.current.screen === "play" || stateRef.current.editing || stateRef.current.pendingSession || busyRef.current)) return
      applySnapshot(next)
      if (childToken && stateRef.current.screen === "players") { setScreen("activity"); setMax(next.data.players[0].maxMultiplier) }
      restoreOutbox(next)
      if (familyId && next.family.id !== familyId) { setPlayerId(null); setScreen("players") }
    } catch (error) {
      if (epoch !== scope.current || sequence !== request.current) return
      if (accessDenied(error)) {
        revokeAccess(childToken ? "This practice link is unavailable. Ask a parent for a new link." : "Your access to this family has changed. Try again to choose an available family."); setReady(true)
      } else if (!background) {
        setSnapshot(null); setData(emptyData); setPlayerId(null); setEditing(null); setScreen("players"); setLoadError(error.message || "We couldn’t load your family. Please try again.")
      }
    } finally { if (epoch === scope.current && sequence === request.current) setReady(true) }
  }
  const syncAccount = current => {
    if ((current?.user.id || null) === accountId.current) return false
    accountId.current = current?.user.id || null
    scope.current++; request.current++; resetAnswerLock(); busyRef.current = false
    setPendingSession(null); setResults([]); setSaveError(""); setSaving(false); setSnapshot(null); setData(emptyData); setEditing(null); setPlayerId(null); setScreen("players"); setLoadError(""); setSession(current)
    if (current) fetchFamily(); else setReady(true)
    return true
  }
  useEffect(() => {
    if (childToken) { fetchFamily(); return () => { scope.current++; request.current++ } }
    setInviteToken(new URL(window.location.href).searchParams.get("invite"))
    const unsubscribe = nhost.sessionStorage.onChange(syncAccount)
    const current = nhost.getUserSession()
    if (current) { if (!syncAccount(current)) { setSession(current); fetchFamily() } } else setReady(true)
    const storage = () => syncAccount(nhost.getUserSession())
    window.addEventListener("storage", storage)
    return () => { scope.current++; request.current++; unsubscribe(); window.removeEventListener("storage", storage) }
  }, [])
  useEffect(() => {
    if (!session && !childToken) return
    const refresh = () => {
      if (childToken) { if (document.visibilityState === "visible") fetchFamily(stateRef.current.familyId, true); return }
      const current = nhost.getUserSession()
      if (syncAccount(current)) return
      if (current && document.visibilityState === "visible") fetchFamily(stateRef.current.familyId, true)
    }
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh)
    const poll = setInterval(refresh, 30000)
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); clearInterval(poll) }
  }, [session, childToken])
  useEffect(() => {
    if (!pendingSession && screen !== "play") return
    const guard = event => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", guard)
    return () => window.removeEventListener("beforeunload", guard)
  }, [pendingSession, screen])
  const clearInvite = () => { setInviteToken(null); const url = new URL(window.location.href); url.searchParams.delete("invite"); window.history.replaceState(null, "", url) }
  const signOut = async () => {
    scope.current++; request.current++; resetAnswerLock(); setReady(false)
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
    catch (error) { if (epoch === scope.current) { if (accessDenied(error)) { revokeAccess(childToken ? "This practice link is unavailable. Ask a parent for a new link." : "Your access to this family has changed. Try again to choose an available family."); return false } throw error } return false }
    finally { if (epoch === scope.current) busyRef.current = false }
  }
  const persistSession = async gameSession => {
    if (busyRef.current) return
    const epoch = scope.current; const userId = snapshot.userId, familyId = snapshot.family.id; request.current++; busyRef.current = true; setSaving(true); setSaveError(""); setSaveErrorCode(null)
    try { const next = childToken ? await practiceAction(childToken, "save_session", gameSession) : await saveFamilySession(snapshot.family.id, gameSession); if (epoch === scope.current) { request.current++; try { removePendingGame(window.localStorage, userId, familyId, gameSession.id) } catch {} setReward(next.award || null)
    applySnapshot(next); setPendingSession(null); restoreOutbox(next) } }
    catch (error) { if (epoch === scope.current) { if (accessDenied(error)) revokeAccess(childToken ? "This practice link is unavailable. Ask a parent for a new link." : "Your access to this family has changed. Try again to choose an available family."); else { setSaveErrorCode(error.code); setSaveError(error.message || "Your results haven’t saved yet. Try again.") } } }
    finally { if (epoch === scope.current) { setSaving(false); busyRef.current = false } }
  }
  useEffect(() => { if (screen !== "play" || mode !== "practice" || !timed || secondsLeft === null) return; if (secondsLeft <= 0) { setEndPending(true); return } const timer = setTimeout(() => setSecondsLeft(s => s - 1), 1000); return () => clearTimeout(timer) }, [screen, mode, timed, secondsLeft])
  useEffect(() => { if (screen === "play" && answerMode === "type" && !feedback) answerInputRef.current?.focus({ preventScroll: true }) }, [screen, answerMode, index, questions, feedback])
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
  const resetAnswerLock = () => { answerLocked.current = false }
  const begin = () => { setStreakStart(streakProgress(data.streaks?.[playerId])); setReward(null); answerLocked.current = false; resetAnswerLock(); setQuestions(fisherYates(Array.from({ length: max }, (_, i) => ({ table, multiplier: i + 1 })))); setIndex(0); setResults([]); setFeedback(null); setInput(""); setEndPending(false); setSecondsLeft(mode === "practice" && timed ? minutes * 60 : null); setScreen("play") }
  const saveSession = final => {
    if (busyRef.current || stateRef.current.pendingSession) return
    resetAnswerLock()
    const correct = final.filter(r => r.correct).length, attempts = final.length
    const gameSession = { id: crypto.randomUUID(), playerId, mode, answerMode, table, maxMultiplier: max, correct, attempts, percentage: pct(correct, attempts), score: mode === "challenge" ? Math.round(correct / max * (answerMode === "type" ? 125 : 100)) : null, date: Date.now(), results: final }
    try { storePendingGame(window.localStorage, snapshot.userId, snapshot.family.id, gameSession) } catch {}
    setPendingSession(gameSession); setScreen("results"); persistSession(gameSession)
  }
  const discardInvalidRound = async () => {
    try { removePendingGame(window.localStorage, snapshot.userId, snapshot.family.id, pendingSession.id) } catch {}
    setPendingSession(null); setResults([]); setReward(null); setSaveErrorCode(null); setScreen("activity")
    await fetchFamily()
  }
  const advance = final => { answerLocked.current = false; resetAnswerLock(); setFeedback(null); setInput(""); if (endPending || (mode === "challenge" && index + 1 >= questions.length)) return saveSession(final); if (mode === "practice" && index + 1 >= questions.length) { setQuestions(fisherYates(Array.from({ length: max }, (_, i) => ({ table, multiplier: i + 1 })))); setIndex(0) } else setIndex(i => i + 1) }
  const answer = value => { if (answerLocked.current || feedback) return; answerLocked.current = true; const q = questions[index], submitted = Number(value), correct = submitted === q.table * q.multiplier, next = [...results, { ...q, correct }]; setResults(next); setFeedback({ correct, answer: q.table * q.multiplier, submitted, results: next }); setInput("") }
  if (!ready) return <Shell><div className="py-20 text-center text-muted-foreground">Loading…</div></Shell>
  if (!session && !childToken) return <AuthScreen invited={!!inviteToken} onAuthenticated={syncAccount} />
  if (loadError || !snapshot) return <Shell><Title subtitle={loadError || "Please load practice to continue."}>Let’s try again</Title><Primary onClick={() => fetchFamily()}>{childToken ? "Retry loading practice" : "Retry loading family"}</Primary>{!childToken && <Button variant="ghost" className="mt-3 w-full" onClick={signOut}>Sign out</Button>}</Shell>
  if (!childToken && inviteToken && !pendingSession) return <InvitationScreen email={session.user.email} cancel={clearInvite} accept={async () => { const epoch = scope.current; const next = await acceptFamilyInvitation(inviteToken); if (epoch !== scope.current) return; request.current++; activateFamily(next); clearInvite() }} />
  if (!childToken && screen === "family") {
    const epoch = scope.current
    return <Shell back={() => { scope.current++; request.current++; setScreen("players") }}><Card className="mb-5"><CardContent className="p-5"><h2 className="text-xl font-black">Parent learning settings</h2><p className="mt-2 text-sm">Choose each player’s assigned range. Larger ranges change the mastery finish line. Learning history and XP are preserved.</p>{data.players.map(p => <Button key={p.id} variant="outline" className="mt-3 min-h-12 h-auto w-full justify-between whitespace-normal text-left" onClick={() => setEditing(p)}><span className="break-words">{p.name} · 1–{p.maxTable} × 1–{p.maxMultiplier}</span><Pencil className="ml-2 shrink-0 size-4" /></Button>)}<Button className="mt-3 w-full" variant="secondary" onClick={() => setEditing({ id: null, name: "", maxTable: 5, maxMultiplier: 5 })}><Plus /> Add a player</Button></CardContent></Card><PlayerSheet stats={data.stats} player={editing} close={() => setEditing(null)} save={savePlayer} /><FamilySettings key={snapshot.family.id} snapshot={snapshot} refresh={() => { if (epoch === scope.current && accountId.current === snapshot.userId && stateRef.current.familyId === snapshot.family.id) return fetchFamily(snapshot.family.id, true) }} switchFamily={familyId => { if (epoch !== scope.current) return; scope.current++; setPlayerId(null); setScreen("players"); fetchFamily(familyId) }} signOut={signOut} /></Shell>
  }
  if (!childToken && screen === "players") return <Shell settings={() => setScreen("family")}><div className="flex items-center justify-between"><div><Title>Who&apos;s playing?</Title></div><Button variant="secondary" size="icon" className="rounded-2xl" onClick={() => setScreen("leaderboard")}><Trophy /><span className="sr-only">Family scores</span></Button></div><div className="mt-7 grid gap-3">{data.players.map((p, i) => <Card key={p.id} className={`overflow-hidden border-0 shadow-md ${["bg-[var(--coral)]", "bg-[var(--sky)]", "bg-[var(--success)]", "bg-[var(--grape)]"][i % 4]}`}><CardContent className="flex items-center gap-3 p-3"><Button variant="ghost" className="min-h-16 h-auto min-w-0 flex-1 justify-start gap-3 rounded-2xl px-2 text-left text-white hover:bg-white/15 hover:text-white" onClick={() => { setPlayerId(p.id); setTable(1); setMax(p.maxMultiplier); setScreen("activity") }}><span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/20 text-xl font-black">{p.name[0]}</span><span className="min-w-0 whitespace-normal"><span className="block break-words text-xl font-black">{p.name}</span><span className="block text-sm font-bold opacity-90">{(data.xp?.[p.id] ?? 0).toLocaleString()} XP</span></span></Button></CardContent></Card>)}</div><FamilyStandings data={data} /></Shell>
  if (screen === "leaderboard") return <Leaderboard data={data} standings={childToken ? snapshot.standings : undefined} activePlayer={playerId} back={() => setScreen(childToken ? "activity" : "players")} />
  if (screen === "activity") return <Shell player={player} xp={data.xp?.[playerId] ?? 0} back={childToken ? undefined : () => setScreen("players")}><Title>Choose an activity</Title><StreakBadge streak={streakProgress(data.streaks?.[playerId])} /><Journey progress={currentProgress} nextStat={nextTargetStat} /><div className="mt-7 grid grid-cols-2 gap-4"><ModeCard emoji="🌱" title="Practice" note="+1 XP per correct answer" color="bg-[var(--coral)]" onClick={() => { setMode("practice"); setScreen("table") }} /><ModeCard emoji="🏆" title="Challenge" note="+1 XP per correct answer" color="bg-[var(--grape)]" onClick={() => { setMode("challenge"); setScreen("table") }} /></div>{childToken && <Button variant="secondary" className="mt-5 min-h-12 w-full rounded-2xl font-bold" onClick={() => setScreen("leaderboard")}><Trophy aria-hidden="true" /> Family leaderboard</Button>}<FamilyStandings data={data} standings={childToken ? snapshot.standings : undefined} activePlayer={playerId} /></Shell>
  if (screen === "table") return <Shell player={player} xp={data.xp?.[playerId] ?? 0} back={() => setScreen("activity")}><Title>Choose a times table</Title><div className="mt-7 grid grid-cols-4 gap-3">{Array.from({ length: player.maxTable }, (_, i) => { const t = i + 1, done = Array.from({ length: player.maxMultiplier }, (_, m) => isMastered(data.stats[statKey(playerId, t, m + 1)])).every(Boolean); return <Button key={t} variant="secondary" className="relative h-16 rounded-2xl text-xl font-black" onClick={() => { setTable(t); setMax(player.maxMultiplier); setScreen("range") }}>{t}{done && <Check className="absolute right-2 top-2 size-4 text-[var(--success)]" />}</Button> })}</div></Shell>
  if (screen === "range") return <Shell player={player} xp={data.xp?.[playerId] ?? 0} back={() => setScreen("table")}><Title>Up to what number?</Title><Card className="mt-8"><CardContent className="p-7 text-center"><p className="font-[family-name:var(--font-display)] text-2xl font-black">{table} × 1 <span className="text-[var(--coral)]">→</span> {table} × {max}</p><p className="my-5 font-[family-name:var(--font-display)] text-6xl font-black text-primary">{max}</p><Slider aria-label="Multiply by numbers up to" min={1} max={player.maxMultiplier} value={[max]} onValueChange={v => setMax(v[0])} /></CardContent></Card><Primary onClick={() => setScreen("answer")}>Next</Primary></Shell>
  if (screen === "answer") return <Shell player={player} xp={data.xp?.[playerId] ?? 0} back={() => setScreen("range")}><Title>How do you want to answer?</Title><OptionGroup value={answerMode} onChange={setAnswerMode} options={[{ value: "choice", icon: "🔘", title: "Pick an answer" }, { value: "type", icon: "⌨️", title: "Type an answer", note: mode === "challenge" ? "+5 XP for finishing with 80%+ correct" : "Same XP for either answer style" }]} />{mode === "practice" ? <Primary onClick={() => setScreen("length")}>Next</Primary> : <Primary onClick={begin}>Start challenge</Primary>}</Shell>
  if (screen === "length") return <Shell player={player} xp={data.xp?.[playerId] ?? 0} back={() => setScreen("answer")}><Title>How long?</Title><OptionGroup value={timed ? "timed" : "keep"} onChange={v => setTimed(v === "timed")} options={[{ value: "keep", icon: "∞", title: "Keep going", note: "Stop when you choose" }, { value: "timed", icon: "⏱", title: "Use a timer" }]} />{timed && <Card className="mt-5"><CardContent className="p-5"><Label className="font-bold">{minutes} minute{minutes > 1 ? "s" : ""}</Label><Slider aria-label="Practice time in minutes" className="mt-5" min={1} max={10} value={[minutes]} onValueChange={v => setMinutes(v[0])} /></CardContent></Card>}<Primary onClick={begin}>Start practice</Primary></Shell>
  if (screen === "play") { const q = questions[index]; return <Shell player={player} xp={data.xp?.[playerId] ?? 0} pendingXp={results.filter(r => r.correct).length} back={() => results.length ? saveSession(results) : setScreen("activity")}><div className="flex justify-between text-sm font-bold text-muted-foreground"><span>{mode === "challenge" ? `${index + 1} of ${questions.length}` : "Practice"}</span>{secondsLeft !== null && <span className="flex items-center gap-1"><Clock3 className="size-4" /> {Math.ceil(secondsLeft / 60)} min</span>}</div><StreakBadge streak={liveStreak} pending={results.length > 0} /><div className="py-7 text-center"><div className="font-[family-name:var(--font-display)] text-7xl font-black tracking-tighter">{q.table} <span className="text-[var(--coral)]">×</span> {q.multiplier}</div>{feedback ? <><p className="mt-2 font-semibold text-muted-foreground">Your answer: {feedback.submitted}</p><p role="status" className={`mt-3 font-[family-name:var(--font-display)] text-3xl font-black ${feedback.correct ? "text-[var(--success)]" : "text-[var(--coral)]"}`}>{feedback.correct ? "✓ Correct! +1 XP pending" : `The answer is ${feedback.answer}`}</p><FeedbackCountdown key={results.length} finish={endPending || (mode === "challenge" && index + 1 >= questions.length)} onAdvance={() => advance(feedback.results)} /></> : null}</div>{answerMode === "choice" ? <div className="grid grid-cols-2 gap-3">{answerChoices.map(v => <Button key={v} variant="secondary" className="h-24 rounded-3xl font-black" style={{ fontSize: "3rem" }} disabled={!!feedback} onClick={() => answer(v)}>{v}</Button>)}</div> : <form onSubmit={e => { e.preventDefault(); if (input) answer(input) }}><Input disabled={!!feedback} aria-label="Your answer" ref={answerInputRef} autoFocus inputMode="numeric" className="h-20 rounded-3xl px-4 py-0 text-center font-black" style={{ fontSize: "2.5rem", lineHeight: 1 }} value={input} onChange={e => setInput(e.target.value.replace(/\D/g, ""))} /><Primary type="submit" disabled={!!feedback}>Check answer</Primary></form>}{mode === "practice" && <Button variant="outline" className="h-12 w-full rounded-2xl border-2 border-[var(--coral)] bg-transparent font-black text-[var(--coral)] hover:bg-[var(--coral)]/10 hover:text-[var(--coral)]" style={{ marginTop: "2.5rem" }} onClick={() => results.length ? saveSession(results) : setScreen("activity")}>End practice</Button>}</Shell> }
  return <Results streak={pendingSession ? liveStreak : streakProgress(data.streaks?.[playerId])} xp={data.xp?.[playerId] ?? 0} reward={reward} progress={playerProgress(data.stats, playerId, player, data.xp?.[playerId] ?? 0)} player={player} results={results} mode={mode} answerMode={answerMode} max={max} pending={pendingSession} saving={saving} error={saveError} discard={childToken && saveErrorCode === "22023" ? discardInvalidRound : undefined} retry={() => persistSession(pendingSession)} again={() => setScreen("table")} home={() => setScreen("activity")} />
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
function ModeCard({ emoji, title, note, color, onClick }) { return <Button onClick={onClick} className={`h-44 flex-col rounded-3xl ${color} text-white shadow-lg hover:opacity-90`}><span className="text-4xl">{emoji}</span><b className="mt-2 text-xl">{title}</b><small className="text-center font-semibold">{note}</small></Button> }
function OptionGroup({ value, onChange, options }) { return <RadioGroup className="mt-7 grid gap-3" value={value} onValueChange={onChange}>{options.map(o => <Label key={o.value} className={`flex cursor-pointer items-center gap-4 rounded-2xl border-2 p-4 ${value === o.value ? "border-primary bg-primary/5" : "bg-card"}`}><RadioGroupItem value={o.value} /><span className="text-2xl">{o.icon}</span><span><b className="block text-lg">{o.title}</b>{o.note && <small className="font-semibold text-muted-foreground">{o.note}</small>}</span></Label>)}</RadioGroup> }
function PlayerSheet({ player, stats, close, save }) {
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

  const assignedFacts = player?.id ? Array.from({ length: player.maxTable * player.maxMultiplier }, (_, i) => ({ table: Math.floor(i / player.maxMultiplier) + 1, multiplier: i % player.maxMultiplier + 1 })).map(fact => ({ ...fact, stat: stats?.[statKey(player.id, fact.table, fact.multiplier)] })) : []
  const reviewFacts = assignedFacts.filter(fact => fact.stat?.recent?.length >= 5 && !isMastered(fact.stat))
  return <Sheet open={!!player} onOpenChange={open => !open && !busy && close()}>
    <SheetContent side="center" className={`${playerModalStyles.content} rounded-3xl`}>
      <SheetHeader className={playerModalStyles.header}>
        <SheetTitle className="font-[family-name:var(--font-display)] text-2xl font-black">
          {player?.id ? "Parent: edit assigned range" : "Parent: add player"}
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
        <p className="text-sm text-muted-foreground">Tables 1–{maxTable}, multiplied by 1–{maxMultiplier}.</p>{player?.id && <p className="rounded-xl bg-muted p-3 text-sm">Mastery: {Math.round(playerProgress(stats, player.id, player, 0).masteryPercent)}% → {Math.round(playerProgress(stats, player.id, { ...player, maxTable, maxMultiplier }, 0).masteryPercent)}%. Your new finish line is {maxTable * maxMultiplier} facts. XP and learning history stay saved.</p>}
        {player?.id && <details className="text-sm"><summary className="min-h-8 cursor-pointer font-semibold">Placement and review evidence</summary><p className="mt-2">{assignedFacts.filter(fact => fact.stat?.recent?.length >= 5).length}/{assignedFacts.length} facts have at least five recorded responses.</p><p className="mt-2">{reviewFacts.length ? `Needs review: ${reviewFacts.slice(0, 6).map(fact => `${fact.table} × ${fact.multiplier}`).join(" · ")}` : "No review facts identified from recorded evidence yet."}</p>{playerProgress(stats, player.id, player, 0).masteryPercent === 100 && <p className="mt-2 font-semibold">This range is mastered. Consider reviewing prior knowledge and advancing the assigned range.</p>}</details>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button disabled={busy} type="submit" className={`${playerModalStyles.saveButton} h-12 w-full rounded-2xl text-lg font-black`}>{busy ? "Saving…" : "Save player"}</Button>
      </form>
    </SheetContent>
  </Sheet>
}
function Results({ streak, xp, reward, progress, player, results, mode, again, home, pending, saving, error, retry, discard }) {
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const correct = results.filter(r => r.correct).length
  const weak = results.filter(r => !r.correct).filter((r, i, all) => all.findIndex(x => x.table === r.table && x.multiplier === r.multiplier) === i).slice(0, 3)
  return <Shell player={player} xp={xp} pendingXp={pending ? correct : 0}><div className="pt-2 text-center"><Title>{mode === "challenge" ? "Challenge complete!" : "Nice work!"}</Title><StreakBadge streak={streak} pending={!!pending} />{!pending && reward && <MasteryCelebration reward={reward} />}{pending && <div className="mt-5 rounded-2xl border p-5" role="status"><p className="text-3xl font-black">{correct} answer XP pending</p><p className="mt-2">{saving ? "Saving your round and checking first mastery rewards…" : error || "Your round is waiting to save."}</p><p className="mt-2 text-sm">Your saved XP total updates after confirmation.</p>{!saving && <Button className="mt-3 min-h-11" onClick={retry}>Retry saving results</Button>}{!saving && discard && <div className="mt-3">{confirmDiscard ? <><p className="text-sm">Discard this unsaved round? It will not earn XP.</p><Button variant="outline" className="mt-2 min-h-11" onClick={discard}>Discard and reload tables</Button><Button variant="ghost" className="mt-2 min-h-11" onClick={() => setConfirmDiscard(false)}>Keep round</Button></> : <Button variant="outline" className="min-h-11" onClick={() => setConfirmDiscard(true)}>Use updated tables</Button>}</div>}</div>}<p className="mt-4 font-semibold">{correct} of {results.length} correct</p>{weak.length > 0 && <Card className="mt-5 text-left"><CardContent className="p-4"><h2 className="font-black">Try these again next round</h2><p className="mt-2">{weak.map(x => `${x.table} × ${x.multiplier} = ${x.table * x.multiplier}`).join(" · ")}</p></CardContent></Card>}<Journey progress={progress} /><Primary disabled={!!pending} onClick={again}>Practice another table</Primary><Button disabled={!!pending} variant="ghost" className="mt-3 min-h-11" onClick={home}>Activities</Button></div></Shell>
}
function Leaderboard({ data, standings, activePlayer, back }) { return <Shell back={back}><Title>Family leaderboard</Title><FamilyStandings data={data} standings={standings} activePlayer={activePlayer} /><details className="mt-5 rounded-xl bg-muted p-4 text-sm"><summary className="min-h-8 cursor-pointer font-bold">How XP and levels work</summary><p className="mt-2">Total XP decides who is in the lead. Every correct answer earns 1 XP, and mastering a fact for the first time earns a bonus of 25 XP. Equal XP shares a rank. Keep practicing to take the lead!</p><p className="mt-2">Levels follow mastery of your own assigned tables: Starter at 0%, Explorer at 10%, Builder at 25%, Expert at 50%, and Math Genius at 100%. Your level reflects current mastery, so it can change when facts need review or your assigned range changes. Earned XP stays saved.</p><p className="mt-2">A fact needs at least five responses and 80% correct in the latest responses, up to ten.</p></details></Shell> }

function InvitationScreen({ email, accept, cancel }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("")
  return <Shell><Title>You’re invited</Title><Card className="mt-7"><CardContent className="grid gap-4 p-5"><p>Signed in as <strong className="break-all">{email}</strong>.</p><p className="text-sm text-muted-foreground">Accept with the verified email this invitation was sent to. You’ll have access to all the kids in this family. Your existing family and its history will stay separate.</p>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await accept() } catch (failure) { setError(failure.message === "Invitation unavailable or expired" ? "This invitation is unavailable or expired. Ask the family owner for a new link." : failure.message || "Couldn’t accept this invitation. Try again.") } finally { setBusy(false) } }}>{busy ? "Joining…" : "Accept invitation"}</Button><Button disabled={busy} variant="outline" onClick={cancel}>Cancel</Button></CardContent></Card></Shell>
}
