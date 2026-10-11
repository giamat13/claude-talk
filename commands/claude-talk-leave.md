---
description: Stop following a claude-talk channel (or all of them)
argument-hint: [channel...]
allowed-tools: Bash(node:*)
---

Channels: $ARGUMENTS (empty = all)

Let `TALK` = `node "${CLAUDE_PLUGIN_ROOT}/scripts/talk.mjs"`. Use the talk ID from this conversation; if there is none, say you are not in any channel and stop.

Run `TALK leave ID <channels>`. The watcher stops itself when no channels remain. Reply with one line: what you left and what you still follow.
