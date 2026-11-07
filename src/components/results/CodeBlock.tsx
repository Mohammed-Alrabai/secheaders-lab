import { useTranslations } from 'next-intl'

import { CopyButton } from './CopyButton'

/** Copy-ready configuration: always LTR, monospace, with a copy button. */
export function CodeBlock({ code, filename }: { code: string; filename: string }) {
  const t = useTranslations('results')
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{t('file', { name: filename })}</span>
        <CopyButton value={code} accessibleLabel={t('actions.copyCode')} />
      </figcaption>
      <pre
        tabIndex={0}
        aria-label={filename}
        dir="ltr"
        className="overflow-x-auto rounded-md border bg-muted p-3 font-mono text-sm leading-relaxed ltr-isolate print:overflow-visible print:break-all print:whitespace-pre-wrap"
      >
        <code>{code}</code>
      </pre>
    </figure>
  )
}
