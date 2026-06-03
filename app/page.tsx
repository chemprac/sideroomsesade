'use client'

import { useState, useEffect } from 'react'

const BLOCKED_DOMAINS = [
  'gmail', 'yahoo', 'hotmail', 'outlook', 'icloud',
  'aol', 'protonmail', 'mail', 'ymail', 'googlemail',
  'live', 'msn', 'me'
]

function isWorkEmail(email: string): boolean {
  const domain = email.split('@')[1]
  if (!domain) return false
  const base = domain.split('.')[0].toLowerCase()
  return !BLOCKED_DOMAINS.includes(base)
}

type BubbleStyle = 'outline' | 'amber' | 'dark'
type PersonTier = 'high' | 'medium' | 'low' | 'none'

type Person = {
  x: number
  scale: number
  tier: PersonTier
  hasBubbleSlot: boolean
}

type ActiveBubble = {
  personIndex: number
  text: string
  style: BubbleStyle
}

/** Signal bubbles — funding, hiring, career, LinkedIn, warm, news */
const BUBBLE_MESSAGES: { text: string; style: BubbleStyle; tier: PersonTier }[] = [
  // Funding
  { text: 'Just raised Series B', style: 'dark', tier: 'high' },
  { text: 'Backed 3 companies like yours', style: 'dark', tier: 'high' },
  { text: 'Listed open to co-investment', style: 'amber', tier: 'high' },
  { text: 'Seed round closed last month', style: 'dark', tier: 'high' },
  // Hiring / growth
  { text: 'Hiring in GTM', style: 'amber', tier: 'high' },
  { text: 'Just posted Head of Sales role', style: 'amber', tier: 'medium' },
  { text: 'Doubled headcount this quarter', style: 'amber', tier: 'medium' },
  { text: 'Hiring in your exact market', style: 'amber', tier: 'high' },
  // Career / background
  { text: 'Exited your competitor last year', style: 'dark', tier: 'high' },
  { text: 'Left Google 6 months ago to build', style: 'dark', tier: 'high' },
  { text: 'Was VP Sales at your top client', style: 'dark', tier: 'high' },
  { text: 'Founded 3 companies before this', style: 'dark', tier: 'medium' },
  // LinkedIn activity
  { text: 'Liked your post about AI in sales', style: 'outline', tier: 'medium' },
  { text: 'Posts weekly about your problem', style: 'outline', tier: 'medium' },
  { text: 'Commented on your industry thread', style: 'outline', tier: 'medium' },
  { text: 'Follows your cofounder on LinkedIn', style: 'outline', tier: 'low' },
  // Warm connections
  { text: 'Went to your university', style: 'dark', tier: 'high' },
  { text: 'Mutual: your lead investor', style: 'dark', tier: 'high' },
  { text: 'Worked at your last company', style: 'dark', tier: 'high' },
  { text: 'Knows your 3 closest colleagues', style: 'dark', tier: 'medium' },
  // News / announcements
  { text: 'CEO announced CSR push', style: 'amber', tier: 'medium' },
  { text: 'Just announced a new partnership', style: 'outline', tier: 'medium' },
  { text: 'Company entered your market', style: 'outline', tier: 'medium' },
  { text: 'Spoke at this event 2 years ago', style: 'outline', tier: 'medium' },
]

const CROWD_LAYOUT: { x: number; scale: number; tier: PersonTier; bubble: boolean }[] = [
  { x: 2, scale: 0.74, tier: 'none', bubble: true },
  { x: 6, scale: 0.82, tier: 'low', bubble: true },
  { x: 10, scale: 0.89, tier: 'medium', bubble: true },
  { x: 14, scale: 1.02, tier: 'high', bubble: true },
  { x: 18, scale: 0.84, tier: 'low', bubble: true },
  { x: 22, scale: 1.06, tier: 'high', bubble: true },
  { x: 26, scale: 0.93, tier: 'medium', bubble: true },
  { x: 30, scale: 1.0, tier: 'high', bubble: true },
  { x: 34, scale: 0.87, tier: 'low', bubble: true },
  { x: 38, scale: 0.91, tier: 'none', bubble: true },
  { x: 42, scale: 1.0, tier: 'medium', bubble: true },
  { x: 46, scale: 0.80, tier: 'none', bubble: true },
  { x: 50, scale: 0.85, tier: 'low', bubble: true },
  { x: 54, scale: 0.95, tier: 'medium', bubble: true },
  { x: 58, scale: 1.04, tier: 'high', bubble: true },
  { x: 62, scale: 0.88, tier: 'low', bubble: true },
  { x: 66, scale: 0.92, tier: 'medium', bubble: true },
  { x: 70, scale: 1.0, tier: 'high', bubble: true },
  { x: 74, scale: 0.86, tier: 'low', bubble: true },
  { x: 78, scale: 0.90, tier: 'medium', bubble: true },
  { x: 82, scale: 1.02, tier: 'high', bubble: true },
  { x: 86, scale: 0.83, tier: 'none', bubble: true },
  { x: 90, scale: 0.96, tier: 'medium', bubble: true },
  { x: 94, scale: 0.78, tier: 'none', bubble: true },
  { x: 98, scale: 0.76, tier: 'none', bubble: false },
]

const PEOPLE: Person[] = CROWD_LAYOUT.map((slot) => ({
  x: slot.x,
  scale: slot.scale,
  tier: slot.tier,
  hasBubbleSlot: slot.bubble,
}))

const BUBBLE_SLOT_INDICES = PEOPLE.map((_, i) => i).filter((i) => PEOPLE[i].hasBubbleSlot)

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const TIER_COLORS: Record<string, string[]> = {
  high:   ['#2D6A4F', '#1B4332', '#40916C'],
  medium: ['#C4842A', '#A06820', '#D4944A'],
  low:    ['#8B7D5A', '#6B5D3F', '#A08D6A'],
  none:   ['#D4C9A8', '#C4B89A', '#BFB49A'],
}

function pickColor(tier: string, i: number) {
  return TIER_COLORS[tier][i % TIER_COLORS[tier].length]
}

const SHOW_DUR = 1800
const GAP = 900
const STEP = SHOW_DUR + GAP
const CYCLE = BUBBLE_MESSAGES.length * STEP + 600

export default function HomePage() {
  const [activeBubble, setActiveBubble] = useState<ActiveBubble | null>(null)
  const [email, setEmail] = useState('')
  const [conference, setConference] = useState('')
  const [emailError, setEmailError] = useState('')
  const [confError, setConfError] = useState('')
  const [apiError, setApiError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    let cancelled = false
    const timeouts: ReturnType<typeof setTimeout>[] = []

    function runCycle() {
      timeouts.forEach(clearTimeout)
      timeouts.length = 0

      const slotOrder = shuffle(BUBBLE_SLOT_INDICES)
      const messageOrder = shuffle(BUBBLE_MESSAGES.map((_, i) => i))
      const count = Math.min(slotOrder.length, messageOrder.length)

      messageOrder.slice(0, count).forEach((msgIdx, order) => {
        const personIdx = slotOrder[order]
        const msg = BUBBLE_MESSAGES[msgIdx]
        const showAt = order * STEP

        timeouts.push(
          setTimeout(() => {
            if (!cancelled) {
              setActiveBubble({
                personIndex: personIdx,
                text: msg.text,
                style: msg.style,
              })
            }
          }, showAt)
        )

        timeouts.push(
          setTimeout(() => {
            if (!cancelled) {
              setActiveBubble((prev) =>
                prev?.personIndex === personIdx ? null : prev
              )
            }
          }, showAt + SHOW_DUR)
        )
      })

      timeouts.push(
        setTimeout(() => {
          if (!cancelled) runCycle()
        }, CYCLE)
      )
    }

    runCycle()

    return () => {
      cancelled = true
      timeouts.forEach(clearTimeout)
    }
  }, [])

  async function handleSubmit() {
    setEmailError('')
    setConfError('')
    setApiError('')
    let valid = true

    if (!email || !email.includes('@') || !isWorkEmail(email)) {
      setEmailError('Please use your work email address.')
      valid = false
    }
    if (!conference.trim()) {
      setConfError('Please tell us which conference you are attending.')
      valid = false
    }
    if (!valid) return

    setLoading(true)
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, conference }),
      })
      const data = await res.json()
      if (!res.ok) {
        setApiError(data.error || 'Something went wrong.')
      } else {
        setSubmitted(true)
      }
    } catch {
      setApiError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ background: '#F5F0E6', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' }}>

      {/* NAV */}
      <nav style={{ borderBottom: '1px solid #C4B89A', padding: '18px 40px', display: 'flex', alignItems: 'center' }}>
        <div className="logo-wrap">
          <span className="logo-mark">SR</span>
          <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 600, color: '#1C1208', letterSpacing: '-0.02em' }}>
            sideroom
          </span>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ padding: '56px 40px 48px', textAlign: 'center', borderBottom: '1px solid #EDE5D0', overflow: 'visible' }}>
        <p style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8B7D5A', marginBottom: 14 }}>
          B2B conference intelligence &amp; management
        </p>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 600, color: '#1C1208', lineHeight: 1.25, marginBottom: 12 }}>
          You&apos;re about to walk into a room<br />of 4,000 people.
        </h1>
        <p style={{ fontSize: 16, color: '#8B7D5A', lineHeight: 1.7, marginBottom: 40 }}>
          Sideroom tells you exactly who matters —<br />and what matters to them — before you walk in.
        </p>

        {/* CROWD */}
        <div style={{ position: 'relative', height: 280, maxWidth: 960, margin: '0 auto', overflow: 'visible' }}>
          {PEOPLE.map((p, i) => {
            const color = pickColor(p.tier, i)
            const h = Math.round(120 * p.scale)
            const w = Math.round(52 * p.scale)
            const hw = w / 2
            const headR = Math.round(12 * p.scale)
            const headCY = Math.round(14 * p.scale)
            const shoulderY = Math.round(30 * p.scale)
            const hipY = Math.round(72 * p.scale)
            const showing =
              activeBubble !== null && activeBubble.personIndex === i
            const bubble = showing ? activeBubble : null

            return (
              <div key={i} style={{ position: 'absolute', bottom: 0, left: `${p.x}%`, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: showing ? 20 : 4 }}>
                {bubble && (
                  <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: `translateX(-50%) translateY(${showing ? '-4px' : '6px'})`,
                    opacity: showing ? 1 : 0,
                    transition: 'opacity 0.4s ease, transform 0.4s ease',
                    fontFamily: 'DM Sans, sans-serif',
                    fontSize: 11,
                    fontWeight: 500,
                    padding: '6px 10px',
                    borderRadius: 3,
                    width: 'max-content',
                    maxWidth: 'none',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.2,
                    pointerEvents: 'none',
                    marginBottom: 6,
                    background: bubble.style === 'dark' ? '#1C1208' : bubble.style === 'amber' ? '#C4842A' : '#F5F0E6',
                    color: bubble.style === 'outline' ? '#1C1208' : '#F5F0E6',
                    border: bubble.style === 'outline' ? '1px solid #C4B89A' : 'none',
                  }}>
                    {bubble.text}
                    <span style={{
                      position: 'absolute',
                      top: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 0,
                      height: 0,
                      borderLeft: '5px solid transparent',
                      borderRight: '5px solid transparent',
                      borderTop: `5px solid ${bubble.style === 'dark' ? '#1C1208' : bubble.style === 'amber' ? '#C4842A' : '#C4B89A'}`,
                    }} />
                  </div>
                )}
                <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg">
                  <circle cx={hw} cy={headCY} r={headR} fill={color} />
                  <path d={`M${hw - Math.round(20 * p.scale)} ${shoulderY} Q${hw} ${Math.round(26 * p.scale)} ${hw + Math.round(20 * p.scale)} ${shoulderY} L${hw + Math.round(16 * p.scale)} ${hipY} L${hw - Math.round(16 * p.scale)} ${hipY} Z`} fill={color} />
                  <rect x={hw - Math.round(16 * p.scale)} y={hipY} width={Math.round(13 * p.scale)} height={Math.round(h - hipY)} rx={2} fill={color} />
                  <rect x={hw + Math.round(3 * p.scale)} y={hipY} width={Math.round(13 * p.scale)} height={Math.round(h - hipY)} rx={2} fill={color} />
                </svg>
              </div>
            )
          })}
        </div>

        {/* WAITLIST FORM */}
        <div style={{ margin: '36px auto 0', maxWidth: 460, background: '#EDE5D0', border: '1px solid #C4B89A', borderRadius: 3, padding: '24px 28px', textAlign: 'left' }}>
          {submitted ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <p style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, color: '#1C1208', marginBottom: 6 }}>You&apos;re on the list.</p>
              <p style={{ fontSize: 13, color: '#8B7D5A' }}>We&apos;ll be in touch as soon as your event goes live on Sideroom.</p>
            </div>
          ) : (
            <>
              <p style={{ fontFamily: 'Playfair Display, serif', fontSize: 17, color: '#1C1208', marginBottom: 4 }}>Get early access</p>
              <p style={{ fontSize: 12, color: '#8B7D5A', marginBottom: 18, lineHeight: 1.5 }}>Takes 2 seconds. We&apos;ll reach out with everything you need.</p>

              <div style={{ marginBottom: 10 }}>
                <input
                  type="email"
                  placeholder="Your work email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: '#1C1208', background: '#F5F0E6', border: `1px solid ${emailError ? '#A33A2A' : '#C4B89A'}`, borderRadius: 3, padding: '10px 12px', outline: 'none' }}
                />
                {emailError && <p style={{ fontSize: 11, color: '#A33A2A', marginTop: 4 }}>{emailError}</p>}
              </div>

              <div style={{ marginBottom: 10 }}>
                <input
                  type="text"
                  placeholder="Which conference are you attending?"
                  value={conference}
                  onChange={e => setConference(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: '#1C1208', background: '#F5F0E6', border: `1px solid ${confError ? '#A33A2A' : '#C4B89A'}`, borderRadius: 3, padding: '10px 12px', outline: 'none' }}
                />
                {confError && <p style={{ fontSize: 11, color: '#A33A2A', marginTop: 4 }}>{confError}</p>}
              </div>

              {apiError && <p style={{ fontSize: 11, color: '#A33A2A', marginBottom: 8 }}>{apiError}</p>}

              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{ width: '100%', marginTop: 14, fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 500, letterSpacing: '0.05em', background: loading ? '#8B7D5A' : '#1C1208', color: '#F5F0E6', border: 'none', borderRadius: 3, padding: 12, cursor: loading ? 'default' : 'pointer' }}
              >
                {loading ? 'Joining...' : 'Join the waitlist'}
              </button>
              <p style={{ fontSize: 11, color: '#8B7D5A', textAlign: 'center', marginTop: 10 }}>No spam. No password. Just a heads-up when your event goes live.</p>
            </>
          )}
        </div>

        <p style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8B7D5A', marginTop: 28, borderTop: '1px solid #EDE5D0', paddingTop: 16 }}>
          <strong style={{ color: '#1C1208', fontWeight: 500 }}>Live at select events</strong> &nbsp;·&nbsp; More coming soon &nbsp;·&nbsp; <strong style={{ color: '#1C1208', fontWeight: 500 }}>Be part of the beta</strong>
        </p>
      </section>

      {/* FEATURES */}
      <section style={{ background: '#EDE5D0', borderTop: '1px solid #C4B89A', padding: '40px 40px 48px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <p style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8B7D5A', marginBottom: 6 }}>What&apos;s inside</p>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: '#1C1208', marginBottom: 4 }}>Everything you need to own the room</h2>
          <p style={{ fontSize: 13, color: '#8B7D5A' }}>Live now — with more shipping every two weeks.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 760, margin: '0 auto' }}>
          {/* LIVE */}
          <div style={{ background: '#F5F0E6', border: '1px solid #C4B89A', borderRadius: 3, padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid #EDE5D0' }}>
              <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 2, fontWeight: 500, background: '#C4842A', color: '#F5F0E6' }}>Live now</span>
              <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 15, color: '#1C1208' }}>Available today</span>
            </div>
            {[
              { name: 'AI attendee matching', desc: 'Ranked list of who to meet based on your goal and ICP' },
              { name: 'Conference briefing', desc: 'Speakers, themes, and agenda intelligence in one page' },
              { name: 'Company intelligence', desc: 'Funding signals, hiring trends, and news for every exhibitor' },
              { name: 'Attendee profiles', desc: 'AI-enriched backgrounds on every person in the room' },
            ].map(f => (
              <div key={f.name} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderBottom: '1px solid #EDE5D0' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#C4842A', flexShrink: 0, marginTop: 6 }} />
                <div>
                  <span style={{ fontSize: 12, color: '#1C1208', fontWeight: 500 }}>{f.name}</span>
                  <span style={{ display: 'block', fontSize: 11, color: '#8B7D5A', marginTop: 1 }}>{f.desc}</span>
                </div>
              </div>
            ))}
          </div>

          {/* COMING SOON */}
          <div style={{ background: '#F5F0E6', border: '1px solid #C4B89A', borderRadius: 3, padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid #EDE5D0' }}>
              <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 2, fontWeight: 500, background: '#EDE5D0', color: '#8B7D5A', border: '1px solid #C4B89A' }}>Coming soon</span>
              <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 15, color: '#1C1208' }}>On the roadmap</span>
            </div>
            {[
              { name: 'CRM integration', desc: 'Sync matched contacts directly to HubSpot or Salesforce' },
              { name: 'Expected ROI calculator', desc: 'Estimate pipeline value before you buy your ticket' },
              { name: 'Event comparison', desc: 'Compare two conferences side-by-side against your ICP' },
              { name: 'Side event intelligence', desc: 'Dinners, happy hours, and invite-only events near the venue' },
              { name: 'Meeting scheduler', desc: 'Request meetings with matched attendees before the event' },
              { name: 'Post-event debrief', desc: 'Track who you met, notes, and follow-up actions in one place' },
              { name: 'Team view', desc: 'See which colleagues are attending and split the room' },
              { name: 'Event organisation', desc: 'Tools for organisers to deliver Sideroom to their attendees' },
              { name: 'Slack digest', desc: 'Daily briefing dropped into Slack the week before your event' },
            ].map((f, idx, arr) => (
              <div key={f.name} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderBottom: idx < arr.length - 1 ? '1px solid #EDE5D0' : 'none' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#C4B89A', flexShrink: 0, marginTop: 6 }} />
                <div>
                  <span style={{ fontSize: 12, color: '#1C1208', fontWeight: 500 }}>{f.name}</span>
                  <span style={{ display: 'block', fontSize: 11, color: '#8B7D5A', marginTop: 1 }}>{f.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid #C4B89A', padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 14, color: '#8B7D5A' }}>sideroom</span>
        <span style={{ fontSize: 11, color: '#C4B89A' }}>© 2026 Sideroom. All rights reserved.</span>
      </footer>

    </main>
  )
}
