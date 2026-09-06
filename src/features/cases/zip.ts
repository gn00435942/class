const decoder = new TextDecoder('utf-8', { fatal: true });

export interface ZipEntry {
  name: string;
  bytes: Uint8Array;
}

function u16(view: DataView, offset: number) { return view.getUint16(offset, true); }
function u32(view: DataView, offset: number) { return view.getUint32(offset, true); }

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function readSafeZip(file: File): Promise<Map<string, Uint8Array>> {
  if (file.size > 50 * 1024 * 1024) throw new Error('ZIP 不可超過 50 MB');
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let eocd = -1;
  for (let i = Math.max(0, bytes.length - 65557); i <= bytes.length - 22; i += 1) {
    if (u32(view, i) === 0x06054b50) eocd = i;
  }
  if (eocd < 0) throw new Error('找不到 ZIP 目錄，檔案可能已損壞');
  const count = u16(view, eocd + 10);
  const centralSize = u32(view, eocd + 12);
  let cursor = u32(view, eocd + 16);
  if (cursor + centralSize > eocd) throw new Error('ZIP 目錄格式不正確');
  if (count > 31) throw new Error('ZIP 最多只能包含 case.json 與 30 個檔案');

  const output = new Map<string, Uint8Array>();
  let total = 0;
  for (let index = 0; index < count; index += 1) {
    if (u32(view, cursor) !== 0x02014b50) throw new Error('ZIP 目錄項目格式不正確');
    const flags = u16(view, cursor + 8);
    const method = u16(view, cursor + 10);
    const compressedSize = u32(view, cursor + 20);
    const size = u32(view, cursor + 24);
    const nameLength = u16(view, cursor + 28);
    const extraLength = u16(view, cursor + 30);
    const commentLength = u16(view, cursor + 32);
    const localOffset = u32(view, cursor + 42);
    if (flags & 1) throw new Error('不接受加密 ZIP');
    if (![0, 8].includes(method)) throw new Error('ZIP 使用不支援的壓縮格式');
    const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength)).replace(/\\/g, '/');
    if (!name || name.startsWith('/') || name.includes('../') || /^[A-Za-z]:/.test(name)) throw new Error(`ZIP 含不安全路徑：${name}`);
    cursor += 46 + nameLength + extraLength + commentLength;
    if (name.endsWith('/')) continue;
    if (u32(view, localOffset) !== 0x04034b50) throw new Error(`檔案索引損壞：${name}`);
    const localNameLength = u16(view, localOffset + 26);
    const localExtraLength = u16(view, localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(start, start + compressedSize);
    const expanded = method === 0 ? compressed : await inflateRaw(compressed);
    if (expanded.byteLength !== size) throw new Error(`檔案大小不符：${name}`);
    total += size;
    if (total > 100 * 1024 * 1024) throw new Error('解壓縮後總大小不可超過 100 MB');
    output.set(name, expanded);
  }
  return output;
}
