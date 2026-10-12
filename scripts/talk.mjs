#!/usr/bin/env node
// claude-talk: file-based channels so separate Claude sessions can message each other.
// Channel = <dir>/<name>.jsonl (one JSON object per line). Per-session state = <dir>/.state/<id>.json
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DIR = process.env.CLAUDE_TALK_DIR || path.join(os.homedir(), '.claude', 'talk');
const STATE = path.join(DIR, '.state');
const MIN_GAP_MS = 10_000;
const MAX_TEXT = 4000;
const HISTORY = 5;
const CHANNEL_RE = /^[\p{L}\p{N}_-]{1,40}$/u;

fs.mkdirSync(STATE, { recursive: true });

const die = (msg) => { console.error(msg); process.exit(1); };
const chFile = (ch) => path.join(DIR, `${ch}.jsonl`);
const stFile = (id) => path.join(STATE, `${id}.json`);
const checkCh = (ch) => { if (!CHANNEL_RE.test(ch || '')) die(`bad channel name: ${ch}`); return ch; };
const checkId = (id) => { if (!/^[\w-]{1,60}$/.test(id || '')) die(`bad id: ${id}`); return id; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readState(id) {
  try { return JSON.parse(fs.readFileSync(stFile(id), 'utf8')); } catch { return { channels: [] }; }
}
function writeState(id, st) {
  if (!st.channels.length) { try { fs.unlinkSync(stFile(id)); } catch {} return; }
  fs.writeFileSync(stFile(id), JSON.stringify(st));
}
function readLines(file) {
  try { return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean); } catch { return []; }
}
function fmt(ch, line) {
  let m; try { m = JSON.parse(line); } catch { return null; }
  const t = new Date(m.ts).toLocaleTimeString('en-GB');
  const who = m.user ? 'USER' : m.from;
  return `[${ch}] ${who} (${t}): ${String(m.text).replace(/\s*\n\s*/g, ' ⏎ ')}`;
}
async function stdinText() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
  case 'newid': {
    const base = path.basename(process.cwd()).replace(/[^\w-]/g, '').slice(0, 20) || 'session';
    console.log(`${base}-${Math.random().toString(16).slice(2, 6)}`);
    break;
  }

  case 'join': {
    const id = checkId(args[0]);
    const chans = args.slice(1).map(checkCh);
    if (!chans.length) die('usage: join <id> <channel...>');
    const st = readState(id);
    st.channels = [...new Set([...st.channels, ...chans])];
    st.current = chans[chans.length - 1];
    writeState(id, st);
    console.log(`joined: ${st.channels.join(', ')} (current: ${st.current})`);
    break;
  }

  case 'leave': {
    const id = checkId(args[0]);
    const chans = args.slice(1);
    const st = readState(id);
    st.channels = chans.length ? st.channels.filter((c) => !chans.includes(c)) : [];
    if (!st.channels.includes(st.current)) st.current = st.channels[st.channels.length - 1];
    writeState(id, st);
    console.log(st.channels.length ? `still in: ${st.channels.join(', ')} (current: ${st.current})` : 'left all channels');
    break;
  }

  case 'send':   // send <ch> <id> [text|stdin]
  case 'msg': {  // msg <id> [text|stdin]  -> current channel (last one joined)
    const id = checkId(cmd === 'msg' ? args[0] : args[1]);
    let ch;
    if (cmd === 'msg') {
      ch = readState(id).current;
      if (!ch) die('not in any channel: run /claude-talk-join <channel> first');
    } else {
      ch = checkCh(args[0]);
    }
    let text = (args.slice(cmd === 'msg' ? 1 : 2).join(' ') || (await stdinText())).trim();
    if (!text) die('empty message');
    if (text.length > MAX_TEXT) text = text.slice(0, MAX_TEXT) + ' …[truncated]';
    // pace each sender so a runaway loop cannot flood a channel
    const lastFile = path.join(STATE, `${id}.last`);
    let last = 0; try { last = Number(fs.readFileSync(lastFile, 'utf8')) || 0; } catch {}
    const wait = last + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    fs.writeFileSync(lastFile, String(Date.now()));
    // CLAUDE_TALK_USER=1 is set only by the UserPromptSubmit hook for /claude-talk-msg
    const user = process.env.CLAUDE_TALK_USER === '1';
    fs.appendFileSync(chFile(ch), JSON.stringify({ ts: Date.now(), from: id, text, ...(user && { user: true }) }) + '\n');
    console.log(`sent to ${ch}`);
    break;
  }

  case 'read': {
    const ch = checkCh(args[0]);
    const n = Number(args[1]) || 50;
    const lines = readLines(chFile(ch)).slice(-n);
    if (!lines.length) console.log('(empty)');
    for (const l of lines) { const f = fmt(ch, l); if (f) console.log(f); }
    break;
  }

  case 'list': {
    const id = args[0] ? checkId(args[0]) : null;
    const mine = id ? readState(id).channels : [];
    const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.jsonl'));
    if (!files.length) console.log('(no channels yet)');
    for (const f of files) {
      const ch = f.slice(0, -6);
      console.log(`${mine.includes(ch) ? '*' : ' '} ${ch}  ${readLines(path.join(DIR, f)).length} msgs`);
    }
    if (mine.length) console.log('* = following');
    break;
  }

  case 'clear': {
    const ch = checkCh(args[0]);
    try { fs.unlinkSync(chFile(ch)); console.log(`cleared ${ch}`); } catch { console.log(`${ch}: nothing to clear`); }
    break;
  }

  case 'watch': {
    // Long-running: prints new messages from followed channels (not our own). Exits when we follow nothing.
    const id = checkId(args[0]);
    const offsets = new Map();
    const tick = () => {
      const { channels } = readState(id);
      if (!channels.length) process.exit(0);
      for (const ch of channels) {
        const file = chFile(ch);
        if (!offsets.has(ch)) {
          const lines = readLines(file);
          for (const l of lines.slice(-HISTORY)) { const f = fmt(ch, l); if (f) console.log(`(history) ${f}`); }
          console.log(`listening on ${ch}`);
          offsets.set(ch, fs.existsSync(file) ? fs.statSync(file).size : 0);
          continue;
        }
        let size = 0; try { size = fs.statSync(file).size; } catch { offsets.set(ch, 0); continue; }
        let off = offsets.get(ch);
        if (size < off) off = 0; // channel was cleared
        if (size === off) { offsets.set(ch, off); continue; }
        const fd = fs.openSync(file, 'r');
        const buf = Buffer.alloc(size - off);
        fs.readSync(fd, buf, 0, buf.length, off);
        fs.closeSync(fd);
        const text = buf.toString('utf8');
        const end = text.lastIndexOf('\n') + 1; // ignore a partially written last line
        offsets.set(ch, off + Buffer.byteLength(text.slice(0, end)));
        for (const l of text.slice(0, end).split('\n').filter(Boolean)) {
          // skip this session's own replies; keep the user's own /claude-talk-msg so it shows here too
          try { const m = JSON.parse(l); if (m.from === id && !m.user) continue; } catch { continue; }
          const f = fmt(ch, l); if (f) console.log(f);
        }
      }
    };
    tick();
    setInterval(tick, 1000);
    break;
  }

  default:
    die('usage: talk.mjs newid | join <id> <ch...> | leave <id> [ch...] | msg <id> [text|stdin] | send <ch> <id> [text|stdin] | read <ch> [n] | list [id] | clear <ch> | watch <id>');
}
