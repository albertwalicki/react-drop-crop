/** Does `file` satisfy one of the `accept` patterns (MIME, `type/*`, or `.ext`)? */
export function matchesAccept(file: File, accept: string[]): boolean {
  return accept.some((a) => {
    if (a === 'image/*' || a === '*') return file.type.startsWith('image/');
    if (a.endsWith('/*')) return file.type.startsWith(a.slice(0, -1));
    if (a.startsWith('.')) return file.name.toLowerCase().endsWith(a.toLowerCase());
    return file.type === a;
  });
}
