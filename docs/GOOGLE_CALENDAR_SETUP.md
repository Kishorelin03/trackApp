# Google Calendar Automatic Sync Setup

This setup lets users connect their Google account once. Planner items created, edited, or deleted in TrackApp then sync with their Google Calendar.

## 1. Create a Google Cloud project

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project selector at the top, then **New Project**.
3. Name it `TrackApp Calendar` and click **Create**.
4. Select the new project.

## 2. Enable Google Calendar API

1. Open **APIs & Services → Library**.
2. Search for **Google Calendar API**.
3. Open it and click **Enable**.

## 3. Configure the Google consent screen

1. Open **Google Auth Platform → Branding**.
2. Click **Get started**.
3. Enter:
   - App name: `TrackApp`
   - User support email: your email
   - Audience: **External**
   - Contact email: your email
4. Accept the policy and click **Create**.
5. Open **Google Auth Platform → Audience** and add your Gmail address under **Test users**.

## 4. Add the Calendar permission

1. Open **Google Auth Platform → Data Access**.
2. Click **Add or Remove Scopes**.
3. Add:

```text
https://www.googleapis.com/auth/calendar.events
```

This permits TrackApp to create, update, and delete calendar events.

## 5. Create OAuth credentials

1. Open **Google Auth Platform → Clients**.
2. Click **Create Client**.
3. Choose **Web application** and name it `TrackApp Calendar Sync`.
4. Under **Authorized JavaScript origins**, add:

```text
http://localhost:5500
```

Also add your hosted TrackApp URL when available, for example:

```text
https://your-trackapp-site.netlify.app
```

5. Under **Authorized redirect URIs**, add this exact address:

```text
https://bqpetankeqnphvueeyty.supabase.co/functions/v1/google-calendar
```

6. Click **Create**. Copy the Client ID and Client Secret temporarily. Never put them in GitHub, `supabase-config.js`, or a chat message.

## 6. Store Google credentials in Supabase

From the TrackApp project terminal, run:

```bash
npx supabase secrets set \
  GOOGLE_CLIENT_ID="paste-client-id-here" \
  GOOGLE_CLIENT_SECRET="paste-client-secret-here" \
  APP_URL="http://localhost:5500"
```

Confirm only the secret names:

```bash
npx supabase secrets list
```

When TrackApp is hosted, update `APP_URL`:

```bash
npx supabase secrets set APP_URL="https://your-trackapp-site.netlify.app"
```

## 7. Add the required database tables

In Supabase Dashboard → **SQL Editor**, run the final block in `supabase-schema.sql` labelled:

```text
Google Calendar connection and event mapping
```

## 8. Deploy the secure calendar function

From the project terminal:

```bash
npx supabase functions deploy google-calendar --no-verify-jwt
```

## 9. Connect a Google Calendar

1. Refresh TrackApp.
2. Open **Planner**.
3. Click **Connect Google Calendar**.
4. Sign in to Google and click **Allow**.

New Planner items will then sync automatically to the connected Google Calendar.
