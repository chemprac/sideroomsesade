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

const PEOPLE = [
  { x: 1,  scale: 0.74, tier: 'none',   bubble: null },
  { x: 8,  scale: 0.82, tier: 'low',    bubble: null },
  { x: 15, scale: 0.89, tier: 'medium', bubble: { text: 'Talked conference planning in a podcast', style: 'outline' } },
  { x: 23, scale: 1.02, tier: 'high',   bubble: { text: 'Hiring in GTM', style: 'amber' } },
  { x: 32, scale: 0.84, tier: 'low',    bubble: null },
  { x: 40, scale: 1.06, tier: 'high',   bubble: { text: 'Just raised Series B', style: 'dark' } },
  { x: 49, scale: 0.93, tier: 'medium', bubble: { text: 'Liked your post about AI in sales', style: 'outline' } },
  { x: 57, scale: 1.0,  tier: 'high',   bubble: { text: 'Went to your university', style: 'dark' } },
  { x: 65, scale: 0.87, tier: 'low',    bubble: null },
  { x: 72, scale: 0.91, tier: 'none',   bubble: null },
  { x: 79, scale: 1.0,  tier: 'medium', bubble: { text: 'CEO announced CSR push', style: 'amber' } },
  { x: 87, scale: 0.80, tier: 'none',   bubble: null },
]

const TIER_COLORS: Record<string, string[]> = {
  high:   ['#2D6A4F', '#1B4332', '#40916C'],
  medium: ['#C4842A', '#A06820', '#D4944A'],
  low:    ['#8B7D5A', '#6B5D3F', '#A08D6A'],
  none:   ['#D4C9A8', '#C4B89A', '#BFB49A'],
}

function pickColor(tier: string, i: number) {
  return TIER_COLORS[tier][i % TIER_COLORS[tier].length]
}

const BUBBLE_INDICES = PEOPLE.map((p, i) => p.bubble ? i : -1).filter(i => i >= 0)
const SHOW_DUR = 1800
const GAP = 900
const CYCLE = BUBBLE_INDICES.length * (SHOW_DUR + GAP) + 600

export default function HomePage() {
  const [visibleBubbles, setVisibleBubbles] = useState<Set<number>>(new Set())
  const [email, setEmail] = useState('')
  const [conference, setConference] = useState('')
  const [emailError, setEmailError] = useState('')
  const [confError, setConfError] = useState('')
  const [apiError, setApiError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    function runCycle() {
      BUBBLE_INDICES.forEach((personIdx, order) => {
        const showAt = order * (SHOW_DUR + GAP)
        setTimeout(() => {
          setVisibleBubbles(prev => new Set(prev).add(personIdx))
        }, showAt)
        setTimeout(() => {
          setVisibleBubbles(prev => {
            const next = new Set(prev)
            next.delete(personIdx)
            return next
          })
        }, showAt + SHOW_DUR)
      })
    }
    runCycle()
    const interval = setInterval(runCycle, CYCLE)
    return () => clearInterval(interval)
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
      <section style={{ padding: '56px 40px 48px', textAlign: 'center', borderBottom: '1px solid #EDE5D0' }}>
        <p style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8B7D5A', marginBottom: 14 }}>
          Attend smarter
        </p>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 600, color: '#1C1208', lineHeight: 1.25, marginBottom: 12 }}>
          You&apos;re about to walk into a room<br />of 4,000 people.
        </h1>
        <p style={{ fontSize: 16, color: '#8B7D5A', lineHeight: 1.7, marginBottom: 40 }}>
          Sideroom tells you exactly who matters —<br />and what matters to them — before you walk in.
        </p>

        {/* CROWD */}
        <div style={{ position: 'relative', height: 260, maxWidth: 720, margin: '0 auto' }}>
          {PEOPLE.map((p, i) => {
            const color = pickColor(p.tier, i)
            const h = Math.round(120 * p.scale)
            const w = Math.round(52 * p.scale)
            const hw = w / 2
            const headR = Math.round(12 * p.scale)
            const headCY = Math.round(14 * p.scale)
            const shoulderY = Math.round(30 * p.scale)
            const hipY = Math.round(72 * p.scale)
            const isVisible = visibleBubbles.has(i)

            return (
              <div key={i} style={{ position: 'absolute', bottom: 0, left: `${p.x}%`, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: i === 5 ? 7 : i === 3 || i === 7 ? 6 : 4 }}>
                {p.bubble && (
                  <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: `translateX(-50%) translateY(${isVisible ? '-4px' : '6px'})`,
                    opacity: isVisible ? 1 : 0,
                    transition: 'opacity 0.4s ease, transform 0.4s ease',
                    fontFamily: 'DM Sans, sans-serif',
                    fontSize: 11,
                    fontWeight: 500,
                    padding: '6px 10px',
                    borderRadius: 3,
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    marginBottom: 6,
                    background: p.bubble.style === 'dark' ? '#1C1208' : p.bubble.style === 'amber' ? '#C4842A' : '#F5F0E6',
                    color: p.bubble.style === 'outline' ? '#1C1208' : '#F5F0E6',
                    border: p.bubble.style === 'outline' ? '1px solid #C4B89A' : 'none',
                  }}>
                    {p.bubble.text}
                    <span style={{
                      position: 'absolute',
                      top: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 0,
                      height: 0,
                      borderLeft: '5px solid transparent',
                      borderRight: '5px solid transparent',
                      borderTop: `5px solid ${p.bubble.style === 'dark' ? '#1C1208' : p.bubble.style === 'amber' ? '#C4842A' : '#C4B89A'}`,
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
