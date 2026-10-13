import { ArrowRight, Check, Link2, Settings2, ShieldCheck } from "lucide-react"
import { MasteryBadge } from "@/components/mastery-badge"
import styles from "./practice-link-showcase.module.css"

// Display-only sample screens. The entire handoff is visible without timing or JS.
export function PracticeLinkShowcase() {
  return <section className={styles.section} aria-labelledby="practice-link-heading">
    <div className={styles.inner}>
      <div className={styles.intro}>
        <h2 id="practice-link-heading">Just tap{" "}<br /><span>and play.</span></h2>
        <p className={styles.lead}>Their own practice link. No parent login needed.</p>
        <a className={styles.cta} href="/play?signup=1">Start playing <ArrowRight size={19} /></a>
        <p className={styles.note}><ShieldCheck size={16} /> Only their player. No parent settings.</p>
      </div>
      <div className={styles.demonstration}>
        <div className={styles.devices}>
          <div className={styles.deviceGroup}>
            <h3 className={styles.deviceLabel}>1. Parent shares</h3>
            <div className={styles.phone}>
              <div className={styles.status} aria-hidden="true">9:41 <span>••• ▰</span></div><div className={styles.island} />
              <div className={styles.phoneContent}>
                <div className={styles.brand}>Multiply<span>!</span></div>
                <p className={styles.breadcrumb}><Settings2 size={16} /> Settings</p>
                <p className={styles.screenTitle}>Kids’ practice links</p>
                <div className={styles.learning}><b>Maya</b><span>Practice link enabled</span></div>
                <div className={styles.linkPreview}><Link2 size={16} /><span>Maya’s practice link</span><Check size={16} /></div>
                <p className={styles.share}><Link2 size={16} /> Copy or share link</p>
                <p className={styles.control}>Disable or replace links anytime.</p>
              </div>
            </div>
            <p className={styles.caption}>Create a link in Settings, then send it.</p>
          </div>
          <div className={styles.transfer} aria-hidden="true"><ArrowRight size={25} /></div>
          <div className={`${styles.deviceGroup} ${styles.child}`}>
            <h3 className={styles.deviceLabel}>2. Child opens → 3. Plays</h3>
            <div className={styles.phone}>
              <div className={styles.status} aria-hidden="true">9:41 <span>••• ▰</span></div><div className={styles.island} />
              <div className={styles.phoneContent}>
                <div className={styles.brand}>Multiply<span>!</span><span className={styles.playerXp}>420 XP</span></div>
                <p className={styles.identity}><span className={styles.avatar}>M</span><b>Maya</b></p>
                <p className={styles.screenTitle}>Choose an activity</p>
                <div className={styles.mastery}>
                  <MasteryBadge level={{ number: 3, name: "Builder" }} size={60} />
                  <div><b>Level 3 · Builder</b><span>20 / 60 facts mastered</span></div>
                  <div className={styles.progress}><i /></div>
                </div>
                <div className={styles.activities}>
                  <div className={styles.activity}><span aria-hidden="true">🌱</span><b>Practice</b><small>+1 XP per correct answer</small></div>
                  <div className={styles.challenge}><span aria-hidden="true">🏆</span><b>Challenge</b><small>+1 XP per correct answer</small></div>
                </div>
                <p className={styles.leaderboard}>Family leaderboard</p>
              </div>
            </div>
            <p className={styles.caption}>The link opens their activities.</p>
          </div>
        </div>
        <p className={styles.demoNote}>Illustrative screens · Fictional player and sample progress.</p>
        <p className={styles.demoFooter}><ShieldCheck size={16} /> Anyone with the link can practice as that child. Progress saves to your family. Internet access required.</p>
      </div>
    </div>
  </section>
}
