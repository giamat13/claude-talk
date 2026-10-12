# claude-talk

After every change: commit, push, then update the installed plugin on the user's machine so the local install is always current:

```
claude plugin marketplace update claude-talk
claude plugin update claude-talk@claude-talk
```

If the plugin is not installed yet: `claude plugin marketplace add giamat13/claude-talk` then `claude plugin install claude-talk@claude-talk`.
Tell the user to restart Claude Code sessions to load the update.
