# Development and Production Workflow

This repository uses a simple rule: local work is development, GitHub `master` is production.

## Environments

| Environment | Location | Purpose |
| --- | --- | --- |
| Development | `C:\Users\David\VS neo-geo-2` | Daily coding, experiments, local verification |
| Production source | `https://github.com/data540/neo-geo-2`, branch `master` | Canonical production code |
| Optional production mirror | `C:\Users\David\VS neo-geo-2-prod` | Read-only local copy of GitHub `master` |

## Golden Rules

- Do not work directly on `master` except for an emergency hotfix.
- Create a branch for every meaningful change, using `codex/<short-name>`.
- Run `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build` before merging to production.
- `pnpm lint` validates the production app surface; legacy maintenance scripts should be cleaned separately before adding them back to the production lint gate.
- Treat GitHub `master` as the only production truth.
- Keep local mirrors read-only. If a file needs editing, edit it in the development folder on a branch.
- Keep nested repo copies such as `neo-geo/` outside Git tracking in this repository.

## Daily Flow

```powershell
git switch master
git pull --ff-only origin master
pnpm workflow:new codex/my-change
pnpm dev
pnpm lint
pnpm exec tsc --noEmit
pnpm build
git push -u origin codex/my-change
```

Then open a Pull Request in GitHub and merge it into `master` only after review and checks.

## Production Mirror

Use the mirror only when you want a local read-only copy of production:

```powershell
pnpm prod:sync
```

The script clones `origin/master` into `C:\Users\David\VS neo-geo-2-prod` if it does not exist. If it already exists, it fast-forwards it to the latest GitHub `master`.

If the mirror has local edits, the script stops instead of overwriting them.

## Current Repo Note

The previous nested `neo-geo/` folder is intentionally ignored by the root repository. It can remain on disk as a local backup, but it should not be used as the production source or development source for this app.
