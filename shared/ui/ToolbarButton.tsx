import type { ReactNode } from 'react'

export interface ToolbarButtonProps {
  label: string
  icon: ReactNode
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  /** Дополнительный бейдж (например, число) */
  badge?: number
  /** Кнопка-переключатель: подсвечивается, когда active */
  tone?: 'default' | 'danger'
}

/** Кнопка плавающей панели инструментов с подсказкой при наведении */
export function ToolbarButton({
  label,
  icon,
  onClick,
  active = false,
  disabled = false,
  badge,
  tone = 'default'
}: ToolbarButtonProps) {
  const base =
    'group relative flex h-9 w-9 items-center justify-center rounded-lg border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40'
  const state = active
    ? 'border-indigo-400/60 bg-indigo-500/25 text-indigo-100 shadow-[0_0_16px_-4px_rgba(99,102,241,0.8)]'
    : tone === 'danger'
      ? 'border-transparent text-gray-300 hover:border-red-400/40 hover:bg-red-500/15 hover:text-red-200'
      : 'border-transparent text-gray-300 hover:border-white/10 hover:bg-white/10 hover:text-white'

  return (
    <button
      type="button"
      className={`${base} ${state}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
    >
      {icon}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-indigo-500 px-1 text-[10px] font-semibold leading-4 text-white">
          {badge}
        </span>
      )}
      <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-[#12141c]/95 px-2 py-1 text-xs text-gray-200 opacity-0 shadow-lg backdrop-blur transition-opacity duration-150 group-hover:opacity-100">
        {label}
      </span>
    </button>
  )
}
