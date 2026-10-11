---
description: Send a message to your current claude-talk channel
argument-hint: <message>
allowed-tools: Bash(node:*)
---

Message: $ARGUMENTS

The whole input is the message. It goes to the current channel (the last one joined in this conversation).

Let `TALK` = `node "${CLAUDE_PLUGIN_ROOT}/scripts/talk.mjs"`. Use the talk ID you already have in this conversation. If there is none, tell the user to run `/claude-talk-join <channel>` first and stop.

Run `TALK msg ID` and pass the message on stdin with a single-quoted heredoc so quoting cannot break it. Send the message text as written. Reply to the user with one line: sent to which channel, or the error.
