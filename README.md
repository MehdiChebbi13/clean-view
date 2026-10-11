# Clean View

A Claude Code mod that hides the noise while Claude works (tool calls, terminal output, file contents, diffs) and shows a calm panel above the prompt instead:

```
● Working · step 2 of 3 · 1 done, 2 left  ▓▓▓░░░░░░░ 33%
✓ Read the notebooks
▶ Writing chapter 3
○ Verify the code
```

- **Plan**: Claude's own task list (TodoWrite / tasks), as a checklist.
- **Current step**: the step in progress, in bold. With no list, what Claude is doing right now (`▶ Running a command`).
- **Progress**: step number, done / left, and a progress bar.
- **Status**: `● Working`, `◆ Waiting for your input` (permission prompts, questions), `✓ Finished`.

Claude's written messages stay in the transcript. A failed or interrupted tool call shows as one dim line (`✗ Bash failed`).

## Install

In a Claude Code terminal session:

```
/plugin install clean-view --marketplace MehdiChebbi13/clean-view
```

Answer `y` to add the marketplace, then pick a scope (user scope = every session). It is active right away, and also in the desktop app's Code tab once installed at the user scope.

## Use

- `/clean-view` switches it off (full transcript back) and on again; the choice is remembered.
- Folded tool groups still unfold under verbose mode / ctrl+o.
- Task lists kept by subagents are ignored, so they never replace the main plan.

## Develop

```
claude --plugin-dir ./clean-view      # run a session with the local copy
claude plugin validate ./clean-view
claude plugin test ./clean-view
```

`hooks/plan.ts` holds the plan and progress logic, `hooks/register.tsx` the hooks and the panel, `tests/` the tests.

## License

MIT
