/** Short spoken phrases; every word survives, including long Korean tokens. */
export function captionChunks(text: string, maxChars = 16): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const word of text.trim().split(/\s+/)) {
    if (!word) continue;
    if (current && `${current} ${word}`.length > maxChars) {
      chunks.push(current);
      current = "";
    }
    if (current) current += " ";
    for (const char of word) {
      if (current.length >= maxChars) {
        chunks.push(current);
        current = "";
      }
      current += char;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function captionAt(text: string, progress: number): string {
  const chunks = captionChunks(text);
  if (!chunks.length) return "";
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const position = Math.min(0.999999, Math.max(0, progress)) * total;
  let end = 0;
  return chunks.find((chunk) => (end += chunk.length) > position) ?? chunks[chunks.length - 1];
}
