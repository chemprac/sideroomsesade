import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

export async function POST(req: NextRequest) {
  const { email, conference } = await req.json()

  if (!email || !email.includes('@') || !isWorkEmail(email)) {
    return NextResponse.json({ error: 'Please use your work email address.' }, { status: 400 })
  }

  if (!conference || conference.trim().length < 2) {
    return NextResponse.json({ error: 'Please tell us which conference you are attending.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('waitlist')
    .insert({ email: email.trim().toLowerCase(), conference: conference.trim() })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'This email is already on the waitlist.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
