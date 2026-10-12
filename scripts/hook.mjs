#!/usr/bin/env node
// UserPromptSubmit hook: runs the simple claude-talk commands without the model and shows the
// output to the user (block + reason, like /usage). /claude-talk-join is not blocked; it only
// gets the session's talk id as context so the model and this hook use the same id.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TALK = path.join(path.dirname(fileURLToPath(import.meta.url)), 'talk.mjs');
const FROM_USER = '[FROM THE USER - sent by the human user, not by another Claude session] ';

let input = {};
try {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
} catch { process.exit(0); }

const m = /^\s*\/(?:claude-talk:)?claude-talk-(msg|list|leave|clear|join)(?:\s+([\s\S]*))?$/.exec(input.prompt || '');
if (!m) process.exit(0);
const [, name, rest = ''] = m;

const base = path.basename(input.cwd || process.cwd()).replace(/[^\w-]/g, '').slice(0, 20) || 'session';
const id = `${base}-${String(input.session_id || 'x').replace(/[^\w]/g, '').slice(0, 4)}`;

if (name === 'join') {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: `claude-talk id for this conversation: ${id}. Use exactly this id; do not run newid.`,
    },
  }));
  process.exit(0);
}

const run = (args, stdin) => {
  try {
    return execFileSync('node', [TALK, ...args], { input: stdin, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    return String(e.stderr || e.message).trim();
  }
};

const words = rest.trim().split(/\s+/).filter(Boolean);
let out;
if (name === 'list') out = run(['list', id]);
else if (name === 'leave') out = run(['leave', id, ...words]);
else if (name === 'clear') out = words[0] ? run(['clear', words[0]]) : 'usage: /claude-talk-clear <channel>';
else out = rest.trim() ? run(['msg', id], FROM_USER + rest.trim()) : 'usage: /claude-talk-msg <message>';

console.log(JSON.stringify({ continue: false, suppressOutput: true, systemMessage: out || '(done)' }));
