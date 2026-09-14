# TypeSense

TypeSense is a focused typing-practice app with two test modes and three passage sources:

- **Words** — complete a passage with a fixed word count.
- **Time** — type against a countdown.
- **Learn source** — practice passages that adapt to difficult words and two- or three-letter patterns.

Learn does not need an AI provider. It is available after sign-in so the adaptive profile can be kept with the account. Every signed-in Words or Time practice session contributes accuracy and key-timing observations to the server-held profile; Learn then uses those observations to choose future passages. Learning profiles are not cached in browser storage.

AI Create mode is optional. It supports Gemini or the OpenAI API through the server, so keys are never exposed to the browser.

## Run locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and set `JWT_SECRET`.
3. For a deployed app, set `DATABASE_URL` to a hosted PostgreSQL connection string. Supabase is supported through its standard Postgres connection string. Local development falls back to SQLite when this variable is absent.
4. To use AI Create, add either a Gemini key or an OpenAI API key and select the matching `AI_PROVIDER`.
5. Start both services with `npm start`.
6. Open <http://localhost:5173>.

Run all checks with `npm run check`.

## Project structure

```text
src/components/       Focused UI components
src/hooks/            Authentication, profile, and typing state
src/learn/            Adaptive scoring and local passage generation
src/lib/              Browser API client and session storage
src/styles/           Responsive visual system
src/utils/            Standard local passage generation
server/middleware/    Authentication and request limits
server/routes/        Auth, profile, and AI generation endpoints
server/services/      AI-provider integrations
test/                 Adaptive-learning tests
```

The database adapter supports hosted PostgreSQL for production and SQLite for local development. Numbered schema migrations create and update the account, learning-profile, and account-token tables without deleting existing data. Production deployments should run and monitor these migrations as a separate release step before starting new application code.

Account verification and password reset emails use Resend when `RESEND_API_KEY`, `EMAIL_FROM`, and `APP_URL` are configured. Existing accounts are marked verified by the schema migration. Local development without an email provider automatically verifies new accounts so the app remains testable. A later move to Supabase Auth can replace the custom password/JWT routes while keeping the PostgreSQL learning profiles.

## Learn mode model

Each completed signed-in practice session scores target words and overlapping letter pairs/triples. Mistakes and slower key transitions increase a pattern's exponentially smoothed difficulty; successful attempts reduce it. Learn passage generation favors the highest-weighted items while choosing roughly 28% of vocabulary without weighting, which keeps the system exploring for other weak spots. A new account is offered a one-minute baseline test before its first adaptive session.

Difficulty and confidence are separate. Difficulty estimates how challenging an item currently appears; confidence rises with repeated attempts and reaches the established threshold at roughly nine observations. Learn combines both values when weighting vocabulary, so one early mistake cannot permanently dominate the passage. The Progress view reports recent WPM and accuracy, compares early sessions with recent sessions, and shows the evidence behind each difficult item.

Default and Learn generation are both local but serve different purposes. Default draws randomly from larger noun, adjective, verb, adverb, and preposition banks and inserts those words into grammatical templates. Learn uses its adaptive vocabulary and the same kind of grammatical structure, but biases its choices toward difficult words and letter pairs/triples while retaining an exploration share for unfamiliar material. Create is the only source that calls an external AI provider.

The current profile format is deliberately small and explainable. It can later be extended with keyboard-hand/finger metadata, per-key latency distributions, and progress charts without changing the passage generator's public interface.
