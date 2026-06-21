/* msbuild.ts — браузерная сборка проекта по .vcxproj (как scripts/build-cdrive.mjs под node):
 * парсит .vcxproj из VFS, читает ClCompile/ResourceCompile-исходники, амальгамирует с libc и
 * компилирует в браузере (compileProject = cpp.ts + rcc.wasm), пишет C:\Program Files\<App>\<App>.wasm. */
import type { Vfs, Entry } from '../fs/vfs';
import { compileProject } from './lcc';

const MIME: Record<string, string> = { ico: 'image/x-icon', bmp: 'image/bmp', png: 'image/png', cur: 'image/x-icon' };

/* .rc -> C-данные ресурсов (как scripts/build-rc.mjs): switch-аксессоры winweb_res_*_at */
async function buildRc(vfs: Vfs, dir: string, rcName: string, log: (s: string) => void): Promise<string | null> {
  const rcText = await vfs.readText(`${dir}\\${rcName}`);
  if (rcText == null) { log(`  cannot read ${rcName}\r\n`); return null; }
  const res: { id: number; mime: string; bytes: Uint8Array }[] = [];
  for (const line of rcText.split('\n')) {
    const m = /^\s*(\d+)\s+(ICON|BITMAP|RCDATA)\s+"([^"]+)"/i.exec(line);
    if (!m) continue;
    const bytes = await vfs.readFile(`${dir}\\${m[3].replace(/\//g, '\\')}`);
    if (!bytes) { log(`  cannot read resource ${m[3]}\r\n`); return null; }
    res.push({ id: +m[1], mime: MIME[m[3].split('.').pop()!.toLowerCase()] || 'application/octet-stream', bytes });
  }
  let c = 'typedef struct { int id; const char* mime; const unsigned char* data; int len; } WinwebRes;\n';
  res.forEach((r, i) => { c += `static const unsigned char res_${i}[] = {${Array.from(r.bytes).join(',')}};\n`; });
  c += 'static const WinwebRes winweb_res[] = {\n';
  res.forEach((r, i) => { c += `  {${r.id}, "${r.mime}", res_${i}, sizeof res_${i}},\n`; });
  c += '};\nconst WinwebRes* winweb_res_table(void){ return winweb_res; }\n';
  c += `int winweb_res_n(void){ return ${res.length}; }\n`;
  const sw = (sig: string, arm: (i: number) => string) => `${sig}{\n  switch(i){\n${res.map((_r, i) => `    case ${i}: return ${arm(i)};\n`).join('')}  }\n  return 0;\n}\n`;
  c += sw('int winweb_res_id_at(int i)', (i) => String(res[i].id));
  c += sw('const char* winweb_res_mime_at(int i)', (i) => `"${res[i].mime}"`);
  c += sw('const unsigned char* winweb_res_data_at(int i)', (i) => `res_${i}`);
  c += sw('int winweb_res_len_at(int i)', (i) => `sizeof res_${i}`);
  return c;
}

/** Собрать проект из каталога VFS (C:\Projects\<App>). Возвращает wasm при успехе. */
export async function buildProject(vfs: Vfs, dir: string, log: (s: string) => void): Promise<{ code: number; wasm?: Uint8Array; name?: string }> {
  const ents = await vfs.readdir(dir).catch(() => [] as Entry[]);
  const vcx = ents.find((e) => e.name.toLowerCase().endsWith('.vcxproj'));
  if (!vcx) { log(`MSBuild: no .vcxproj in ${dir}\r\n`); return { code: 1 }; }
  const xml = (await vfs.readText(`${dir}\\${vcx.name}`)) ?? '';
  const name = /<ProjectName>([^<]+)<\/ProjectName>/.exec(xml)?.[1] || vcx.name.replace(/\.vcxproj$/i, '');
  const cl = [...xml.matchAll(/<ClCompile\s+Include="([^"]+)"/g)].map((m) => m[1].replace(/\//g, '\\'));
  const rc = [...xml.matchAll(/<ResourceCompile\s+Include="([^"]+)"/g)].map((m) => m[1].replace(/\//g, '\\'));
  log(`MSBuild ${name}: ${cl.length} source(s)${rc.length ? `, ${rc.length} .rc` : ''}\r\n`);
  const sources: string[] = [];
  for (const s of cl) { const t = await vfs.readText(`${dir}\\${s}`); if (t == null) { log(`  error: cannot read ${s}\r\n`); return { code: 1 }; } sources.push(t); }
  for (const r of rc) { const resC = await buildRc(vfs, dir, r, log); if (resC == null) return { code: 1 }; sources.push(resC); }
  const headers = new Map<string, string>();   // guard'им (многие vendored-.h без include-guard'ов -> redeclaration в одной TU)
  for (const e of ents) if (e.name.toLowerCase().endsWith('.h')) {
    const t = await vfs.readText(`${dir}\\${e.name}`);
    if (t != null) { const g = '_VFSG_' + e.name.replace(/\W/g, '_').toUpperCase(); headers.set(e.name, `#ifndef ${g}\n#define ${g}\n${t}\n#endif\n`); }
  }

  let wasm: Uint8Array;
  try { ({ wasm } = await compileProject(sources, headers)); }
  catch (e) { log(`  ${String((e as Error).message).split('\n').slice(0, 5).join('\r\n  ')}\r\n  Build FAILED.\r\n`); return { code: 1 }; }

  const outDir = `C:\\Program Files\\${name}`;
  await vfs.mkdir('C:\\Program Files').catch(() => {});
  await vfs.mkdir(outDir).catch(() => {});
  const out = `${outDir}\\${name}.wasm`;
  await vfs.writeFile(out, wasm);
  log(`  ${name}.wasm -> ${out} (${wasm.length} bytes)\r\n  Build succeeded.\r\n`);
  return { code: 0, wasm, name };
}
