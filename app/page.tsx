'use client'

import { useState, useEffect, useRef } from 'react'

const BLOCKED_DOMAINS = ['gmail','yahoo','hotmail','outlook','icloud','aol','protonmail','mail','ymail','googlemail','live','msn','me']
function isWorkEmail(email: string) {
  const domain = (email.split('@')[1] || '')
  return !BLOCKED_DOMAINS.includes(domain.split('.')[0].toLowerCase())
}

const TIERS: Record<string, string[]> = {
  high:   ['#2D6A4F','#1B4332','#40916C'],
  medium: ['#C4842A','#A06820','#D4944A'],
  low:    ['#8B7D5A','#6B5D3F'],
  none:   ['#D4C9A8','#C4B89A','#BFB49A'],
}

const PEOPLE = [
  {x:0.5, s:0.70, t:'none'},
  {x:5.5, s:0.76, t:'low'},
  {x:10,  s:0.82, t:'medium'},
  {x:15,  s:0.78, t:'none'},
  {x:20,  s:0.99, t:'high'},
  {x:25,  s:0.80, t:'low'},
  {x:30,  s:0.86, t:'medium'},
  {x:35,  s:0.74, t:'none'},
  {x:40,  s:1.05, t:'high'},
  {x:45,  s:0.83, t:'low'},
  {x:50,  s:0.90, t:'medium'},
  {x:55,  s:0.77, t:'none'},
  {x:60,  s:1.01, t:'high'},
  {x:65,  s:0.85, t:'low'},
  {x:70,  s:0.80, t:'medium'},
  {x:75,  s:0.73, t:'none'},
  {x:80,  s:0.98, t:'high'},
  {x:85,  s:0.82, t:'low'},
  {x:90,  s:0.88, t:'medium'},
  {x:95,  s:0.75, t:'none'},
]

const HIGH_INDICES = PEOPLE.map((p,i) => p.t === 'high' ? i : -1).filter(i => i >= 0)

const PROFILES = [
  {
    initials: 'SK', bg: '#1B4332', fg: '#a8d5be',
    name: 'Sarah Kim', role: 'Partner · Sequoia Capital',
    tags: [{l:'Investor',a:true},{l:'Active',a:false}],
    score: '94',
    signals: ['Backed 3 companies like yours','Open to co-investment','Mutual: your lead investor','Seed round in your sector'],
    intel: 'Kim led Sequoia\'s Series A into two supply chain security startups — her portfolio thesis maps directly onto your space, and she\'s been publicly vocal about the gap in physical authentication.',
  },
  {
    initials: 'MR', bg: '#1B4332', fg: '#a8d5be',
    name: 'Marcus Reid', role: 'Founder & CEO · Stacklane',
    tags: [{l:'Founder',a:true},{l:'Synergy',a:false}],
    score: '88',
    signals: ['Exited your competitor last year','Posts about the problem you solve','Just signed a co-marketing deal','Follows your cofounder on LinkedIn'],
    intel: 'Reid built and sold a logistics SaaS to a strategic buyer in your vertical — his existing customer relationships and public writing on supply chain fraud make him a credible co-marketing partner.',
  },
  {
    initials: 'JP', bg: '#1B4332', fg: '#a8d5be',
    name: 'Joana Pereira', role: 'VP Enterprise · Siemens Digital',
    tags: [{l:'Buyer',a:true},{l:'Hot lead',a:false}],
    score: '91',
    signals: ['Hiring Head of Sales now','CEO announced market expansion','Liked your post about AI in ops','Went to your university'],
    intel: 'Pereira oversees Siemens\' enterprise digitalisation division — her team\'s recent expansion into APAC means new vendor relationships are actively being evaluated, making this a high-probability entry point.',
  },
  {
    initials: 'AT', bg: '#1B4332', fg: '#a8d5be',
    name: 'Alex Torres', role: 'General Partner · Lux Capital',
    tags: [{l:'Investor',a:true},{l:'Deep tech',a:false}],
    score: '89',
    signals: ['Thesis: physical-digital convergence','Co-invested with your lead VC','Spoke at RSA on supply chain risk','Posted about authentication gaps'],
    intel: 'Torres has publicly stated she\'s actively sourcing in the anti-counterfeiting space after a portfolio company flagged the gap — your timing to meet her here is unusually good.',
  },
]

const CARD_W = 480
const SHOW_MS = 6500

function clr(t: string, i: number) { return TIERS[t][i % TIERS[t].length] }

function Silhouette({ color, scale }: { color: string; scale: number }) {
  const h = Math.round(112 * scale), w = Math.round(42 * scale), hw = w / 2
  const hr = Math.round(9 * scale), hcy = Math.round(11 * scale)
  const sy = Math.round(24 * scale), hy = Math.round(62 * scale), lw = Math.round(10 * scale)
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg">
      <circle cx={hw} cy={hcy} r={hr} fill={color} />
      <path d={`M${hw-Math.round(14*scale)} ${sy} Q${hw} ${Math.round(20*scale)} ${hw+Math.round(14*scale)} ${sy} L${hw+Math.round(10*scale)} ${hy} L${hw-Math.round(10*scale)} ${hy} Z`} fill={color} />
      <rect x={hw-Math.round(10*scale)} y={hy} width={lw} height={h-hy} rx={2} fill={color} />
      <rect x={hw} y={hy} width={lw} height={h-hy} rx={2} fill={color} />
    </svg>
  )
}

function EmailIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#C4B89A" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/>
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="#C4B89A">
      <path d="M6.5 8a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM5 10h3v9H5v-9zm5 0h2.9v1.3c.4-.8 1.4-1.5 2.8-1.5 3 0 3.3 2 3.3 4.5V19h-3v-4.2c0-1 0-2.3-1.4-2.3-1.5 0-1.6 1.1-1.6 2.2V19H10v-9z"/>
    </svg>
  )
}

const C = {
  parchment: '#F5F0E6', ink: '#1C1208', amber: '#C4842A',
  border: '#C4B89A', muted: '#8B7D5A', aged: '#EDE5D0',
}

type Style = React.CSSProperties
const s = (obj: Style): Style => obj

export default function HomePage() {
  const [heroIdx, setHeroIdx]         = useState<number | null>(null)
  const [dimmed, setDimmed]           = useState(false)
  const [cardVisible, setCardVisible] = useState(false)
  const [cardLeft, setCardLeft]       = useState(0)
  const [cardGoLeft, setCardGoLeft]   = useState(false)
  const [turn, setTurn]               = useState(0)
  const [email, setEmail]             = useState('')
  const [conference, setConference]   = useState('')
  const [emailErr, setEmailErr]       = useState('')
  const [confErr, setConfErr]         = useState('')
  const [apiErr, setApiErr]           = useState('')
  const [loading, setLoading]         = useState(false)
  const [submitted, setSubmitted]     = useState(false)

  const outerRef   = useRef<HTMLDivElement>(null)
  const personRefs = useRef<(HTMLDivElement | null)[]>([])

  function placeCard(idx: number) {
    const outer = outerRef.current
    const pEl   = personRefs.current[idx]
    if (!outer || !pEl) return
    const oR     = outer.getBoundingClientRect()
    const pR     = pEl.getBoundingClientRect()
    const pRight = pR.right - oR.left
    const pLeft  = pR.left  - oR.left
    const outerW = outer.offsetWidth
    const gap    = 16
    if (outerW - pRight - gap >= CARD_W) {
      setCardGoLeft(false)
      setCardLeft(Math.min(pRight + gap, outerW - CARD_W))
    } else {
      setCardGoLeft(true)
      setCardLeft(Math.max(0, pLeft - gap - CARD_W))
    }
  }

  useEffect(() => {
    let cancelled = false
    const idx = HIGH_INDICES[turn % HIGH_INDICES.length]

    setHeroIdx(null)
    setDimmed(false)
    setCardVisible(false)

    const t1 = setTimeout(() => { if (cancelled) return; setDimmed(true); setHeroIdx(idx) }, 180)
    const t2 = setTimeout(() => { if (cancelled) return; placeCard(idx); setCardVisible(true) }, 480)
    const t3 = setTimeout(() => { if (cancelled) return; setCardVisible(false) }, 480 + SHOW_MS)
    const t4 = setTimeout(() => {
      if (cancelled) return
      setHeroIdx(null); setDimmed(false); setTurn(t => t + 1)
    }, 480 + SHOW_MS + 450)

    return () => { cancelled = true; clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [turn])

  async function handleSubmit() {
    setEmailErr(''); setConfErr(''); setApiErr('')
    let valid = true
    if (!email || !email.includes('@') || !isWorkEmail(email)) { setEmailErr('Please use your work email address.'); valid = false }
    if (!conference.trim()) { setConfErr('Please tell us which conference you\'re attending.'); valid = false }
    if (!valid) return
    setLoading(true)
    try {
      const res  = await fetch('/api/waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, conference }) })
      const data = await res.json()
      if (!res.ok) setApiErr(data.error || 'Something went wrong.')
      else setSubmitted(true)
    } catch { setApiErr('Something went wrong. Please try again.') }
    finally { setLoading(false) }
  }

  const prof = PROFILES[turn % PROFILES.length]

  return (
    <main style={s({ background: C.parchment, minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' })}>

      {/* NAV */}
      <nav style={s({ borderBottom: `1px solid ${C.border}`, padding: '18px 40px' })}>
        <span style={s({ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 600, color: C.ink, letterSpacing: '-0.02em' })}>sideroom</span>
      </nav>

      {/* HERO */}
      <section style={s({ padding: '52px 40px 48px', textAlign: 'center', borderBottom: `1px solid ${C.aged}` })}>
        <p style={s({ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.muted, marginBottom: 14 })}>Conference intelligence</p>
        <h1 style={s({ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(24px,3.5vw,38px)', fontWeight: 600, color: C.ink, lineHeight: 1.22, marginBottom: 12 })}>
          You're about to walk into a room<br />of 4,000 people.
        </h1>
        <p style={s({ fontSize: 15, color: C.muted, lineHeight: 1.75, marginBottom: 44 })}>
          Sideroom tells you exactly who matters —<br />and what matters to them — before you walk in.
        </p>

        {/* CROWD STAGE */}
        <div ref={outerRef} style={s({ position: 'relative', height: 420, maxWidth: 1100, margin: '0 auto' })}>

          {/* CARD ZONE — top 260px */}
          <div style={s({ position: 'absolute', top: 0, left: 0, right: 0, height: 260, pointerEvents: 'none', zIndex: 50 })}>
            <div style={s({
              position: 'absolute', width: CARD_W, top: 8, left: cardLeft,
              opacity: cardVisible ? 1 : 0,
              transform: cardVisible ? 'translateX(0)' : (cardGoLeft ? 'translateX(-10px)' : 'translateX(10px)'),
              transition: 'opacity .4s ease, transform .4s ease',
              pointerEvents: 'none',
            })}>
              <div style={s({ background: C.parchment, border: `1px solid ${C.border}`, borderRadius: 3, overflow: 'hidden' })}>

                {/* header */}
                <div style={s({ background: C.ink, padding: '13px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 })}>
                  <div style={s({ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 })}>
                    <div style={s({ width: 40, height: 40, borderRadius: '50%', background: prof.bg, color: prof.fg, fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 })}>{prof.initials}</div>
                    <div style={s({ minWidth: 0 })}>
                      <div style={s({ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 600, color: C.parchment, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' })}>{prof.name}</div>
                      <div style={s({ fontSize: 13, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' })}>{prof.role}</div>
                    </div>
                  </div>
                  <div style={s({ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 })}>
                    <span style={s({ fontSize: 11, letterSpacing: '0.07em', textTransform: 'uppercase', color: C.muted })}>Reach out</span>
                    <div style={s({ display: 'flex', gap: 6 })}>
                      {[<EmailIcon key="em"/>, <LinkedInIcon key="li"/>].map((icon, i) => (
                        <div key={i} style={s({ width: 34, height: 34, border: '1px solid rgba(196,184,154,0.3)', borderRadius: 2, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' })}>{icon}</div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* tags + score */}
                <div style={s({ background: C.ink, padding: '5px 20px 10px', borderTop: '1px solid rgba(196,184,154,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' })}>
                  <div style={s({ display: 'flex', gap: 6 })}>
                    {prof.tags.map((t, i) => (
                      <span key={i} style={s({ fontSize: 11, letterSpacing: '0.09em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 2, fontWeight: 500, background: t.a ? C.amber : 'transparent', color: t.a ? C.parchment : C.muted, border: t.a ? 'none' : '1px solid rgba(196,184,154,0.3)' })}>{t.l}</span>
                    ))}
                  </div>
                  <div style={s({ display: 'flex', alignItems: 'baseline', gap: 4 })}>
                    <span style={s({ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted, marginRight: 4 })}>Match</span>
                    <span style={s({ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 600, color: C.parchment })}>{prof.score}</span>
                    <span style={s({ fontSize: 12, color: C.muted })}>&nbsp;/ 100</span>
                  </div>
                </div>

                {/* signals 2x2 */}
                <div style={s({ padding: '11px 20px 0' })}>
                  <div style={s({ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.muted, marginBottom: 8 })}>Why this match</div>
                  <div style={s({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px' })}>
                    {prof.signals.map((sig, i) => (
                      <div key={i} style={s({ display: 'flex', alignItems: 'flex-start', gap: 7 })}>
                        <span style={s({ width: 4, height: 4, borderRadius: '50%', background: C.amber, flexShrink: 0, marginTop: 5, display: 'inline-block' })} />
                        <span style={s({ fontSize: 13, color: C.ink, lineHeight: 1.35, textAlign: 'left' })}>{sig}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* deep research */}
                <div style={s({ borderTop: `1px solid ${C.aged}`, marginTop: 10, padding: '10px 20px 13px' })}>
                  <div style={s({ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.amber, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 })}>
                    <span style={s({ width: 6, height: 6, borderRadius: '50%', background: C.amber, display: 'inline-block', flexShrink: 0 })} />
                    Deep research
                  </div>
                  <div style={s({ fontFamily: 'Playfair Display, serif', fontStyle: 'italic', fontSize: 13, color: '#3a2a10', lineHeight: 1.55 })}>"{prof.intel}"</div>
                </div>

              </div>
            </div>
          </div>

          {/* CROWD — bottom 170px */}
          <div style={s({ position: 'absolute', bottom: 0, left: 0, right: 0, height: 170 })}>
            {PEOPLE.map((p, i) => {
              const isHero = heroIdx === i
              const isDim  = dimmed && !isHero
              return (
                <div
                  key={i}
                  ref={el => { personRefs.current[i] = el }}
                  style={s({
                    position: 'absolute', bottom: 0, left: `${p.x}%`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    zIndex: isHero ? 30 : p.t === 'high' ? 6 : p.t === 'medium' ? 4 : 2,
                    transform: isHero ? 'translateY(-26px) scale(1.2)' : 'translateY(0) scale(1)',
                    filter: isDim ? 'opacity(0.13) saturate(0.15)' : 'none',
                    transition: 'transform .65s cubic-bezier(.34,1.3,.64,1), filter .5s ease',
                  })}
                >
                  <Silhouette color={clr(p.t, i)} scale={p.s} />
                </div>
              )
            })}
          </div>
        </div>

        {/* WAITLIST FORM */}
        <div style={s({ margin: '36px auto 0', maxWidth: 440, background: C.aged, border: `1px solid ${C.border}`, borderRadius: 3, padding: '24px 26px', textAlign: 'left' })}>
          {submitted ? (
            <div style={s({ textAlign: 'center', padding: '8px 0' })}>
              <p style={s({ fontFamily: 'Playfair Display, serif', fontSize: 18, color: C.ink, marginBottom: 6 })}>You're on the list.</p>
              <p style={s({ fontSize: 13, color: C.muted })}>We'll be in touch as soon as your event goes live on Sideroom.</p>
            </div>
          ) : (
            <>
              <p style={s({ fontFamily: 'Playfair Display, serif', fontSize: 17, color: C.ink, marginBottom: 4 })}>Get early access</p>
              <p style={s({ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 })}>Takes 2 seconds. We'll reach out with everything you need.</p>
              <input type="email" placeholder="Your work email" value={email} onChange={e => setEmail(e.target.value)}
                style={s({ width: '100%', fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: C.ink, background: C.parchment, border: `1px solid ${emailErr ? '#A33A2A' : C.border}`, borderRadius: 3, padding: '10px 12px', outline: 'none', marginBottom: 8, boxSizing: 'border-box' })} />
              {emailErr && <p style={s({ fontSize: 11, color: '#A33A2A', marginBottom: 8, marginTop: -4 })}>{emailErr}</p>}
              <input type="text" placeholder="Which conference are you attending?" value={conference} onChange={e => setConference(e.target.value)}
                style={s({ width: '100%', fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: C.ink, background: C.parchment, border: `1px solid ${confErr ? '#A33A2A' : C.border}`, borderRadius: 3, padding: '10px 12px', outline: 'none', marginBottom: 8, boxSizing: 'border-box' })} />
              {confErr && <p style={s({ fontSize: 11, color: '#A33A2A', marginBottom: 8, marginTop: -4 })}>{confErr}</p>}
              {apiErr  && <p style={s({ fontSize: 11, color: '#A33A2A', marginBottom: 8 })}>{apiErr}</p>}
              <button onClick={handleSubmit} disabled={loading}
                style={s({ width: '100%', marginTop: 10, fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 500, letterSpacing: '0.04em', background: loading ? C.muted : C.ink, color: C.parchment, border: 'none', borderRadius: 3, padding: 12, cursor: loading ? 'default' : 'pointer' })}>
                {loading ? 'Joining...' : 'Join the waitlist'}
              </button>
              <p style={s({ fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 10 })}>No spam. No password. Just a heads-up when your event goes live.</p>
            </>
          )}
        </div>

        <p style={s({ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, marginTop: 28, borderTop: `1px solid ${C.aged}`, paddingTop: 16 })}>
          <strong style={s({ color: C.ink, fontWeight: 500 })}>Live at select events</strong>
          {' '}&nbsp;·&nbsp;{' '}More coming soon{' '}&nbsp;·&nbsp;{' '}
          <strong style={s({ color: C.ink, fontWeight: 500 })}>Be part of the beta</strong>
        </p>
      </section>

      {/* FEATURES */}
      <section style={s({ background: C.aged, borderTop: `1px solid ${C.border}`, padding: '40px 40px 48px' })}>
        <div style={s({ textAlign: 'center', marginBottom: 24 })}>
          <p style={s({ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.muted, marginBottom: 6 })}>What's inside</p>
          <h2 style={s({ fontFamily: 'Playfair Display, serif', fontSize: 22, color: C.ink, marginBottom: 4 })}>Everything you need to own the room</h2>
          <p style={s({ fontSize: 13, color: C.muted })}>Live now — with more shipping every two weeks.</p>
        </div>
        <div style={s({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 740, margin: '0 auto' })}>
          {[
            { tag: 'Live now', live: true, title: 'Available today', items: [
              { n: 'AI attendee matching',  d: 'Ranked list of who to meet based on your goal' },
              { n: 'Conference briefing',   d: 'Speakers, themes and agenda in one page' },
              { n: 'Company intelligence',  d: 'Funding signals, hiring trends, news per exhibitor' },
              { n: 'Attendee profiles',     d: 'AI-enriched backgrounds on every person in the room' },
            ]},
            { tag: 'Coming soon', live: false, title: 'On the roadmap', items: [
              { n: 'CRM integration',         d: 'Sync matched contacts to HubSpot or Salesforce' },
              { n: 'Expected ROI calculator', d: 'Estimate pipeline value before buying your ticket' },
              { n: 'Event comparison',        d: 'Compare conferences side-by-side against your ICP' },
              { n: 'Side event intelligence', d: 'Dinners, happy hours and invite-only events nearby' },
              { n: 'Meeting scheduler',       d: 'Request meetings with matched attendees beforehand' },
              { n: 'Post-event debrief',      d: 'Track who you met, notes and follow-up actions' },
              { n: 'Team view',               d: 'See colleagues attending and split the room' },
              { n: 'Slack digest',            d: 'Daily briefing dropped into Slack before your event' },
            ]},
          ].map((box, bi) => (
            <div key={bi} style={s({ background: C.parchment, border: `1px solid ${C.border}`, borderRadius: 3, padding: '16px 18px' })}>
              <div style={s({ display: 'flex', alignItems: 'center', gap: 9, paddingBottom: 11, marginBottom: 12, borderBottom: `1px solid ${C.aged}` })}>
                <span style={s({ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 2, fontWeight: 500, background: box.live ? C.amber : C.aged, color: box.live ? C.parchment : C.muted, border: box.live ? 'none' : `1px solid ${C.border}` })}>{box.tag}</span>
                <span style={s({ fontFamily: 'Playfair Display, serif', fontSize: 14, color: C.ink })}>{box.title}</span>
              </div>
              {box.items.map((item, ii) => (
                <div key={ii} style={s({ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '5px 0', borderBottom: ii < box.items.length - 1 ? `1px solid ${C.aged}` : 'none' })}>
                  <span style={s({ width: 4, height: 4, borderRadius: '50%', background: box.live ? C.amber : C.border, flexShrink: 0, marginTop: 5, display: 'inline-block' })} />
                  <div>
                    <span style={s({ fontSize: 11, color: C.ink, fontWeight: 500 })}>{item.n}</span>
                    <span style={s({ display: 'block', fontSize: 10, color: C.muted, marginTop: 1 })}>{item.d}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={s({ borderTop: `1px solid ${C.border}`, padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' })}>
        <span style={s({ fontFamily: 'Playfair Display, serif', fontSize: 14, color: C.muted })}>sideroom</span>
        <span style={s({ fontSize: 11, color: C.border })}>© 2026 Sideroom. All rights reserved.</span>
      </footer>

    </main>
  )
}