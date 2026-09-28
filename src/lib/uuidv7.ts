// Implements: plan://M4#4.2 — UUIDv7 клиента (specs/06 §1 review_log.id, §3)
// RFC 9562: 48-битный big-endian timestamp + 74 случайных бита; версия 7, вариант RFC.

const HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'))

export function uuidv7(now: Date = new Date()): string {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)

  const ts = now.getTime()
  bytes[0] = (ts / 2 ** 40) & 0xff
  bytes[1] = (ts / 2 ** 32) & 0xff
  bytes[2] = (ts / 2 ** 24) & 0xff
  bytes[3] = (ts / 2 ** 16) & 0xff
  bytes[4] = (ts / 2 ** 8) & 0xff
  bytes[5] = ts & 0xff
  bytes[6] = (bytes[6] & 0x0f) | 0x70 // version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 10x

  const hex = (start: number, end: number) => {
    let out = ''
    for (let i = start; i < end; i += 1) out += HEX[bytes[i]]
    return out
  }
  return `${hex(0, 4)}-${hex(4, 6)}-${hex(6, 8)}-${hex(8, 10)}-${hex(10, 16)}`
}
