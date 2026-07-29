// @ts-check

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[i] = value >>> 0;
  }
  return table;
})();

/** @param {Uint8Array} data */
export function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** @param {number} length */
function bytes(length) {
  const array = new Uint8Array(length);
  return { array, view: new DataView(array.buffer) };
}

/** @param {string|Uint8Array|ArrayBuffer|Blob} data */
async function toBytes(data) {
  if (typeof data === 'string') return new TextEncoder().encode(data);
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new Uint8Array(await data.arrayBuffer());
}

/**
 * Minimal deterministic ZIP writer using the STORE method. This is intentionally tiny and
 * dependency-free; PNG files are already compressed, so asking Deflate to squeeze them again
 * mostly produces heat and self-importance.
 *
 * @param {{name:string,data:string|Uint8Array|ArrayBuffer|Blob}[]} entries
 * @returns {Promise<Blob>}
 */
export async function createZip(entries) {
  /** @type {Uint8Array[]} */
  const localParts = [];
  /** @type {{name:Uint8Array,crc:number,size:number,offset:number}[]} */
  const index = [];
  let offset = 0;

  for (const entry of entries) {
    const name = new TextEncoder().encode(entry.name.replace(/\\/g, '/'));
    const data = await toBytes(entry.data);
    const crc = crc32(data);
    const header = bytes(30);
    header.view.setUint32(0, 0x04034b50, true);
    header.view.setUint16(4, 20, true);
    header.view.setUint16(6, 0x0800, true); // UTF-8 names.
    header.view.setUint16(8, 0, true); // STORE.
    header.view.setUint16(10, 0, true);
    header.view.setUint16(12, 0x0021, true); // 1980-01-01, deterministic.
    header.view.setUint32(14, crc, true);
    header.view.setUint32(18, data.length, true);
    header.view.setUint32(22, data.length, true);
    header.view.setUint16(26, name.length, true);
    header.view.setUint16(28, 0, true);
    localParts.push(header.array, name, data);
    index.push({ name, crc, size: data.length, offset });
    offset += header.array.length + name.length + data.length;
  }

  /** @type {Uint8Array[]} */
  const centralParts = [];
  let centralSize = 0;
  for (const entry of index) {
    const header = bytes(46);
    header.view.setUint32(0, 0x02014b50, true);
    header.view.setUint16(4, 20, true);
    header.view.setUint16(6, 20, true);
    header.view.setUint16(8, 0x0800, true);
    header.view.setUint16(10, 0, true);
    header.view.setUint16(12, 0, true);
    header.view.setUint16(14, 0x0021, true);
    header.view.setUint32(16, entry.crc, true);
    header.view.setUint32(20, entry.size, true);
    header.view.setUint32(24, entry.size, true);
    header.view.setUint16(28, entry.name.length, true);
    header.view.setUint16(30, 0, true);
    header.view.setUint16(32, 0, true);
    header.view.setUint16(34, 0, true);
    header.view.setUint16(36, 0, true);
    header.view.setUint32(38, 0, true);
    header.view.setUint32(42, entry.offset, true);
    centralParts.push(header.array, entry.name);
    centralSize += header.array.length + entry.name.length;
  }

  const footer = bytes(22);
  footer.view.setUint32(0, 0x06054b50, true);
  footer.view.setUint16(4, 0, true);
  footer.view.setUint16(6, 0, true);
  footer.view.setUint16(8, index.length, true);
  footer.view.setUint16(10, index.length, true);
  footer.view.setUint32(12, centralSize, true);
  footer.view.setUint32(16, offset, true);
  footer.view.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, footer.array], { type: 'application/zip' });
}
