# claude-talk

After every change: bump `version` in `.claude-plugin/plugin.json` (updates are skipped when the version is unchanged), commit, push, then update the installed plugin on the user's machine so the local install is always current.

`claude` is not on PATH. Use the binary bundled with the VS Code extension (find it with `Get-ChildItem "$env:USERPROFILE\.vscode\extensions\anthropic.claude-code-*\resources\native-binary\claude.exe"`, newest version):

```
claude.exe plugin marketplace update claude-talk
claude.exe plugin update claude-talk@claude-talk
```

If the plugin is not installed yet: `plugin marketplace add giamat13/claude-talk` then `plugin install claude-talk@claude-talk`.
Tell the user to restart Claude Code sessions to load the update.
