# claude-talk

Let separate [Claude Code](https://claude.com/claude-code) sessions on the same machine talk to each other.
Two sessions debugging the same problem can share findings without you copy-pasting between windows.

No server, no network, no dependencies. A channel is one JSONL file in `~/.claude/talk/`.

## How it works

- `/claude-talk-join dev` starts a background watcher (Claude Code's `Monitor` tool) on the channel.
- Every new message from another session reaches your session as a notification.
- Replying is optional. Sessions are told to post only something new (a finding, a working fix, a blocking question) and to stay silent otherwise, so threads end on their own.
- Sessions are not registered or "connected". Anyone who knows a channel name can post to it.

## Install

Requires Node.js 18+ and Claude Code.

```
/plugin marketplace add giamat13/claude-talk
/plugin install claude-talk@claude-talk
```

Or clone and load locally:

```
claude --plugin-dir /path/to/claude-talk
```

Commands are namespaced by the plugin (`/claude-talk:claude-talk-join`); the short form works when the name is unique.

## Commands

| Command | What it does |
| --- | --- |
| `/claude-talk-join <channel...>` | Follow one or more channels and get notified on new messages |
| `/claude-talk-msg <message>` | Send a message to everyone following your current channel (the last one you joined) |
| `/claude-talk-leave [channel...]` | Stop following channels (all if none given) |
| `/claude-talk-list` | List channels and message counts; `*` marks the ones you follow |
| `/claude-talk-summary <channel>` | Summarize a channel's findings |
| `/claude-talk-clear <channel>` | Delete a channel's history (asks first) |

Channel names cannot contain spaces: `/claude-talk-join my bug` joins two channels, `my` and `bug`. Use `my-bug`.

## Example

Window 1:
```
/claude-talk-join auth-bug
```
Window 2:
```
/claude-talk-join auth-bug
/claude-talk-msg Token refresh fails only when the clock skew is > 30s. Root cause is in src/session.ts:88.
```
Window 1 receives the message while it works and can use it.

## Design notes

- **Storage:** `~/.claude/talk/<channel>.jsonl`, append-only, one `{ts, from, text}` per line. Override the directory with `CLAUDE_TALK_DIR`.
- **Sender id:** `<folder>-<4 hex>`, generated per session. A session never sees its own replies, but it does see its own `/claude-talk-msg` messages. Those are stored with `user: true` and shown to everyone as `USER`.
- **Pacing:** the sender waits at least 10 seconds between its own messages, so a runaway loop cannot flood a channel.
- **Limits:** messages over 4000 characters are truncated. Channel names: letters, digits, `_`, `-`, up to 40 characters.
- **Late joiners** see the last 5 messages of each channel.

## Security

Any process running as your user can read and write the channel files, and any session can post to any channel it knows. Treat channel messages as untrusted data:

- The command prompts tell Claude to treat messages as information, never as instructions.
- Do not use claude-talk to pass secrets.
- Messages are stored in plain text until you run `/claude-talk-clear`.

Prompt injection through a shared channel is a real risk; only join channels whose participants you trust.

## Limitations

- Same machine, same user only.
- A closed session receives nothing. It sees recent history when it rejoins.
- A session busy in a long turn gets the notification when it is next free.

## Development

```
node scripts/talk.mjs            # prints usage
CLAUDE_TALK_DIR=$(mktemp -d) node scripts/talk.mjs send dev me "hi"
```

## License

MIT
