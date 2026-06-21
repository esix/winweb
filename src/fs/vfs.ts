/* vfs.ts — виртуальная ФС на IndexedDB. Пути вида C:\Windows\System32.
 * Записи: папка | файл (содержимое Uint8Array). readdir по индексу parent.
 * При первом запуске засевается из /cdrive/manifest.json (файлы по одному).
 */
export interface Entry { path: string; name: string; type: 'dir' | 'file'; size: number; }

interface Rec { path: string; name: string; parent: string; type: 'dir' | 'file'; data?: Uint8Array; ver?: number; }

interface ManifestEntry { path: string; type: 'dir' | 'file'; text?: string; url?: string; exec?: boolean; }
interface Manifest { entries: ManifestEntry[]; version?: number; }

function norm(p: string): string {
  let s = p.replace(/\//g, '\\').replace(/\\+/g, '\\');
  if (s.length > 1 && s.endsWith('\\')) s = s.slice(0, -1);
  return s;
}
function split(p: string): { parent: string; name: string } {
  const s = norm(p);
  const i = s.lastIndexOf('\\');
  if (i < 0) return { parent: '', name: s };
  return { parent: s.slice(0, i) || '', name: s.slice(i + 1) };
}

export class Vfs {
  private db!: IDBDatabase;

  open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('winweb-fs', 1);
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore('files', { keyPath: 'path' });
        store.createIndex('parent', 'parent', { unique: false });
      };
      req.onsuccess = () => { this.db = req.result; resolve(); };
      req.onerror = () => reject(req.error);
    });
  }

  private tx(mode: IDBTransactionMode): IDBObjectStore {
    return this.db.transaction('files', mode).objectStore('files');
  }
  private p<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
  }

  async mkdir(path: string): Promise<void> {
    const { parent, name } = split(path);
    await this.p(this.tx('readwrite').put({ path: norm(path), name, parent, type: 'dir' } as Rec));
  }
  async writeFile(path: string, data: Uint8Array): Promise<void> {
    const { parent, name } = split(path);
    await this.p(this.tx('readwrite').put({ path: norm(path), name, parent, type: 'file', data } as Rec));
  }
  /** Канонический путь (РЕГИСТРОНЕЗАВИСИМО): резолвит каждый сегмент по фактическим именам. null если нет такого. */
  private async canonical(path: string): Promise<string | null> {
    const parts = norm(path).split('\\');
    let cur = parts[0].toUpperCase();                          // диск, напр. 'C:'
    for (let i = 1; i < parts.length; i++) {
      const kids = await this.p<Rec[]>(this.tx('readonly').index('parent').getAll(cur));
      const m = kids.find((k) => k.name.toLowerCase() === parts[i].toLowerCase());
      if (!m) return null;
      cur = m.path;
    }
    return cur;
  }
  private async getRec(path: string): Promise<Rec | undefined> {
    const n = norm(path);
    const exact = await this.p<Rec | undefined>(this.tx('readonly').get(n));
    if (exact) return exact;                                   // точное совпадение (правильный регистр) — быстрый путь
    const c = await this.canonical(n);                         // иначе резолвим регистронезависимо
    return c && c !== n ? await this.p<Rec | undefined>(this.tx('readonly').get(c)) : undefined;
  }
  async readFile(path: string): Promise<Uint8Array | null> {
    return (await this.getRec(path))?.data ?? null;
  }
  async readText(path: string): Promise<string | null> {
    const d = await this.readFile(path);
    return d ? new TextDecoder().decode(d) : null;
  }
  async stat(path: string): Promise<Entry | null> {
    const r = await this.getRec(path);
    return r ? { path: r.path, name: r.name, type: r.type, size: r.data?.length ?? 0 } : null;
  }
  async readdir(path: string): Promise<Entry[]> {
    const n = norm(path);
    const exact = n === 'C:' || !!(await this.p<Rec | undefined>(this.tx('readonly').get(n)));
    const dirPath = exact ? n : ((await this.canonical(n)) ?? n);   // регистронезависимо
    const recs = await this.p<Rec[]>(this.tx('readonly').index('parent').getAll(dirPath));
    return recs
      .map((r) => ({ path: r.path, name: r.name, type: r.type, size: r.data?.length ?? 0 }))
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
  }

  async seedVersion(): Promise<number> {
    const r = await this.p<Rec | undefined>(this.tx('readonly').get('::seedver'));
    return r?.ver ?? 0;
  }
  /** Засев при первом запуске: качаем манифест и кладём файлы по одному. */
  async seed(manifestUrl: string): Promise<void> {
    const manifest: Manifest = await (await fetch(manifestUrl, { cache: 'no-store' })).json();
    const ver = manifest.version ?? 1;
    if ((await this.seedVersion()) >= ver) return;
    for (const e of manifest.entries) {
      if (e.type === 'dir') {
        await this.mkdir(e.path);
      } else if (e.text != null) {
        await this.writeFile(e.path, new TextEncoder().encode(e.text));
      } else if (e.url) {
        const u = import.meta.env.BASE_URL + e.url.replace(/^\//, '');           // base-aware (деплой в подпапку)
        const buf = new Uint8Array(await (await fetch(u, { cache: 'no-store' })).arrayBuffer());   // no-store достаточно (кэш-бастер не нужен)
        await this.writeFile(e.path, buf);
      }
    }
    await this.p(this.tx('readwrite').put({ path: '::seedver', name: '', parent: ' ', type: 'file', ver } as Rec));
  }
}
