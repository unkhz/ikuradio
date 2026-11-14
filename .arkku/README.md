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

## Shared and local

`templates/`, `sequences/` and this README are shared: they shape the public records.
`configs/` is ignored, because Git and auth policy hold each developer's own identity,
secret store and paths. Create them with `arkku git init` and `arkku auth setup`, and keep
the project ID `song-that-never-ends`.

## One place to sing

The song is built and run from a single authoritative checkout, by one session at a
time. A dev box has room for only one mind, so never build or run the song from a second
checkout or session while another is using it. How a developer reaches their own dev box
is local, and belongs in `private/`.

## Issues

The loop never stops to ask. An open question or a problem is written down as an issue
record, and the loop carries on; issues are talked through in conversation instead.

```sh
arkku record create issue --slug <slug> --title "<the question or problem>"
```

It lands in `issues/todo/<id>-<slug>.md`. Once it has been answered or solved:

```sh
arkku meta set issue:<slug> state done
arkku record reconcile issue:<slug>
```

The state is the folder, so reconciling moves it to `issues/done/`.

This file belongs to the project. Adapt it with project-specific guidance as
needed; subsequent `arkku init` calls will not overwrite it or other instructions.
