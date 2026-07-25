// Shared fallback FAQ set for programme landing pages that don't have
// a per-programme override in `programs.faqs`. These are platform-wide
// policies true of every programme (retake policy, certificate
// issuance, live-class format) — not specific curriculum claims.
export const DEFAULT_PROGRAM_FAQS: { q: string; a: string }[] = [
  { q: 'Who is this for?', a: 'Engineering students, freshers, and career-switchers. No prior experience in this domain is needed.' },
  { q: 'What certification will I get?', a: "You'll receive a verified Tivra certificate on successfully completing the programme, with a unique public verification URL." },
  { q: 'Are classes live or recorded?', a: 'Live weekly sessions, all recorded and available for replay on the platform.' },
  { q: 'What if I fail an assessment?', a: 'You can retake after a 24-hour cooldown. No limit on retakes.' },
  { q: 'Is it self-paced?', a: 'Study notes and recordings are self-paced. Live classes run on a weekly schedule.' },
]
