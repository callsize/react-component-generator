# PR Body Template (English)

Used by the `create-pr` skill when `--lang en`.
Replace each `<...>` with real content and remove the guidance text. Do not delete items that do not apply; write `N/A` instead.

## Template

```markdown
## Summary

<What this PR changes and why, in 1-3 sentences>

## Changes

- <Change 1>
- <Change 2>

## Type of Change

- [ ] feat: new feature
- [ ] fix: bug fix
- [ ] refactor: restructuring without behavior change
- [ ] chore: config, dependencies, build, docs

## Testing

- [ ] `bun run test` passes
- [ ] `bun run lint` passes
- [ ] `bun run build` passes
- Tests added/updated: <file or N/A>

## Screenshots / Verification

<Screenshots or how to verify for UI changes, otherwise N/A>

## Notes for Reviewers

<Areas to focus on, trade-offs, known limitations. N/A if none>

## Related Issues

<Closes #number or N/A>
```

## Writing Rules

- Check a box (`[x]`) **only for items you actually ran and confirmed**. If something was not run, leave it `[ ]` and explain why in Notes for Reviewers.
- Check exactly one change type. If several are mixed, pick the dominant one and describe the rest under Changes.
- Describe changes by behavior, not as a list of files.
- Keep code identifiers, file names, and commands verbatim.
- Do not use emojis.
