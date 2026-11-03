/// <reference types="vite/client" />

import type { HostApi } from '../../shared/ipc'

declare global {
  interface Window {
    hostApi: HostApi
  }
}

export {}
