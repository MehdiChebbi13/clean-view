# Clean View

A Claude Code mod that hides the noise while Claude works (tool calls, terminal output, file contents, diffs) and shows a calm panel above the prompt instead:

While Claude works:

```
✱ Build a weather dashboard for New York…                              7s
Step 2 of 4  ▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆   25%
✓ Pick the page style and layout          ▆▆▆▆▆▆▆▆▆▆▆▆▆▆  Done
● Check how the page gets live weather    ▆▆▆▆▆▆▆▆▆▆▆▆▆▆  Working
○ Build the weather dashboard             ▆▆▆▆▆▆▆▆▆▆▆▆▆▆  Next
○ Publish it and share the link           ▆▆▆▆▆▆▆▆▆▆▆▆▆▆  Up next
```

When it is done, the same panel turns into a green card: `✓ All done`, `took 1m 47s`, `4 of 4 steps`, every bar full.

- **Plan**: Claude's own task list (TodoWrite / tasks), one row per step with its own mini bar.
- **Current step**: bold, pink, with a bar that shimmers while it runs. With no list, what Claude is doing right now (`▶ Running a command`).
- **Progress**: `Step 2 of 4`, an orange-to-pink gradient bar, the percentage, and a live timer.
- **Status**: working (pink), waiting for your input (amber: permission prompts, questions), all done (green card).

Bars are coloured cell rows on the terminal and rounded SVG strips in Claude desktop.

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
