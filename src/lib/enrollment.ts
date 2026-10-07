// Single source of truth for whether new enrollments/payments are accepted.
// Flipped false as part of the self-paced platform go-live cutover —
// existing enrolled_programs students keep full access to their
// programme (content/tests/assessments/certificate, teacher/admin tools)
// unchanged; this only closes new programme signups/payments, steering
// that traffic toward /explore instead. Flip back to true to reopen
// programme sales — the backend (create-order/verify-payment) was never
// touched, so this is a one-line revert either direction.
export const ENROLLMENT_OPEN = false
