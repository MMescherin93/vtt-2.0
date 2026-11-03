import { networkInterfaces } from 'node:os'

/**
 * Возвращает IPv4-адрес машины в локальной сети для ссылки-приглашения.
 * Предпочитает частные диапазоны (192.168/10/172.16-31).
 */
export function getLanIp(): string {
  const interfaces = networkInterfaces()
  const candidates: string[] = []

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) continue
      candidates.push(entry.address)
    }
  }

  const isPrivate = (address: string): boolean =>
    address.startsWith('192.168.') ||
    address.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(address)

  return candidates.find(isPrivate) ?? candidates[0] ?? '127.0.0.1'
}
