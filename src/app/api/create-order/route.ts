export const runtime = 'edge'

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json() as { plan?: string }
    const plan = body.plan ?? 'cloud_launchpad'

    const PLANS: Record<string, { amount: number; label: string }> = {
      cloud_launchpad: { amount: 699900,  label: 'Cloud LaunchPad'             },
      cloud_architect: { amount: 999900,  label: 'Cloud Architect'             },
      bundle:          { amount: 1499900, label: 'Cloud LaunchPad + Architect' },
    }

    if (!PLANS[plan]) {
      return Response.json({ error: `Invalid plan: ${plan}` }, { status: 400 })
    }

    const { amount, label } = PLANS[plan]

    const keyId     = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET

    if (!keyId || !keySecret) {
      return Response.json(
        { error: 'Payment not configured — add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to environment variables' },
        { status: 500 }
      )
    }

    // btoa works on edge runtime (Cloudflare) — Buffer is Node.js only
    const auth    = btoa(`${keyId}:${keySecret}`)
    const receipt = `tivra_${Date.now()}`

    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount,
        currency: 'INR',
        receipt,
        notes: { plan, plan_label: label },
      }),
    })

    const data = await rzpRes.json() as {
      id?:     string
      amount?: number
      error?:  { description?: string }
    }

    if (!rzpRes.ok || !data.id) {
      const msg = data.error?.description ?? `Razorpay error (HTTP ${rzpRes.status})`
      return Response.json({ error: msg }, { status: 502 })
    }

    return Response.json({
      order_id:   data.id,
      amount:     data.amount,
      currency:   'INR',
      plan,
      plan_label: label,
    })

  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
