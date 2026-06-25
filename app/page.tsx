'use client'

import { useState } from 'react'
import { SideroomLogo } from '@/components/SideroomLogo'
import { ConferenceFlowAnimation } from '@/components/ConferenceFlowAnimation'

const BLOCKED_DOMAINS = ['gmail','yahoo','hotmail','outlook','icloud','aol','protonmail','mail','ymail','googlemail','live','msn','me']
function isWorkEmail(email: string) {
  const domain = (email.split('@')[1] || '')
  return !BLOCKED_DOMAINS.includes(domain.split('.')[0].toLowerCase())
}

const C = {
  parchment: '#F5F0E6', ink: '#1C1208', amber: '#C4842A',
  border: '#C4B89A', muted: '#8B7D5A', aged: '#EDE5D0',
}

type Style = React.CSSProperties
const s = (obj: Style): Style => obj

export default function HomePage() {
  const [email, setEmail]             = useState('')
  const [conference, setConference]   = useState('')
  const [emailErr, setEmailErr]       = useState('')
  const [confErr, setConfErr]         = useState('')
  const [apiErr, setApiErr]           = useState('')
  const [loading, setLoading]         = useState(false)
  const [submitted, setSubmitted]     = useState(false)

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

  return (
    <main style={s({ background: C.parchment, minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' })}>

      {/* NAV */}
      <nav style={s({ borderBottom: `1px solid ${C.border}`, padding: '18px 40px' })}>
        <SideroomLogo href="/" />
      </nav>

      {/* HERO */}
      <section style={s({ padding: '52px 40px 48px', textAlign: 'center', borderBottom: `1px solid ${C.aged}` })}>
        <p style={s({ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.muted, marginBottom: 14 })}>Conference intelligence</p>
        <h1 style={s({ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(24px,3.5vw,38px)', fontWeight: 600, color: C.ink, lineHeight: 1.22, marginBottom: 12 })}>
          You're about to walk into a room<br />of 4,000 people.
        </h1>
        <p style={s({ fontSize: 15, color: C.muted, lineHeight: 1.75, marginBottom: 44 })}>
          Sideroom tells you exactly who matters, and what matters to them, before you walk in.
        </p>

        <ConferenceFlowAnimation />

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
        <SideroomLogo href="/" muted />
        <span style={s({ fontSize: 11, color: C.border })}>© 2026 Sideroom. All rights reserved.</span>
      </footer>

    </main>
  )
}