"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowRight, Check, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import styles from "./landing.module.css"

const questions = [
  { table: 3, multiplier: 4, choices: [7, 12, 16, 24] },
  { table: 6, multiplier: 3, choices: [12, 15, 18, 21] },
  { table: 4, multiplier: 5, choices: [9, 16, 20, 25] },
  { table: 7, multiplier: 2, choices: [9, 14, 16, 21] },
]

export function InteractiveDemo() {
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [xp, setXp] = useState(120)
  const locked = useRef(false)
  const firstAnswer = useRef<HTMLButtonElement>(null)
  const nextQuestion = useRef<HTMLButtonElement>(null)
  const restoreAnswerFocus = useRef(false)
  const question = questions[index % questions.length]
  const correctAnswer = question.table * question.multiplier
  const correct = selected === correctAnswer
  const advance = (restoreFocus = false) => {
    restoreAnswerFocus.current = restoreFocus
    locked.current = false
    setSelected(null)
    setIndex(value => value + 1)
  }
  useEffect(() => {
    if (restoreAnswerFocus.current) {
      restoreAnswerFocus.current = false
      firstAnswer.current?.focus()
    }
  }, [index])
  useEffect(() => {
    if (selected === null || selected !== question.table * question.multiplier) return
    const timer = setTimeout(() => {
      // Stable answer nodes keep their focus. Restore only the disappearing
      // Next control, never a visitor who has moved elsewhere on the page.
      advance(document.activeElement === nextQuestion.current)
    }, 2400)
    return () => clearTimeout(timer)
  }, [selected, question])
  const answer = (value: number) => {
    if (locked.current) return
    locked.current = true
    setSelected(value)
    if (value === correctAnswer) setXp(total => total + 1)
  }
  return <div className={styles.demo} aria-label="Try a sample Multiply practice game">
    <div className={styles.demoTop}><span className={styles.demoPill}><Sparkles size={15} /> Try it out</span><span className={styles.demoXp} aria-label={`Sample XP: ${xp}`}>{xp} <small>XP</small></span></div>
    <div className={styles.demoPlayer}><span className={styles.avatar}>M</span><div><b>Maya</b><small>Level 3 · Builder</small></div><span>Sample player</span></div>
    <div className={styles.demoMode}><b>Practice</b><span>+1 XP per correct answer</span></div>
    <p className={styles.equation} aria-live="polite" aria-atomic="true">{question.table} <span>×</span> {question.multiplier} <small>= ?</small></p>
    <div className={styles.answers}>{question.choices.map((value, position) => <button type="button" key={position} ref={position === 0 ? firstAnswer : undefined} aria-disabled={selected !== null} tabIndex={selected === null ? 0 : -1} onClick={() => answer(value)} className={selected !== null && value === correctAnswer ? styles.correct : selected === value ? styles.incorrect : ""} aria-label={`Answer ${value}${selected !== null && value === correctAnswer ? ", correct answer" : selected === value ? ", incorrect answer" : ""}`}>{value}{selected !== null && value === correctAnswer ? <Check aria-hidden="true" size={20} /> : selected === value ? <X aria-hidden="true" size={20} /> : null}</button>)}</div>
    <div className={styles.demoFeedback} role="status" aria-live="polite">{selected === null ? <span>Go on. Give it a try!</span> : <><b className={correct ? styles.feedbackCorrect : ""}>{correct ? <><Check size={18} /> Correct! <span className={styles.xpPop}>+1 XP</span></> : <>Good try! {question.table} × {question.multiplier} = {correctAnswer}</>}</b><Button ref={nextQuestion} variant="ghost" size="sm" onClick={event => advance(event.detail === 0)}>Next question <ArrowRight size={14} /></Button></>}</div>
    <div className={styles.demoProgress}><span>25 / 100 facts mastered</span><Progress value={25} aria-label="Sample player: 25 of 100 facts mastered" /><small>Mastery grows with accurate practice over multiple answers.</small></div>
    <p className={styles.sampleNote}>A little preview. Your real progress starts in the game.</p>
  </div>
}
