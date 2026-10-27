# Rasoi — recipe book

A private recipe book that works on phone, tablet and computer, and installs like an app.

- **Recipes in parts.** A pizza is Base dough + Pizza sauce + Cheese sauce + Toppings. Each
  part has its own ingredients and numbered steps.
- **Base recipes.** Save a sauce or dough once ("This is a base recipe"), then use it as a part
  of any number of dishes. Editing it updates every dish that uses it.
- **Veg / non-veg.** Every ingredient is marked Veg or Non-veg (Indian green-dot / brown-triangle
  marks; eggs count as non-veg). Recipes are never marked by hand: they are worked out from their
  ingredients and any base recipes they use, with the reason shown ("Chicken in Toppings").
  Filters on the recipe list and the library.
- **Variants.** "Make a variant" copies a recipe so you can change it into a new one.
- **Ingredient library.** About 1,050 ingredients, most with photos, in 16 categories.
  Ingredients are picked by search ("tom" → Tomato). Anything missing can be added on the spot,
  with your own photo.
- **Photos.** A cover photo per recipe and a photo per ingredient, from the camera or gallery,
  resized on the phone before upload, or **Find online**: searches TheMealDB, Wikimedia
  Commons and Openverse (plus Pexels with `PEXELS_API_KEY`) by the name typed, and saves the
  picked photo as the app's own copy.
- **Installable + offline.** Add to Home Screen on Android/iPhone, or install from Chrome/Edge
  on a computer. Recently opened recipes stay readable without internet.

## Stack

Next.js 15 (App Router) · React 19 · Tailwind 4 · Prisma 6 · Postgres (Supabase) · Vercel.
One login; JWT session (jose) in a cookie, or a Bearer token for a native shell.

### Built to be wrapped later (Tauri / Capacitor)

- Every screen is a client-rendered static page that talks to the JSON API under `/api/*`
  (`src/lib/api-client.ts`). Detail pages use query strings (`/recipe?id=…`), not dynamic
  routes, so the UI can be exported as static files.
- The API accepts `Authorization: Bearer <token>`; sign-in returns the token.
- For a native build: set `NEXT_PUBLIC_API_BASE` to the deployed URL, add `output: "export"`
  for the UI build, and allow that shell's origin with CORS on `/api/*`.

## Run locally

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL, DIRECT_URL, AUTH_SECRET
npx prisma db push
npm run dev
```

Open http://localhost:3000. The first visit asks you to create the login and fills the
ingredient library.

No Postgres on this machine? Copy `prisma/schema.prisma` to `prisma/dev-sqlite/` with
`provider = "sqlite"` (and no `directUrl`), run `prisma db push` + `prisma generate` against
that copy with `DATABASE_URL="file:./dev.db"`, and run `npx prisma generate` again
afterwards so the Postgres client is back before building.

### Upgrading an existing database

A library created before Veg / Non-veg existed needs one run after `prisma db push`:
`npx tsx scripts/backfill-diet.ts`. A fresh setup does not.

## Tests

`npm test`: search ranking, step parsing, image sniffing, link-loop detection, payload
validation, redirect safety, and a sanity check of the seeded library.

## Deploy (Vercel + Supabase)

1. Create a Supabase project (Mumbai). Copy the **Transaction pooler** URL (port 6543, add
   `?pgbouncer=true&connection_limit=1&sslmode=require`) as `DATABASE_URL` and the **Session
   pooler** URL (port 5432) as `DIRECT_URL`.
2. Put them and a fresh `AUTH_SECRET` in `.env`, then `npm run check:env` and
   `npx prisma db push`.
3. Run `prisma/supabase-lockdown.sql` in the Supabase SQL editor.
4. Import the GitHub repo into Vercel. Set `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET` and
   `TRUST_PROXY_HEADER=true` in its Environment Variables. Deploy.
5. Open the site and create the login.

## Where things are

| Path | What |
| --- | --- |
| `prisma/schema.prisma` | Recipe → RecipeSection (parts, optional linked base recipe) → SectionItem → Ingredient; Image holds uploaded photos |
| `prisma/ingredients.json` | The seeded library (TheMealDB's ingredient list + Indian staples), loaded at first-run setup |
| `src/lib/recipes.ts` | Load / save / duplicate / delete recipes, loop and reference checks |
| `src/lib/schemas.ts` | Every API request body and its rules |
| `src/app/api/` | The JSON API |
| `src/app/(app)/` | The screens |
| `public/sw.js` | Service worker: install + offline |

Seeded ingredient photos are loaded from themealdb.com. Replace any of them with your own
photo from the Ingredients page.
