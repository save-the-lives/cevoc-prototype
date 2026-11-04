// Minimal Server-Sent Events reader for a fetch() response body (POST, so the registration number stays in the body).
// Feed it text as it arrives; it calls onEvent(name, dataText) once per complete event. Comment lines (": ...") are ignored.

export function createSseParser(onEvent) {
  let buffer = '';
  const flush = (block) => {
    let name = 'message';
    const data = [];
    for (const line of block.split('\n')) {
      if (!line || line.startsWith(':')) continue;
      const i = line.indexOf(':');
      const field = i === -1 ? line : line.slice(0, i);
      let value = i === -1 ? '' : line.slice(i + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'event') name = value;
      else if (field === 'data') data.push(value);
    }
    if (data.length) onEvent(name, data.join('\n'));
  };
  return {
    push(text) {
      buffer += text.replace(/\r\n?/g, '\n');
      let at;
      while ((at = buffer.indexOf('\n\n')) !== -1) {
        flush(buffer.slice(0, at));
        buffer = buffer.slice(at + 2);
      }
    },
    end() {
      if (buffer.trim()) flush(buffer);
      buffer = '';
    },
  };
}
