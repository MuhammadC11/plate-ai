# Plate AI

Photograph a meal, get calories and macros. Like Cal AI, but free to run and open about where its numbers come from.

Built with Expo (React Native) and Supabase. Runs on your phone through the free Expo Go app — no Xcode, no Apple Developer account, no App Store fee.

---

## How it estimates calories

Most photo calorie apps ask a vision model "how many calories is this?" and print the answer. Vision models are good at recognising food and judging size, and bad at recalling exact nutrition figures, so that single question mixes a strength with a weakness. It's the main reason accuracy falls apart on mixed and homemade dishes.

Plate AI splits the job in two:

1. **Gemini looks at the photo** and answers only what vision can answer: which foods are present, and roughly how many grams of each. It is explicitly prompted to account for things it can't see directly — cooking oil, butter, dressings, sauces — because that hidden fat is where photo estimates most often go wrong. It also returns a confidence score per item.

2. **USDA FoodData Central supplies the nutrition.** Each identified food is looked up in the US government's food composition database, and its real per-100g values are scaled to the estimated portion. This is the same public-domain data most commercial nutrition apps license.

When no confident database match exists — which is common for mixed dishes like a curry or a casserole — the app falls back to the model's own estimate and **tags that item `EST` in the interface**. You always know which numbers are database-backed and which are guesses.

The remaining source of error is portion weight, and that is the one thing you can see and correct. Every item has a gram field you can edit; macros rescale as you change it.

### Deliberate design choices

- **A wrong match is worse than no match.** A confident-looking number that's off by 3x is more harmful than a number labelled as an estimate. The matcher rejects weak matches rather than accepting the best available one.
- **Preparation state is enforced.** Cooking moves water in and out of food, so per-100g density changes enormously. Dry lentils are 219 kcal/100g; cooked, they're 116. A query for a cooked food will never match a record that says raw or dry.
- **Branded records are a last resort.** Packaged-product entries usually describe food as sold, not as eaten, so branded "LENTILS" means the dry bag. They're only used when the generic datasets return nothing and the description matches almost exactly.
- **A failed lookup is not an empty lookup.** If the USDA request errors out, the app does not quietly search a different dataset. It falls back to the model estimate instead.

---

## What it costs

Nothing, at personal-use volume.

| Service | Free tier | What you'd use |
| --- | --- | --- |
| Expo Go | Free, unlimited | Running the app on your phone |
| Supabase | 500MB database, 1GB file storage, 500K Edge Function calls/month | A few KB per meal, ~100KB per photo |
| Gemini API | ~1,500 requests/day on Flash models | One request per photo |
| USDA FoodData Central | 1,000 requests/hour | A handful per photo |

The only thing that costs money is publishing to an app store ($99/year Apple, $25 once for Google), and you don't need that to use this yourself.

Two caveats worth knowing. Gemini's free tier permits Google to use your prompts to improve their products, so your meal photos are not private in the way a paid tier would be. And free-tier quotas are set per Google Cloud project and can change — check your live limits in [AI Studio](https://aistudio.google.com/) rather than trusting any number written down.

---

## Setup

Roughly 20 minutes, most of it waiting on signups.

### 1. Install the app runner on your phone

Install **Expo Go** from the App Store or Play Store. This is what runs your app during development — you'll scan a QR code and your app opens inside it.

### 2. Create a Supabase project

Sign up at [supabase.com](https://supabase.com) and create a new project. Note your project's **Project URL** and **anon public key** from Project Settings → API.

Then open the **SQL Editor**, paste in the entire contents of [`supabase/schema.sql`](supabase/schema.sql), and run it. This creates the tables, the photo storage bucket, and the Row Level Security policies that ensure each user can only read their own data.

### 3. Get a Gemini API key

Go to [aistudio.google.com](https://aistudio.google.com/), create an API key, and copy it.

If you get `429` errors with `limit: 0` later, your project's free-tier quota isn't active. Google now requires a billing account to be *linked* to the project even for free-tier usage — linking it does not mean you get charged, but without it the free quota reads as zero.

### 4. Get a USDA FoodData Central key

Sign up at [api.data.gov/signup](https://api.data.gov/signup). It's a single form, no payment, and the key arrives by email within a few minutes.

The app runs without this key, but every item will be a model estimate rather than a database lookup, which is a real accuracy loss.

### 5. Configure the app

```bash
cd plate-ai
npm install
cp .env.example .env
```

Edit `.env` and fill in your Supabase URL and anon key. Note that only the Supabase values go here — your Gemini and USDA keys are deliberately **not** in the app, because anything in `.env` gets compiled into the JavaScript bundle and could be extracted from the app. Those two keys live on the server instead, which is the next step.

### 6. Deploy the Edge Function

This is the server-side piece that holds your API keys and does the Gemini and USDA calls.

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase secrets set GEMINI_API_KEY=your-gemini-key USDA_API_KEY=your-usda-key
npx supabase functions deploy analyze-meal
```

Your project ref is the subdomain in your Supabase URL: for `https://abcdefgh.supabase.co`, it's `abcdefgh`.

### 7. Run it

```bash
npm start
```

Scan the QR code with your iPhone camera (or the Expo Go app on Android). The app opens on your phone. Create an account, set your goals, and photograph something.

If you change `.env`, restart with `npx expo start -c` to clear the cache — Expo bakes those values in at bundle time and won't pick up edits otherwise.

---

## Using it well

The portion estimate is the largest source of error, and photo framing drives it directly.

- **Fill the frame with the plate** and shoot from a slight angle rather than straight down. A top-down photo shows area but hides depth, and depth is most of the volume.
- **Leave a known object in frame** when you can. A fork, a standard mug, or your hand gives the model a reliable scale reference.
- **Use the re-analyze box for anything it can't see.** If it's basmati cooked in ghee, or the curry has coconut milk in it, type that in and analyze again. This is the single highest-leverage correction for exactly the homemade and mixed-dish cases where photo estimation is weakest.
- **Sanity-check anything tagged `EST`.** Those items had no database match and are the model's own arithmetic.

---

## Project layout

```
app/                          Screens (expo-router: files map to routes)
  (tabs)/index.tsx            Today's dashboard
  (tabs)/history.tsx          Past days, grouped and totalled
  (tabs)/settings.tsx         Daily goals, account
  scan.tsx                    Camera
  review.tsx                  Analysis result, portion editing, save
  meal/[id].tsx               A saved meal
src/
  api/analyze.ts              Compresses the photo, calls the Edge Function
  api/meals.ts                Database reads and writes
  components/                 UI pieces
  lib/                        Supabase client, auth, nutrition maths, theme
supabase/
  schema.sql                  Tables, RLS policies, storage bucket
  functions/analyze-meal/     The Edge Function
    index.ts                  Request handling, combining both sources
    gemini.ts                 Vision prompt and call
    usda.ts                   Food matching and nutrition lookup
scripts/                      Tests for the food matching logic
```

## Commands

```bash
npm start              # Run the app (scan the QR with Expo Go)
npm run typecheck      # TypeScript check
npm run test:usda      # Food-matching regression tests, no network needed
FDC_KEY=xxx npm run check:usda   # Sanity-check matching against the live USDA API
```

`npm run test:usda` is worth running if you touch `usda.ts`. Each case in it corresponds to a wrong answer the matcher produced at some point — matching cooked rice to a dry branded product, matching roasted chicken to a raw record, accepting "chicken roll" for "chicken tikka masala".

## Troubleshooting

**`limit: 0` or 429 from Gemini.** Free-tier quota isn't active on your Google Cloud project. Link a billing account to the project in AI Studio; the free tier stays free.

**Everything is tagged `EST`.** The USDA key isn't reaching the Edge Function. Re-run the `secrets set` command and redeploy, then check the function logs in the Supabase dashboard.

**Camera screen is black in Expo Go.** Grant camera permission in iOS Settings → Expo Go, then reopen.

**Sign-in does nothing.** Check that `.env` is filled in and restart with `npx expo start -c`. Supabase also requires email confirmation by default — either confirm via the emailed link, or turn confirmation off in Authentication → Providers → Email while developing.

**Changes to `.env` have no effect.** Restart with `npx expo start -c`.
