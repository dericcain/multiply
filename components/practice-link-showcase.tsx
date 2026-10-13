"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowRight, Check, Home, Link2, RotateCcw, Settings2, ShieldCheck, Sparkles } from "lucide-react"
import styles from "./practice-link-showcase.module.css"

export function PracticeLinkShowcase() {
  const [playing, setPlaying] = useState(false)
  const [run, setRun] = useState(0)
  const section = useRef<HTMLElement>(null)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setPlaying(true); observer.disconnect() }
    }, { threshold: 0.3 })
    if (section.current) observer.observe(section.current)
    return () => observer.disconnect()
  }, [])
  return <section ref={section} className={styles.section} aria-labelledby="practice-link-heading">
    <div className={styles.inner}>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Their own link. Their own game.</p>
        <h2 id="practice-link-heading">Just tap{" "}<br /><span>and play.</span></h2>
        <p className={styles.lead}>Their own practice link. No parent login needed.</p>
        <a className={styles.cta} href="/play?signup=1">Start playing <ArrowRight size={19} /></a>
        <p className={styles.note}><ShieldCheck size={16} /> Their independence. Your peace of mind.</p>
      </div>
      <div className={styles.demonstration}>
        <div key={run} className={`${styles.devices} ${playing ? styles.playing : ""}`} aria-label="Demo: a parent shares Maya’s practice link, which opens Maya’s Multiply activities on her own phone.">
          <div className={styles.deviceGroup}>
            <p className={styles.deviceLabel}>Parent’s phone</p>
            <div className={styles.phone}>
              <div className={styles.status}>9:41 <span>••• ▰</span></div><div className={styles.island} />
              <div className={styles.phoneContent}>
                <div className={styles.brand}>Multiply<span>!</span><Settings2 size={17} /></div>
                <p className={styles.screenTitle}>Your players</p>
                <div className={styles.profile}><span className={styles.avatar}>M</span><div><b>Maya</b><small>420 XP · Builder</small></div></div>
                <div className={styles.learning}><span>Learning settings</span><b>Tables 1–6</b><small>You choose what Maya practices.</small></div>
                <div className={styles.share}><Link2 size={16} /> Share practice link</div>
                <div className={styles.linkPreview}><Link2 size={14} /><span>Maya’s personal link</span><Check size={14} /></div>
                <p className={styles.control}><ShieldCheck size={14} /> Disable or replace links anytime</p>
              </div>
            </div>
            <p className={styles.caption}>You share once.</p>
          </div>
          <div className={styles.transfer} aria-hidden="true"><div className={styles.track} /><span className={styles.link}><Link2 size={21} /></span></div>
          <div className={`${styles.deviceGroup} ${styles.child}`}>
            <p className={styles.deviceLabel}>Child’s phone</p>
            <div className={styles.phone}>
              <div className={styles.status}>9:41 <span>••• ▰</span></div><div className={styles.island} />
              <div className={styles.waiting} aria-hidden="true"><span className={styles.waitIcon}><Link2 size={26} /></span><b>A little independence,<br />one tap away.</b></div>
              <div className={`${styles.phoneContent} ${styles.game}`}>
                <div className={styles.brand}>Multiply<span>!</span><span className={styles.miniAvatar}>M</span></div>
                <div className={styles.profile}><span className={styles.avatar}>M</span><div><b>Maya</b><small>420 XP · Builder</small></div></div>
                <p className={styles.screenTitle}>Let’s play, Maya!</p><p className={styles.screenSubtitle}>A little practice. A big adventure.</p>
                <div className={styles.activity}><Sparkles size={25} /><b>Practice</b><small>Build your confidence</small></div>
                <div className={styles.challenge}>🏆 <b>Challenge</b></div>
                <div className={styles.mastery}><span>Facts mastered</span><b>20 of 60</b><div><i /></div></div>
                <p className={styles.home}><Home size={13} /> Add to your home screen</p>
              </div>
            </div>
            <p className={styles.caption}>They’re ready to play.</p>
          </div>
        </div>
        <div className={styles.demoFooter}><span><Check size={15} /> Their profile. Your password and settings stay private.</span><button type="button" onClick={() => { setPlaying(true); setRun(value => value + 1) }} aria-label="Replay practice link demo"><RotateCcw size={14} /> Replay</button></div>
        <p className={styles.demoNote}>Illustrative demo · Each child gets a separate practice link.</p>
      </div>
      <div className={styles.benefits}>
        <div><span><Sparkles size={20} /></span><h3>Every win comes home.</h3><p>Progress, XP, and mastery sync with your family’s account.</p></div>
        <div><span><ShieldCheck size={20} /></span><h3>You’re still in control.</h3><p>Manage learning settings. Disable or replace links anytime.</p></div>
        <div><span><Home size={20} /></span><h3>One tap from home.</h3><p>Kids can add Multiply! to their home screen for next time.</p></div>
      </div>
    </div>
  </section>
}
