"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowRight, Check, ChevronLeft, Clock3, Pencil, Plus, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import playerModalStyles from "@/components/player-modal.module.css"
import { loadRemoteData, nhost, saveRemoteData } from "@/lib/nhost"

const KEY = "multiply:v1"
const defaults = { players: [{ id: "ethan", name: "Ethan", maxTable: 15, maxMultiplier: 15 }, { id: "josiah", name: "Josiah", maxTable: 10, maxMultiplier: 10 }, { id: "joseph", name: "Joseph", maxTable: 5, maxMultiplier: 5 }], stats: {}, sessions: [] }
const id = () => Math.random().toString(36).slice(2, 9)
const fisherYates = items => { const copy = [...items]; for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]] } return copy }
const pct = (right, total) => total ? Math.round(right / total * 100) : 0
const statKey = (player, table, multiplier) => `${player}:${table}x${multiplier}`
const recentAccuracy = stat => stat?.recent?.length ? pct(stat.recent.filter(Boolean).length, stat.recent.length) : 0
const isMastered = stat => stat?.recent?.length >= 5 && recentAccuracy(stat) >= 80

function loadData() { try { const saved = JSON.parse(window.localStorage.getItem(KEY) || "null"); return saved?.players && Array.isArray(saved.players) ? { ...defaults, ...saved, stats: saved.stats || {}, sessions: saved.sessions || [] } : defaults } catch { return defaults } }
function Shell({ player, back, children }) { return <main className="mx-auto min-h-dvh max-w-xl bg-background px-4 pb-9 sm:shadow-2xl"><header className="flex h-20 items-center justify-between">{back ? <Button variant="ghost" size="icon" className="size-11 rounded-2xl" onClick={back}><ChevronLeft /></Button> : <div className="size-11" aria-hidden="true" />}<div className="text-3xl font-black tracking-tight text-foreground">multiply<span className="text-[var(--coral)]">!</span></div>{player ? <div className="grid size-10 place-items-center rounded-2xl bg-[var(--coral)] font-black text-white">{player.name[0]}</div> : <div className="size-11" />}</header><section>{children}</section></main> }
function Title({ children, subtitle }) { return <><h1 className="font-[family-name:var(--font-display)] text-4xl font-black tracking-tight text-foreground">{children}</h1>{subtitle && <p className="mt-1 text-base font-semibold text-muted-foreground">{subtitle}</p>}</> }

export function MultiplyApp() {
  const [data, setData] = useState(defaults), [ready, setReady] = useState(false), [session, setSession] = useState(null), [screen, setScreen] = useState("players"), [playerId, setPlayerId] = useState(null)
  const [mode, setMode] = useState("practice"), [table, setTable] = useState(1), [max, setMax] = useState(1), [answerMode, setAnswerMode] = useState("choice"), [timed, setTimed] = useState(false), [minutes, setMinutes] = useState(5)
  const [questions, setQuestions] = useState([]), [index, setIndex] = useState(0), [results, setResults] = useState([]), [feedback, setFeedback] = useState(null), [answerProgress, setAnswerProgress] = useState(0), [input, setInput] = useState(""), [endPending, setEndPending] = useState(false), [secondsLeft, setSecondsLeft] = useState(null), [editing, setEditing] = useState(null)
  const progressionTimers = useRef({ interval: null, timeout: null })
  const player = data.players.find(p => p.id === playerId)
  useEffect(() => {
    let active = true
    const current = nhost.getUserSession()
    if (!current) {
      setReady(true)
      return () => { active = false }
    }
    setSession(current)
    loadRemoteData().then(remote => {
      if (!active) return
      setData(remote?.players && Array.isArray(remote.players) ? { ...defaults, ...remote, stats: remote.stats || {}, sessions: remote.sessions || [] } : loadData())
      setReady(true)
    }).catch(() => {
      if (!active) return
      setData(loadData())
      setReady(true)
    })
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (!ready) return
    window.localStorage.setItem(KEY, JSON.stringify(data))
    if (session) saveRemoteData(data).catch(() => {})
  }, [data, ready, session])
  useEffect(() => { if (screen !== "play" || mode !== "practice" || !timed || secondsLeft === null) return; if (secondsLeft <= 0) { setEndPending(true); return } const timer = setTimeout(() => setSecondsLeft(s => s - 1), 1000); return () => clearTimeout(timer) }, [screen, mode, timed, secondsLeft])
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
  const begin = () => { clearAnswerProgress(); setQuestions(fisherYates(Array.from({ length: max }, (_, i) => ({ table, multiplier: i + 1 })))); setIndex(0); setResults([]); setFeedback(null); setAnswerProgress(0); setInput(""); setEndPending(false); setSecondsLeft(mode === "practice" && timed ? minutes * 60 : null); setScreen("play") }
  const saveSession = final => { clearAnswerProgress(); const correct = final.filter(r => r.correct).length, attempts = final.length, score = mode === "challenge" ? Math.round(correct / max * (answerMode === "type" ? 125 : 100)) : null; setData(current => { const stats = { ...current.stats }; final.forEach(r => { const key = statKey(playerId, r.table, r.multiplier), old = stats[key] || { attempts: 0, correct: 0, recent: [] }; stats[key] = { attempts: old.attempts + 1, correct: old.correct + Number(r.correct), recent: [...old.recent, r.correct].slice(-10) } }); return { ...current, stats, sessions: [...current.sessions, { id: id(), playerId, mode, answerMode, table, maxMultiplier: max, correct, attempts, percentage: pct(correct, attempts), score, date: Date.now(), results: final }].slice(-200) } }); setScreen("results") }
  const advance = final => { clearAnswerProgress(); setFeedback(null); setAnswerProgress(0); setInput(""); if (endPending || (mode === "challenge" && index + 1 >= questions.length)) return saveSession(final); if (mode === "practice" && index + 1 >= questions.length) { setQuestions(fisherYates(Array.from({ length: max }, (_, i) => ({ table, multiplier: i + 1 })))); setIndex(0) } else setIndex(i => i + 1) }
  const scheduleAdvance = final => { clearAnswerProgress(); const started = Date.now(); progressionTimers.current.interval = setInterval(() => setAnswerProgress(Math.min(100, (Date.now() - started) / 70)), 100); progressionTimers.current.timeout = setTimeout(() => advance(final), 7000) }
  const answer = value => { if (feedback) return; const q = questions[index], submitted = Number(value), correct = submitted === q.table * q.multiplier, next = [...results, { ...q, correct }]; setResults(next); setFeedback({ correct, answer: q.table * q.multiplier, submitted, results: next }); setAnswerProgress(0); setInput(""); scheduleAdvance(next) }
  if (!ready) return <Shell><div className="py-20 text-center text-muted-foreground">Getting your game ready…</div></Shell>
  if (!session) return <AuthScreen onAuthenticated={async current => {
    try {
      const remote = await loadRemoteData()
      if (remote?.players && Array.isArray(remote.players)) setData({ ...defaults, ...remote, stats: remote.stats || {}, sessions: remote.sessions || [] })
    } catch {}
    setSession(current)
  }} />
  if (screen === "players") return <Shell><div className="flex items-center justify-between"><div><Title subtitle="Pick your name to get started.">Who&apos;s playing?</Title></div><Button variant="secondary" size="icon" className="rounded-2xl" onClick={() => setScreen("leaderboard")}><Trophy /></Button></div><div className="mt-7 grid gap-3">{data.players.map((p, i) => <Card key={p.id} className={`overflow-hidden border-0 shadow-md ${["bg-[var(--coral)]", "bg-[var(--sky)]", "bg-[var(--success)]", "bg-[var(--grape)]"][i % 4]}`}><CardContent className="flex items-center gap-3 p-3"><Button variant="ghost" className="h-16 flex-1 justify-start gap-3 rounded-2xl px-2 text-left text-white hover:bg-white/15 hover:text-white" onClick={() => { setPlayerId(p.id); setTable(1); setMax(p.maxMultiplier); setScreen("activity") }}><span className="grid size-11 place-items-center rounded-full bg-white/20 text-xl font-black">{p.name[0]}</span><span><span className="block text-xl font-black">{p.name}</span><span className="block text-sm font-bold opacity-90">Up to {p.maxTable} × {p.maxMultiplier}</span></span></Button><Button variant="ghost" size="icon" className="rounded-xl text-white hover:bg-white/15 hover:text-white" onClick={() => setEditing(p)}><Pencil /></Button></CardContent></Card>)}</div><Button className="mt-5 h-12 w-full rounded-2xl" variant="secondary" onClick={() => setEditing({ id: null, name: "", maxTable: 5, maxMultiplier: 5 })}><Plus /> Add a player</Button><PlayerSheet player={editing} close={() => setEditing(null)} save={p => setData(d => ({ ...d, players: p.id ? d.players.map(x => x.id === p.id ? p : x) : [...d.players, { ...p, id: id() }] }))} /></Shell>
  if (screen === "leaderboard") return <Leaderboard data={data} back={() => setScreen("players")} />
  if (screen === "activity") return <Shell player={player} back={() => setScreen("players")}><Title>What do you want to do?</Title><div className="mt-7 grid grid-cols-2 gap-4"><ModeCard emoji="🌱" title="Practice" note="Learn without score" color="bg-[var(--coral)]" onClick={() => { setMode("practice"); setScreen("table") }} /><ModeCard emoji="🏆" title="Challenge" note="Try for your best" color="bg-[var(--grape)]" onClick={() => { setMode("challenge"); setScreen("table") }} /></div><Card className="mt-7"><CardContent className="p-5"><h2 className="font-[family-name:var(--font-display)] text-xl font-black">Your progress</h2><Progress className="mt-4 h-3" value={pct(facts.filter(isMastered).length, facts.length)} /><div className="mt-4 grid grid-cols-3 gap-2 text-center"><Metric value={`${pct(facts.filter(Boolean).reduce((n, s) => n + s.correct, 0), facts.filter(Boolean).reduce((n, s) => n + s.attempts, 0))}%`} label="accuracy" /><Metric value={`${facts.filter(isMastered).length}/${facts.length}`} label="mastered" /><Metric value={facts.length - facts.filter(isMastered).length} label="needs work" /></div></CardContent></Card></Shell>
  if (screen === "table") return <Shell player={player} back={() => setScreen("activity")}><Title subtitle="Pick the base number you want to practice.">Choose a multiplication table</Title><div className="mt-7 grid grid-cols-4 gap-3">{Array.from({ length: player.maxTable }, (_, i) => { const t = i + 1, done = Array.from({ length: player.maxMultiplier }, (_, m) => isMastered(data.stats[statKey(playerId, t, m + 1)])).every(Boolean); return <Button key={t} variant="secondary" className="relative h-16 rounded-2xl text-xl font-black" onClick={() => { setTable(t); setMax(player.maxMultiplier); setScreen("range") }}>{t}{done && <Check className="absolute right-2 top-2 size-4 text-[var(--success)]" />}</Button> })}</div></Shell>
  if (screen === "range") return <Shell player={player} back={() => setScreen("table")}><Title>Up to what number?</Title><Card className="mt-8"><CardContent className="p-7 text-center"><p className="font-[family-name:var(--font-display)] text-2xl font-black">{table} × 1 <span className="text-[var(--coral)]">→</span> {table} × {max}</p><p className="my-5 font-[family-name:var(--font-display)] text-6xl font-black text-primary">{max}</p><Slider min={1} max={player.maxMultiplier} value={[max]} onValueChange={v => setMax(v[0])} /></CardContent></Card><Primary onClick={() => setScreen("answer")}>Next</Primary></Shell>
  if (screen === "answer") return <Shell player={player} back={() => setScreen("range")}><Title>How do you want to answer?</Title><OptionGroup value={answerMode} onChange={setAnswerMode} options={[{ value: "choice", icon: "🔘", title: "Pick an answer", note: "See four choices" }, { value: "type", icon: "⌨️", title: "Type the answer", note: mode === "challenge" ? "Worth 25% more points" : "Answer it yourself" }]} />{mode === "practice" ? <Primary onClick={() => setScreen("length")}>Next</Primary> : <Primary onClick={begin}>Start challenge</Primary>}</Shell>
  if (screen === "length") return <Shell player={player} back={() => setScreen("answer")}><Title>How long?</Title><OptionGroup value={timed ? "timed" : "keep"} onChange={v => setTimed(v === "timed")} options={[{ value: "keep", icon: "∞", title: "Keep going", note: "Practice until you end it" }, { value: "timed", icon: "⏱", title: "Timed practice", note: "Set a gentle timer" }]} />{timed && <Card className="mt-5"><CardContent className="p-5"><Label className="font-bold">{minutes} minute{minutes > 1 ? "s" : ""}</Label><Slider className="mt-5" min={1} max={10} value={[minutes]} onValueChange={v => setMinutes(v[0])} /></CardContent></Card>}<Primary onClick={begin}>Start practice</Primary></Shell>
  if (screen === "play") { const q = questions[index]; return <Shell player={player} back={() => results.length ? saveSession(results) : setScreen("activity")}><div className="flex justify-between text-sm font-bold text-muted-foreground"><span>{mode === "challenge" ? `${index + 1} of ${questions.length}` : "Practice time"}</span>{secondsLeft !== null && <span className="flex items-center gap-1"><Clock3 className="size-4" /> {Math.ceil(secondsLeft / 60)} min</span>}</div><div className="py-12 text-center"><div className="font-[family-name:var(--font-display)] text-7xl font-black tracking-tighter">{q.table} <span className="text-[var(--coral)]">×</span> {q.multiplier}</div>{feedback ? <><p className="mt-2 font-semibold text-muted-foreground">Your answer: {feedback.submitted}</p><p className={`mt-3 font-[family-name:var(--font-display)] text-3xl font-black ${feedback.correct ? "text-[var(--success)]" : "text-[var(--coral)]"}`}>{feedback.correct ? "✓ Correct!" : `Not quite — the answer is ${feedback.answer}`}</p><Progress className="mt-5 h-3" value={answerProgress} /><p className="mt-2 text-sm font-semibold text-muted-foreground">Next question in {Math.max(0, Math.ceil((100 - answerProgress) * .07))} seconds</p><Button className="mt-5 h-12 w-full rounded-2xl text-lg font-black" onClick={() => advance(feedback.results)}>Next question <ArrowRight /></Button></> : <p className="mt-2 font-semibold text-muted-foreground">What is the answer?</p>}</div>{answerMode === "choice" ? <div className="grid grid-cols-2 gap-3">{answerChoices.map(v => <Button key={v} variant="secondary" className="h-24 rounded-3xl font-black" style={{ fontSize: "3rem" }} onClick={() => answer(v)}>{v}</Button>)}</div> : <form onSubmit={e => { e.preventDefault(); if (input) answer(input) }}><Input autoFocus inputMode="numeric" className="h-20 rounded-3xl px-4 py-0 text-center font-black" style={{ fontSize: "2.5rem", lineHeight: 1 }} value={input} onChange={e => setInput(e.target.value.replace(/\D/g, ""))} /><Primary type="submit">Check answer</Primary></form>}{mode === "practice" && <Button variant="outline" className="h-12 w-full rounded-2xl border-2 border-[var(--coral)] bg-transparent font-black text-[var(--coral)] hover:bg-[var(--coral)]/10 hover:text-[var(--coral)]" style={{ marginTop: "2.5rem" }} onClick={() => results.length ? saveSession(results) : setScreen("activity")}>End practice</Button>}</Shell> }
  return <Results player={player} results={results} mode={mode} answerMode={answerMode} max={max} again={() => setScreen("table")} home={() => setScreen("activity")} />
}

function AuthScreen({ onAuthenticated }) {
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
      if (response.body.error) throw new Error(response.body.error.message || "Authentication failed")
      const current = nhost.getUserSession()
      if (!current) {
        setError(mode === "signup" ? "Check your email to verify your account, then sign in." : "No active session was returned.")
      } else {
        onAuthenticated(current)
      }
    } catch (authError) {
      setError(authError.message || "Authentication failed")
    } finally {
      setBusy(false)
    }
  }
  return <Shell><div className="mx-auto max-w-md py-12"><Title subtitle="Your practice history follows you across devices.">{mode === "signin" ? "Welcome back" : "Create your account"}</Title><form className="mt-8 grid gap-4" onSubmit={submit}><div className="grid gap-2"><Label htmlFor="auth-email" className="font-bold">Email</Label><Input id="auth-email" type="email" required autoComplete="email" className="h-12 rounded-xl px-4" value={email} onChange={event => setEmail(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="auth-password" className="font-bold">Password</Label><Input id="auth-password" type="password" required minLength={9} autoComplete={mode === "signin" ? "current-password" : "new-password"} className="h-12 rounded-xl px-4" value={password} onChange={event => setPassword(event.target.value)} /></div>{error && <p role="alert" className="rounded-xl bg-[var(--coral)]/10 p-3 text-sm font-semibold text-[var(--coral)]">{error}</p>}<Primary type="submit" disabled={busy}>{busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}</Primary></form><Button variant="ghost" className="mt-4 w-full" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError("") }}>{mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}</Button></div></Shell>
}

function Primary(props) { return <Button {...props} className={`mt-7 h-14 w-full rounded-2xl text-lg font-black shadow-lg shadow-primary/20 ${props.className || ""}`} /> }
function Metric({ value, label }) { return <div><b className="block font-[family-name:var(--font-display)] text-xl">{value}</b><span className="text-xs font-bold text-muted-foreground">{label}</span></div> }
function ModeCard({ emoji, title, note, color, onClick }) { return <Button onClick={onClick} className={`h-44 flex-col rounded-3xl ${color} text-white shadow-lg hover:opacity-90`}><span className="text-4xl">{emoji}</span><b className="mt-2 text-xl">{title}</b><small className="font-semibold opacity-90">{note}</small></Button> }
function OptionGroup({ value, onChange, options }) { return <RadioGroup className="mt-7 grid gap-3" value={value} onValueChange={onChange}>{options.map(o => <Label key={o.value} className={`flex cursor-pointer items-center gap-4 rounded-2xl border-2 p-4 ${value === o.value ? "border-primary bg-primary/5" : "bg-card"}`}><RadioGroupItem value={o.value} /><span className="text-2xl">{o.icon}</span><span><b className="block text-lg">{o.title}</b><small className="font-semibold text-muted-foreground">{o.note}</small></span></Label>)}</RadioGroup> }
function PlayerSheet({ player, close, save }) {
  const [name, setName] = useState("")
  const [maxTable, setTable] = useState(5)
  const [maxMultiplier, setMultiplier] = useState(5)

  useEffect(() => {
    setName(player?.name || "")
    setTable(player?.maxTable || 5)
    setMultiplier(player?.maxMultiplier || 5)
  }, [player])

  return <Sheet open={!!player} onOpenChange={open => !open && close()}>
    <SheetContent side="center" className={`${playerModalStyles.content} rounded-3xl`}>
      <SheetHeader className={playerModalStyles.header}>
        <SheetTitle className="font-[family-name:var(--font-display)] text-2xl font-black">
          {player?.id ? "Edit player" : "Add player"}
        </SheetTitle>
      </SheetHeader>
      <form className={playerModalStyles.form} onSubmit={e => {
        e.preventDefault()
        if (name.trim()) {
          save({ ...player, name: name.trim(), maxTable, maxMultiplier })
          close()
        }
      }}>
        <div className={playerModalStyles.field}>
          <Label htmlFor="player-name" className="font-bold">Name</Label>
          <Input id="player-name" className="h-12 rounded-xl px-4" value={name} onChange={e => setName(e.target.value)} autoFocus />
        </div>
        <div className={playerModalStyles.sliderField}>
          <Label className="flex items-center justify-between font-bold">Max table <b className="text-primary">{maxTable}</b></Label>
          <Slider aria-label="Max table" min={1} max={15} value={[maxTable]} onValueChange={v => setTable(v[0])} />
        </div>
        <div className={playerModalStyles.sliderField}>
          <Label className="flex items-center justify-between font-bold">Max multiplier <b className="text-primary">{maxMultiplier}</b></Label>
          <Slider aria-label="Max multiplier" min={1} max={15} value={[maxMultiplier]} onValueChange={v => setMultiplier(v[0])} />
        </div>
        <Button type="submit" className={`${playerModalStyles.saveButton} h-12 w-full rounded-2xl text-lg font-black`}>Save player</Button>
      </form>
    </SheetContent>
  </Sheet>
}
function Results({ player, results, mode, answerMode, max, again, home }) { const correct = results.filter(r => r.correct).length, grouped = Object.values(results.reduce((all, r) => { const key = `${r.table}x${r.multiplier}`; (all[key] ||= []).push(r); return all }, {})).map(list => ({ ...list[0], accuracy: pct(list.filter(x => x.correct).length, list.length) })).sort((a, b) => a.accuracy - b.accuracy), weak = grouped.filter(x => x.accuracy < 80).slice(0, 3), score = mode === "challenge" ? Math.round(correct / max * (answerMode === "type" ? 125 : 100)) : null; return <Shell player={player}><div className="pt-4 text-center"><div className="text-5xl">{correct / results.length >= .8 ? "🌟" : "💪"}</div><Title>{mode === "challenge" ? "Challenge complete!" : "Nice work!"}</Title>{score !== null && <p className="mt-3 font-[family-name:var(--font-display)] text-6xl font-black text-[var(--coral)]">{score}<small className="block text-sm text-muted-foreground">points</small></p>}<b className="mt-4 block text-xl">{pct(correct, results.length)}% correct</b><p className="font-semibold text-muted-foreground">{correct} correct / {results.length} answered</p>{weak.length > 0 && <Card className="mt-7 text-left"><CardContent className="p-5"><h2 className="font-[family-name:var(--font-display)] text-xl font-black">Needs more practice</h2>{weak.map(x => <div key={`${x.table}x${x.multiplier}`} className="flex justify-between py-3 font-bold"><span>{x.table} × {x.multiplier}</span><span className="text-[var(--coral)]">{x.accuracy}%</span></div>)}</CardContent></Card>}<Primary onClick={again}>Try another table</Primary><Button variant="ghost" className="mt-3" onClick={home}>Back to {player.name}</Button></div></Shell> }
function Leaderboard({ data, back }) { const rows = data.players.map(player => { const sessions = data.sessions.filter(s => s.playerId === player.id), challenges = sessions.filter(s => s.mode === "challenge" && typeof s.score === "number"), avg = group => group.length ? Math.round(group.reduce((n, s) => n + s.percentage, 0) / group.length) : null; return { player, best: challenges.length ? Math.max(...challenges.map(s => s.score)) : null, improvement: avg(sessions.slice(-5)) !== null && avg(sessions.slice(-10, -5)) !== null ? avg(sessions.slice(-5)) - avg(sessions.slice(-10, -5)) : null } }).sort((a, b) => (b.best ?? -1) - (a.best ?? -1)); return <Shell back={back}><Title subtitle="Everyone can be a champion.">Family high scores</Title><LeaderboardCard title="🏆 Personal best" rows={rows} value={r => r.best ?? "—"} /><LeaderboardCard title="🌱 Improvement" rows={rows} value={r => r.improvement === null ? "Keep playing!" : `${r.improvement >= 0 ? "↑ +" : "↓ "}${r.improvement}%`} /></Shell> }
function LeaderboardCard({ title, rows, value }) { return <Card className="mt-6"><CardContent className="p-5"><h2 className="font-[family-name:var(--font-display)] text-xl font-black">{title}</h2>{rows.map((r, i) => <div key={r.player.id}><div className="flex items-center gap-3 py-3"><Badge variant="secondary" className="size-7 justify-center rounded-full">{i + 1}</Badge><b className="flex-1">{r.player.name}</b><span className="font-black text-primary">{value(r)}</span></div>{i < rows.length - 1 && <Separator />}</div>)}</CardContent></Card> }
