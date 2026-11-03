export interface ImageDimensions {
  width: number
  height: number
}

/**
 * Определяет размеры изображения по его байтам (без внешних зависимостей).
 * Поддерживаются PNG, JPEG, GIF, WebP и BMP — этого достаточно для карт и
 * токенов, которые загружает Мастер.
 */
export function imageSize(data: Uint8Array): ImageDimensions | null {
  try {
    return png(data) ?? jpeg(data) ?? gif(data) ?? webp(data) ?? bmp(data)
  } catch (error) {
    console.error('[imageSize] не удалось определить размеры изображения:', error)
    return null
  }
}

function png(data: Uint8Array): ImageDimensions | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (data.length < 24) return null
  for (let i = 0; i < signature.length; i += 1) {
    if (data[i] !== signature[i]) return null
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const width = view.getUint32(16)
  const height = view.getUint32(20)
  return width > 0 && height > 0 ? { width, height } : null
}

function gif(data: Uint8Array): ImageDimensions | null {
  if (data.length < 10) return null
  const header = String.fromCharCode(...data.slice(0, 6))
  if (header !== 'GIF87a' && header !== 'GIF89a') return null
  const width = data[6]! | (data[7]! << 8)
  const height = data[8]! | (data[9]! << 8)
  return width > 0 && height > 0 ? { width, height } : null
}

function bmp(data: Uint8Array): ImageDimensions | null {
  if (data.length < 26) return null
  if (data[0] !== 0x42 || data[1] !== 0x4d) return null
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const width = view.getInt32(18, true)
  const height = view.getInt32(22, true)
  return width > 0 && height > 0 ? { width, height: Math.abs(height) } : null
}

function jpeg(data: Uint8Array): ImageDimensions | null {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return null
  let offset = 2
  while (offset + 9 < data.length) {
    if (data[offset] !== 0xff) {
      offset += 1
      continue
    }
    const marker = data[offset + 1]!
    // Маркеры без длины
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2
      continue
    }
    if (marker === 0xd9 || marker === 0xda) return null
    const length = (data[offset + 2]! << 8) | data[offset + 3]!
    if (length < 2) return null
    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (isStartOfFrame) {
      const height = (data[offset + 5]! << 8) | data[offset + 6]!
      const width = (data[offset + 7]! << 8) | data[offset + 8]!
      return width > 0 && height > 0 ? { width, height } : null
    }
    offset += 2 + length
  }
  return null
}

function webp(data: Uint8Array): ImageDimensions | null {
  if (data.length < 30) return null
  const riff = String.fromCharCode(...data.slice(0, 4))
  const webpSignature = String.fromCharCode(...data.slice(8, 12))
  if (riff !== 'RIFF' || webpSignature !== 'WEBP') return null

  const chunk = String.fromCharCode(...data.slice(12, 16))
  if (chunk === 'VP8 ') {
    // Lossy: размеры лежат по смещению 26 (14-битные значения)
    const width = (data[26]! | (data[27]! << 8)) & 0x3fff
    const height = (data[28]! | (data[29]! << 8)) & 0x3fff
    return width > 0 && height > 0 ? { width, height } : null
  }
  if (chunk === 'VP8L') {
    const bits = data[21]! | (data[22]! << 8) | (data[23]! << 16) | (data[24]! << 24)
    const width = (bits & 0x3fff) + 1
    const height = ((bits >> 14) & 0x3fff) + 1
    return { width, height }
  }
  if (chunk === 'VP8X') {
    const width = 1 + (data[24]! | (data[25]! << 8) | (data[26]! << 16))
    const height = 1 + (data[27]! | (data[28]! << 8) | (data[29]! << 16))
    return { width, height }
  }
  return null
}
