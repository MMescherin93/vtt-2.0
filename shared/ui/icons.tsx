import type { ReactNode, SVGProps } from 'react'

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  size?: number
}

function Icon({ size = 20, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export function CursorIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 3l6.5 17 2.2-6.3L20 11.5 5 3z" />
    </Icon>
  )
}

export function HandIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 12V6.5a1.5 1.5 0 013 0V11" />
      <path d="M11 11V5.5a1.5 1.5 0 013 0V11" />
      <path d="M14 11V7a1.5 1.5 0 013 0v7" />
      <path d="M8 12V9.5a1.5 1.5 0 00-3 0V15a6 6 0 006 6h2a5 5 0 005-5v-3" />
    </Icon>
  )
}

export function PencilIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20l4.5-1.2L20 7.3a2 2 0 00-2.8-2.8L5.7 16 4 20z" />
      <path d="M15.5 6.5l2.8 2.8" />
    </Icon>
  )
}

export function TextIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 5h14M12 5v14M8.5 19h7" />
    </Icon>
  )
}

export function EraserIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8.5 20H20" />
      <path d="M15.5 4.5l4 4a2 2 0 010 2.8l-7 7a2 2 0 01-2.8 0l-4-4a2 2 0 010-2.8l7-7a2 2 0 012.8 0z" />
      <path d="M9 9l6 6" />
    </Icon>
  )
}

export function FogIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 8h9a3 3 0 100-6 4.5 4.5 0 00-8.4 1.4A3.3 3.3 0 006 8z" />
      <path d="M4 12h16M6 16h12M8 20h8" />
    </Icon>
  )
}

export function DiceIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function ChatIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 12a7.5 7.5 0 01-7.5 7.5H8L4 22v-4.5A7.5 7.5 0 0111.5 4h1A7.5 7.5 0 0120 11.5V12z" />
    </Icon>
  )
}

export function GridIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
    </Icon>
  )
}

export function EyeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </Icon>
  )
}

export function EyeOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 4l16 16" />
      <path d="M9.9 5.9A9.9 9.9 0 0112 5.5c6.5 0 10 6.5 10 6.5a17.4 17.4 0 01-3.3 4.1" />
      <path d="M6.3 7.8A17.6 17.6 0 002 12s3.5 6.5 10 6.5a9.7 9.7 0 004.2-.9" />
      <path d="M9.9 9.9a3 3 0 004.2 4.2" />
    </Icon>
  )
}

export function TrashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13" />
      <path d="M10 11v5M14 11v5" />
    </Icon>
  )
}

export function FileTextIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 3h8l4 4v14H6V3z" />
      <path d="M14 3v5h5" />
      <path d="M9 12h6M9 15.5h6M9 19h4" />
    </Icon>
  )
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  )
}

export function SettingsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </Icon>
  )
}

export function UsersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0113 0" />
      <path d="M16 5.5a3.5 3.5 0 010 6.9" />
      <path d="M17.5 14.5a6.5 6.5 0 014 5.5" />
    </Icon>
  )
}

export function LinkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 13.5a4 4 0 005.7 0l2.8-2.8a4 4 0 10-5.7-5.7L11.5 6" />
      <path d="M14 10.5a4 4 0 00-5.7 0L5.5 13.3a4 4 0 105.7 5.7L12.5 18" />
    </Icon>
  )
}

export function CopyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 5.5A1.5 1.5 0 0013.5 4h-8A1.5 1.5 0 004 5.5v8A1.5 1.5 0 005.5 15" />
    </Icon>
  )
}

export function ZoomInIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5M11 8v6M8 11h6" />
    </Icon>
  )
}

export function ZoomOutIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5M8 11h6" />
    </Icon>
  )
}

export function FitIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 9V5a1 1 0 011-1h4M20 9V5a1 1 0 00-1-1h-4M4 15v4a1 1 0 001 1h4M20 15v4a1 1 0 01-1 1h-4" />
    </Icon>
  )
}

export function RotateIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 11a8 8 0 10-2.3 6.3" />
      <path d="M20 5v6h-6" />
    </Icon>
  )
}

export function LockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8.5 10V7a3.5 3.5 0 017 0v3" />
    </Icon>
  )
}

export function UnlockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8.5 10V7a3.5 3.5 0 016.6-1.7" />
    </Icon>
  )
}

export function ImageIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9" r="1.6" />
      <path d="M4 17l4.5-4.5 3 3L15 11l5 5" />
    </Icon>
  )
}

export function UploadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 16V4M8 8l4-4 4 4" />
      <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
    </Icon>
  )
}

export function XIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  )
}

export function SendIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 12l16-8-5.5 16-2.7-6.3L4 12z" />
    </Icon>
  )
}

export function HistoryIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 12a8 8 0 108-8 8 8 0 00-6.9 4" />
      <path d="M4 4v4h4M12 8v4.5l3 1.8" />
    </Icon>
  )
}

export function TargetIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </Icon>
  )
}

export function ChevronIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 6l6 6-6 6" />
    </Icon>
  )
}

export function CloudIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 18a4 4 0 010-8 5.5 5.5 0 0110.5-1.2A3.8 3.8 0 0118 18H7z" />
    </Icon>
  )
}

export function PuzzleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
      <path d="M13.5 17.25h7.5M17.25 13.5v7.5" />
    </Icon>
  )
}

export function EditIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 00-3-3L5 17v3z" />
      <path d="M13.5 6.5l3 3" />
    </Icon>
  )
}
