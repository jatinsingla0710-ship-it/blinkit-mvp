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

/** `href` of the first link whose text or aria-label is exactly `name`. */
export function linkHref(html: string, name: string): string | null {
  const pattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/g;
  for (const match of html.matchAll(pattern)) {
    const attrs = match[1];
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    const aria = /aria-label="([^"]*)"/.exec(attrs)?.[1];
    if (text === name || aria === name) {
      return /href="([^"]*)"/.exec(attrs)?.[1] ?? null;
    }
  }
  return null;
}

export function isButtonDisabled(html: string, label: string): boolean {
  const tag = findButton(html, label);
  if (!tag) throw new Error(`Button "${label}" not rendered`);
  return /\sdisabled(=""|\s|>)/.test(tag);
}
