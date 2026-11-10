# Arkku in this project

Run `arkku guide` for the concepts, template API, examples, and editing rules that
match the installed runtime. Run `arkku --help` for command syntax.

- `templates/<kind>.ts` defines each project-owned record kind: stored fields,
  filename, Markdown creation, live meta derivation, and validation.
- Records live at the paths chosen by those modules, not necessarily here.
  Read a record and its live meta with `arkku record read <kind>:<slug> --json`.
- `sequences/` is created as records are allocated. Keep its counters, the kind
  modules, this README, and the records in version control.

Follow the project's working instructions for when to create records, what states
mean, and what counts as complete. Arkku does not choose that workflow.
Before adding a kind, inspect existing modules and use `arkku template schema <kind>`
to understand their fields. If a new kind is needed, use `arkku template create <kind>`
and adapt its module before creating records.

Edit Markdown prose directly; use `arkku meta set` / `arkku meta unset` for stored
fields. Re-read a record with `arkku record read` after editing its Markdown to run
validation and see fresh meta. Preserve `id`, `kind`, and `slug`; edit the leading
`# Heading` to change the title. Derived fields are read-only, not extra frontmatter.

After changing filename rules or adding an explicit reconciliation hook, use
`arkku record reconcile <file|ref> --dry-run` to review the proposed paths and bodies,
then omit `--dry-run` to apply. It never recreates records from pristine templates.

Template modules are executable project code, including during reads and schema
inspection. Review unfamiliar modules and their imports before running them.

## The dev box

The song is built and run on one machine only, `xitra.local` (RTX 4070 Ti, 12 GB).
It has room for a single mind at a time, so there is one authoritative place for it:

- Git lives on the main machine, in the arkku workspace `xitra`
  (`arkku workspace status xitra`). Commit there. Fetch and push only with
  `arkku git run xitra main -- …` inside `arkku session open`.
- `~/Work/song` on xitra is a plain copy with no Git and no credentials. Reach it as
  `ssh xitra-song`. Sync tracked files from the `xitra` workspace with rsync,
  excluding everything Git ignores, so the song's audio, diary, `node_modules` and
  builds on xitra are never overwritten.
- Only one session drives xitra at a time. Do not build or run the song from any
  other checkout or session while another one is using it.

This file belongs to the project. Adapt it with project-specific guidance as
needed; subsequent `arkku init` calls will not overwrite it or other instructions.
