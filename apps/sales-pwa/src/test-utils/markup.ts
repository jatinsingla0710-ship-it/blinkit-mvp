/** Opening `<button …>` tag of the button whose text is exactly `label`. */
export function findButton(html: string, label: string): string | null {
  const pattern = /<button\b[^>]*>([\s\S]*?)<\/button>/g;
  for (const match of html.matchAll(pattern)) {
    const text = match[1].replace(/<[^>]+>/g, '').trim();
    if (text === label) {
      return match[0].slice(0, match[0].indexOf('>') + 1);
    }
  }
  return null;
}

export function isButtonDisabled(html: string, label: string): boolean {
  const tag = findButton(html, label);
  if (!tag) throw new Error(`Button "${label}" not rendered`);
  return /\sdisabled(=""|\s|>)/.test(tag);
}
