# Grantly AI — Engineering Conventions

## Project Architecture & Rules

- Grantly core code lives in `src/grantly/` (pages, components, services, types); route files in `src/routes/` are thin declarative TanStack Start route wrappers.
- Pages import routing helpers from `@/lib/router-compat` (react-router-style API over TanStack Router); never add react-router-dom.
- Database records are stored in Supabase PostgreSQL (`profiles`, `scholarships`, `applications`, `saved_scholarships`, `documents`, `reports`) with top-level relational columns alongside a `data` JSONB column for seamless backward compatibility.
- Private document uploads reside in Supabase Storage under bucket `documents`.
- AI calls run exclusively in `src/grantly/ai/*.functions.ts` server functions via `@google/genai` using model `gemini-3.8-flash`. `GEMINI_API_KEY` is kept strictly server-side.
- Signed-in app routes use `ssr: false` where pages interact with browser storage during render.
