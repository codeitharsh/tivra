// Shared ambient declaration for the Razorpay checkout.js global,
// loaded dynamically via a <script> tag (see payment/page.tsx and
// CourseCheckout.tsx). Kept in one place because TypeScript requires
// every declaration of the same global interface member to resolve to
// an identical type, not just a structurally-equal one — two files each
// declaring their own `declare global { interface Window ... }` for
// the same property is a compile error even with identical shapes.
export interface RazorpayOptions {
  key:         string
  amount:      number
  currency:    string
  name:        string
  description: string
  image?:      string
  order_id:    string
  handler:     (res: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void
  prefill?:    { name?: string; email?: string; contact?: string }
  theme?:      { color?: string }
  modal?:      { ondismiss?: () => void }
}

export interface RazorpayInstance { open(): void }

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance
  }
}
