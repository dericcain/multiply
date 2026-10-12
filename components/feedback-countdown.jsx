"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import styles from "./feedback-countdown.module.css"

export const ANSWER_REVIEW_SECONDS = 5

export function FeedbackCountdown({ onAdvance, finish = false }) {
  const [remaining, setRemaining] = useState(ANSWER_REVIEW_SECONDS)
  const [paused, setPaused] = useState(false)
  const [visible, setVisible] = useState(true)
  const advanced = useRef(false), callback = useRef(onAdvance), button = useRef(null)
  callback.current = onAdvance
  const advance = () => {
    if (advanced.current) return
    advanced.current = true
    callback.current()
  }
  useEffect(() => {
    button.current?.focus({ preventScroll: true })
    const changed = () => setVisible(document.visibilityState === "visible")
    changed()
    document.addEventListener("visibilitychange", changed)
    return () => document.removeEventListener("visibilitychange", changed)
  }, [])
  useEffect(() => {
    if (paused || !visible) return
    if (remaining === 0) { advance(); return }
    const timer = setTimeout(() => setRemaining(value => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [remaining, paused, visible])
  return <div className="mt-5">
    <p role="timer" aria-live="off" className="text-sm font-semibold text-muted-foreground">
      {paused ? "Countdown paused" : `${finish ? "Results" : "Next question"} in ${remaining}s`}
    </p>
    <Button ref={button} className="relative isolate mt-2 h-12 w-full overflow-hidden rounded-2xl text-lg font-black" onClick={advance}>
      <span aria-hidden="true" className={styles.fill} style={{ animationPlayState: paused || !visible ? "paused" : "running" }} />
      <span className="relative flex items-center gap-2">{finish ? "See results now" : "Next question"} <ArrowRight aria-hidden="true" /></span>
    </Button>
    <Button variant="ghost" className="mt-1 min-h-11" aria-pressed={paused} onClick={() => setPaused(value => !value)}>
      {paused ? "Resume countdown" : "Pause countdown"}
    </Button>
  </div>
}
