---
description: Delete the history of a claude-talk channel
argument-hint: <channel>
allowed-tools: Bash(node:*)
---

Channel: $ARGUMENTS

This deletes the channel history for every session. First run `TALK list` and ask the user to confirm clearing `<channel>`; do not clear before they say yes. Then run `TALK clear <channel>`.

Let `TALK` = `node "${CLAUDE_PLUGIN_ROOT}/scripts/talk.mjs"`.
