import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'Content-Type': 'application/json' };

Deno.serve(async (request) => {
  const expectedSecret = Deno.env.get('CRON_SECRET');
  if (!expectedSecret || request.headers.get('x-cron-secret') !== expectedSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('REMINDER_FROM_EMAIL');
  if (!resendKey || !from) {
    return new Response(JSON.stringify({ error: 'Missing RESEND_API_KEY or REMINDER_FROM_EMAIL' }), { status: 500, headers: corsHeaders });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: plans, error } = await admin
    .from('planner_items')
    .select('id, user_id, title, notes, scheduled_at, reminder_at')
    .lte('reminder_at', new Date().toISOString())
    .is('reminder_sent_at', null)
    .eq('completed', false)
    .limit(100);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });

  let sent = 0;
  for (const plan of plans || []) {
    const { data: userResult, error: userError } = await admin.auth.admin.getUserById(plan.user_id);
    const email = userResult?.user?.email;
    if (userError || !email) continue;
    const schedule = new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Detroit' }).format(new Date(plan.scheduled_at));
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `Reminder: ${plan.title}`,
        text: `TrackApp reminder\n\n${plan.title}\nScheduled for: ${schedule}${plan.notes ? `\n\nNotes: ${plan.notes}` : ''}`,
      }),
    });
    if (!response.ok) continue;
    const { error: updateError } = await admin.from('planner_items').update({ reminder_sent_at: new Date().toISOString() }).eq('id', plan.id).is('reminder_sent_at', null);
    if (!updateError) sent += 1;
  }
  return new Response(JSON.stringify({ sent }), { status: 200, headers: corsHeaders });
});
