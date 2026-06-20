/* shortcuts.ts — .lnk ярлыки (простой формат key=value), читаемые из папок VFS.
 * Рабочий стол = C:\Windows\Desktop, меню Программы = C:\Windows\Start Menu\Programs. */
import type { Vfs } from '../fs/vfs';

export interface Shortcut { name: string; target: string; icon: string; }

function parseLnk(text: string): { target: string; icon: string } {
  let target = '', icon = '📄';
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    const i = line.indexOf('=');
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (k === 'target') target = v;
    else if (k === 'icon') icon = v;
  }
  return { target, icon };
}

/** Ярлыки (.lnk) из папки VFS; имя = имя файла без .lnk, отсортировано. */
export async function readShortcuts(vfs: Vfs, dir: string): Promise<Shortcut[]> {
  const out: Shortcut[] = [];
  for (const e of await vfs.readdir(dir)) {
    if (e.type !== 'file' || !e.name.toLowerCase().endsWith('.lnk')) continue;
    const { target, icon } = parseLnk((await vfs.readText(e.path)) ?? '');
    out.push({ name: e.name.replace(/\.lnk$/i, ''), target, icon });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
