<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Migrated Grantly app code lives in `src/grantly/` (pages, components, services, types); route files in `src/routes/` are thin wrappers. Why: keeps the imported app intact and routes declarative.
- Pages import routing helpers from `@/lib/router-compat` (react-router-style API over TanStack Router); never add react-router-dom. Why: TanStack Router is the only router.
- Cloud tables store app records as a `data` jsonb column keyed by user/id, mirroring the original document shapes. Why: preserves the source data model without per-field rewrites.
- AI calls run only in `src/grantly/ai/*.functions.ts` server functions via the Lovable AI Gateway. Why: keeps keys server-side; folders named `server/` are blocked from client imports.
- Signed-in app routes use `ssr: false` because pages read browser storage during render. Why: avoids hydration mismatches.
- tsconfig relaxes exactOptionalPropertyTypes / noUncheckedIndexedAccess / noPropertyAccessFromIndexSignature / noImplicitReturns to match the imported code. Why: the source was written without them.
