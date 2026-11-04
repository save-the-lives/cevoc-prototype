import { describe, expect, it } from 'vitest';
import { createSseParser } from './sse.js';

const collect = () => {
  const events = [];
  const p = createSseParser((name, data) => events.push([name, data]));
  return { events, p };
};

describe('createSseParser', () => {
  it('reads events that arrive whole', () => {
    const { events, p } = collect();
    p.push('event:details\ndata:{"a":1}\n\nevent:done\ndata:{"ok":true}\n\n');
    expect(events).toEqual([['details', '{"a":1}'], ['done', '{"ok":true}']]);
  });
  it('reads an event split across chunks, including inside a line', () => {
    const { events, p } = collect();
    p.push('event:evid');
    p.push('ence\ndata:{"x"');
    expect(events).toEqual([]);
    p.push(':2}\n');
    p.push('\n');
    expect(events).toEqual([['evidence', '{"x":2}']]);
  });
  it('ignores comment lines (the keep-alive) and handles CRLF and a space after the colon', () => {
    const { events, p } = collect();
    p.push(': open\r\n\r\n: ping\n\nevent: certificates\r\ndata: {"c":[]}\r\n\r\n');
    expect(events).toEqual([['certificates', '{"c":[]}']]);
  });
  it('joins multi-line data and defaults the name', () => {
    const { events, p } = collect();
    p.push('data:one\ndata:two\n\n');
    expect(events).toEqual([['message', 'one\ntwo']]);
  });
  it('end() delivers a final event with no blank line', () => {
    const { events, p } = collect();
    p.push('event:done\ndata:{}');
    p.end();
    expect(events).toEqual([['done', '{}']]);
  });
});
