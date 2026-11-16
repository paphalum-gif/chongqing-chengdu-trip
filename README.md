# Trip Dashboard v2

Chongqing → Chengdu Trip Dashboard MVP.

## Files
- `index.html` — app shell
- `app.js` — trip UI and demo data
- `styles.css` — responsive styling
- `config.js` — Supabase URL + publishable/anon key
- `config.example.js` — config template
- `supabase.sql` — database, RLS, storage bucket, and realtime starter setup

## Supabase setup
1. Create a Supabase project.
2. Open SQL Editor.
3. Paste and run `supabase.sql`.
4. Open `config.js` and replace the two placeholders.
5. Deploy the folder to Netlify.

Do not put a Supabase service-role key in the browser. Use the publishable/anon key only.

The current UI still has demo/local data. The SQL schema is ready for the next integration step where `app.js` is switched from LocalStorage to Supabase reads/writes.
