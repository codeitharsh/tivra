export const runtime = 'edge'

import { createClient as createSB } from '@supabase/supabase-js'
import { sendEmailFireAndForget } from '@/lib/email'
import { isRateLimited, getClientIp, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit'

function adminSB() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const CONTACT_EMAIL = 'contact@tivra.in'
const CURRICULUM_SIGNED_URL_TTL_SECONDS = 300 // 5 minutes
// A genuine visitor submits this once per programme they're curious
// about — not ten times a minute. Guards the lead form (and the email
// it triggers) against spam.
const CURRICULUM_LEADS_LIMIT = { windowMs: 60 * 60 * 1000, max: 10 }

const VALID_STATUSES = ['student', 'graduate', 'working_professional'] as const
type CurrentStatus = typeof VALID_STATUSES[number]

interface LeadBody {
  program_slug?:     string
  full_name?:        string
  email?:            string
  phone?:            string
  college_name?:     string
  graduation_year?:  number | string
  current_status?:   string
}

export async function POST(req: Request): Promise<Response> {
  try {
    if (isRateLimited(`curriculum-leads:${getClientIp(req)}`, CURRICULUM_LEADS_LIMIT)) {
      return Response.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 })
    }

    const body = await req.json() as LeadBody

    const programSlug   = body.program_slug?.trim()
    const fullName       = body.full_name?.trim()
    const email          = body.email?.trim()
    const phone          = body.phone?.trim()
    const collegeName    = body.college_name?.trim() || null
    const currentStatus  = body.current_status as CurrentStatus | undefined
    const graduationYear = body.graduation_year ? Number(body.graduation_year) : null

    if (!programSlug) return Response.json({ error: 'Missing programme.' }, { status: 400 })
    if (!fullName)     return Response.json({ error: 'Full name is required.' }, { status: 400 })
    if (!email || !email.includes('@'))
      return Response.json({ error: 'A valid email address is required.' }, { status: 400 })
    if (!phone || phone.length < 7)
      return Response.json({ error: 'A valid phone number is required.' }, { status: 400 })
    if (!currentStatus || !VALID_STATUSES.includes(currentStatus))
      return Response.json({ error: 'Please select your current status.' }, { status: 400 })

    const sb = adminSB()

    const { data: programRow } = await sb
      .from('programs')
      .select('id, name, curriculum_url')
      .eq('slug', programSlug)
      .eq('is_active', true)
      .maybeSingle()

    if (!programRow) {
      return Response.json({ error: 'Programme not found.' }, { status: 404 })
    }
    const program = programRow as { id: string; name: string; curriculum_url: string | null }

    const { error: insertError } = await sb.from('curriculum_leads').insert({
      program_id:      program.id,
      full_name:       fullName,
      email,
      phone,
      college_name:    collegeName,
      graduation_year: graduationYear,
      current_status:  currentStatus,
    })

    if (insertError) {
      console.error('[curriculum-leads] Failed to record lead:', insertError.message)
      return Response.json({ error: 'Could not submit your details. Please try again.' }, { status: 500 })
    }

    // Notify the team. Awaited (not truly backgrounded) — on Cloudflare's
    // edge runtime the function can be torn down as soon as the handler
    // stops awaiting anything, silently killing the send partway through
    // (same reasoning as src/app/api/auth/register/route.ts). A failed
    // send here still doesn't fail the request — the lead is already
    // saved regardless of whether this notification goes through.
    await sendEmailFireAndForget({
      to:        CONTACT_EMAIL,
      subject:   `New curriculum lead — ${program.name}`,
      emailType: 'curriculum_lead',
      metadata:  { program_id: program.id, program_slug: programSlug },
      html: `
        <p>New curriculum download request for <strong>${escapeHtml(program.name)}</strong>:</p>
        <ul>
          <li><strong>Name:</strong> ${escapeHtml(fullName)}</li>
          <li><strong>Email:</strong> ${escapeHtml(email)}</li>
          <li><strong>Phone:</strong> ${escapeHtml(phone)}</li>
          <li><strong>College:</strong> ${escapeHtml(collegeName ?? '—')}</li>
          <li><strong>Graduation year:</strong> ${graduationYear ?? '—'}</li>
          <li><strong>Status:</strong> ${escapeHtml(currentStatus)}</li>
        </ul>
      `,
      text: `New curriculum download request for ${program.name}\nName: ${fullName}\nEmail: ${email}\nPhone: ${phone}\nCollege: ${collegeName ?? '-'}\nGraduation year: ${graduationYear ?? '-'}\nStatus: ${currentStatus}`,
    })

    // Curriculum PDF not uploaded yet — the lead is still captured, the
    // frontend shows a "we'll email it to you" message instead of a
    // broken download link.
    if (!program.curriculum_url) {
      return Response.json({ success: true, download_url: null })
    }

    const { data: signed, error: signError } = await sb.storage
      .from('curricula')
      .createSignedUrl(program.curriculum_url, CURRICULUM_SIGNED_URL_TTL_SECONDS)

    if (signError || !signed?.signedUrl) {
      console.error('[curriculum-leads] Could not create signed URL:', signError?.message)
      return Response.json({ success: true, download_url: null })
    }

    return Response.json({ success: true, download_url: signed.signedUrl })

  } catch (err) {
    console.error('[curriculum-leads] Unexpected error:', err)
    return Response.json({ error: 'Could not submit your details. Please try again.' }, { status: 500 })
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
