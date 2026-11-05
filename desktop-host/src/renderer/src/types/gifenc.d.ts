declare module 'gifenc' {
  export type GifPalette = number[][]

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: { format?: 'rgb565' | 'rgb444' | 'rgba4444' }
  ): GifPalette

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: GifPalette,
    format?: 'rgb565' | 'rgb444' | 'rgba4444'
  ): Uint8Array

  export interface GifEncoder {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: {
        palette?: GifPalette
        delay?: number
        repeat?: number
        dispose?: number
        transparent?: boolean
        transparentIndex?: number
      }
    ): void
    finish(): void
    bytes(): Uint8Array
    reset(): void
  }

  export function GIFEncoder(options?: {
    auto?: boolean
    initialCapacity?: number
  }): GifEncoder
}
