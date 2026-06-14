export const runtime = 'edge'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSB } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function POST(req: Request): Promise<Response> {
  try {
    const { email, password, full_name, phone } = await req.json() as Record<string,string>
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll() }, setAll(c) { c.forEach(({ name,value,options }) => cookieStore.set(name,value,options)) } } }
    )
    const sb = createSB(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password, options: { data: { full_name } } })
    if (authError) return Response.json({ error: authError.message.includes('already') ? 'Email already registered. Please sign in.' : authError.message }, { status: 400 })
    if (!authData.user) return Response.json({ error: 'Could not create account.' }, { status: 500 })
    await sb.from('profiles').upsert({ id: authData.user.id, email, full_name, phone: phone||null, role:'student', access_status:'pending_payment' }, { onConflict:'id' })
    return Response.json({ success: true })
  } catch (e) { return Response.json({ error: String(e) }, { status: 500 }) }
}
