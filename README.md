# Project Archive Companion

/skill:migrate-external-project Source: code archive. Migrate the attached project into Lovable.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9967c667-9e31-46ed-9167-f3930ff2bd72).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Vercel deployment

This app uses TanStack Start and Nitro server output; it is not a static Vite SPA.
In Vercel, set the project root to the directory containing `package.json` and use
`npm run build`. Nitro generates the Vercel Build Output API bundle in
`.vercel/output`; do not override it with a static output directory such as `dist`
or add an `/index.html` rewrite.

In Supabase Auth URL Configuration, set the production Site URL and allow the
production origin plus `/onboarding` and `/reset-password` as redirect URLs. The
Google sign-in flow returns to the production origin.
