import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL')!;
const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
const appUrl = Deno.env.get('APP_URL')!;
const callback = `${url}/functions/v1/google-calendar`;
const corsHeaders = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });
const admin = createClient(url, service, { auth: { persistSession: false } });
async function currentUser(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  return (await createClient(url, anon).auth.getUser(token)).data.user;
}
async function accessToken(refresh_token: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token, grant_type: 'refresh_token' }) });
  return response.ok ? (await response.json()).access_token as string : null;
}
Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code'), state = requestUrl.searchParams.get('state');
  if (code && state) {
    const { data: record } = await admin.from('google_oauth_states').select('*').eq('state', state).gt('expires_at', new Date().toISOString()).maybeSingle();
    if (!record) return new Response('Google connection expired. Please return to TrackApp and try again.', { status: 400 });
    const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: callback, grant_type: 'authorization_code' }) });
    const tokens = await response.json();
    if (!response.ok || !tokens.refresh_token) return new Response('Google did not return a refresh token. Remove TrackApp from Google Account permissions and connect again.', { status: 400 });
    await admin.from('google_calendar_connections').upsert({ user_id: record.user_id, refresh_token: tokens.refresh_token });
    await admin.from('google_oauth_states').delete().eq('state', state);
    return Response.redirect(`${appUrl}?googleCalendar=connected`, 302);
  }
  const user = await currentUser(request);
  if (!user) return json({ error: 'Unauthorized' }, 401);
  const { action, plannerItemId } = await request.json();
  if (action === 'connect') {
    const state = crypto.randomUUID();
    await admin.from('google_oauth_states').insert({ state, user_id: user.id, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
    const params = new URLSearchParams({ client_id: clientId, redirect_uri: callback, response_type: 'code', access_type: 'offline', prompt: 'consent', scope: 'https://www.googleapis.com/auth/calendar.events', state });
    return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  }
  const { data: connection } = await admin.from('google_calendar_connections').select('*').eq('user_id', user.id).maybeSingle();
  if (!connection) return json({ error: 'Connect Google Calendar first.' }, 400);
  const { data: item } = await admin.from('planner_items').select('*').eq('id', plannerItemId).eq('user_id', user.id).maybeSingle();
  if (!item) return json({ error: 'Planner item not found.' }, 404);
  const token = await accessToken(connection.refresh_token); if (!token) return json({ error: 'Google connection expired. Connect again.' }, 401);
  const endpoint = `https://www.googleapis.com/calendar/v3/calendars/${connection.calendar_id}/events`;
  if (action === 'delete' && item.google_event_id) await fetch(`${endpoint}/${item.google_event_id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  if (action === 'upsert') {
    const event = { summary: item.title, description: item.notes, start: { dateTime: item.scheduled_at }, end: { dateTime: new Date(new Date(item.scheduled_at).getTime() + 3600000).toISOString() } };
    const response = await fetch(item.google_event_id ? `${endpoint}/${item.google_event_id}` : endpoint, { method: item.google_event_id ? 'PUT' : 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(event) });
    const googleEvent = await response.json(); if (response.ok) await admin.from('planner_items').update({ google_event_id: googleEvent.id }).eq('id', item.id);
  }
  return json({ ok: true });
});
