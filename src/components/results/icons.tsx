import {
  CircleCheck,
  CircleX,
  Cookie,
  EyeOff,
  FileCode2,
  Info,
  LockKeyhole,
  TriangleAlert,
} from 'lucide-react'

import type { Category, Status } from '@/lib/scanner/types'

const PROPS = { strokeWidth: 1.75, 'aria-hidden': true } as const

/** `08` §7: CircleCheck / TriangleAlert / CircleX / Info, always paired with text. */
export function StatusIcon({ status, className }: { status: Status; className?: string }) {
  switch (status) {
    case 'pass':
      return <CircleCheck {...PROPS} className={className} />
    case 'warn':
      return <TriangleAlert {...PROPS} className={className} />
    case 'fail':
      return <CircleX {...PROPS} className={className} />
    case 'info':
      return <Info {...PROPS} className={className} />
  }
}

/** `08` §7 category icons. */
export function CategoryIcon({ category, className }: { category: Category; className?: string }) {
  switch (category) {
    case 'headers':
      return <FileCode2 {...PROPS} className={className} />
    case 'tls':
      return <LockKeyhole {...PROPS} className={className} />
    case 'cookies':
      return <Cookie {...PROPS} className={className} />
    case 'disclosure':
      return <EyeOff {...PROPS} className={className} />
  }
}
