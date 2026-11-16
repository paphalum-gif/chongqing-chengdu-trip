# Trip Dashboard v4 — UX + Supabase-ready

This version applies the UX review and adds real Supabase reads/writes for the core flow.

## UX
- Action-first Home
- Collapsed day itinerary
- Booking filters and one-tap status update
- Expense entry defaults to equal split
- Net settlement view
- Mobile bottom navigation
- Cloud status indicator

## Supabase
- `index.html` loads Supabase JS v2 from CDN.
- `config.js` holds Project URL + Publishable key.
- `supabase.sql` creates the matching schema and a `join_trip_by_code` RPC.
- Login uses Supabase Magic Link.
- First signed-in user can create the trip automatically.
- Booking and expense changes write to Supabase.
- Trip members can join by share code.

## Important
Use the Supabase Publishable key only in `config.js`. Never use a Secret key in browser code.

After changing config.js, deploy the folder to GitHub/Netlify.