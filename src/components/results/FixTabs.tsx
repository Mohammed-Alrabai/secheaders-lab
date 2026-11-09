'use client'

import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PLATFORMS, type Platform, type Snippet, remediationFor } from '@/lib/remediation'
import type { RuleId } from '@/lib/scanner/types'

import { CodeBlock } from './CodeBlock'

function isPlatform(value: unknown): value is Platform {
  return typeof value === 'string' && (PLATFORMS as readonly string[]).includes(value)
}

interface PlatformTabsProps {
  platform: Platform
  onPlatformChange: (platform: Platform) => void
  children: (platform: Platform) => ReactNode
}

/**
 * Platform tabs (`06` §2, §5): WAI-ARIA tabs from Base UI, arrow keys follow the text
 * direction. The selected platform is shared across the report and carried into print.
 */
export function PlatformTabs({ platform, onPlatformChange, children }: PlatformTabsProps) {
  const t = useTranslations('results')
  return (
    <Tabs
      value={platform}
      onValueChange={(value: unknown) => {
        if (isPlatform(value)) onPlatformChange(value)
      }}
    >
      <TabsList
        aria-label={t('platformsLabel')}
        className="h-auto max-w-full flex-wrap print:hidden"
      >
        {PLATFORMS.map((p) => (
          <TabsTrigger key={p} value={p}>
            {t(`platforms.${p}`)}
          </TabsTrigger>
        ))}
      </TabsList>
      {PLATFORMS.map((p) => (
        <TabsContent key={p} value={p} className="pt-2">
          <p className="mb-2 hidden text-sm font-medium print:block">{t(`platforms.${p}`)}</p>
          {children(p)}
        </TabsContent>
      ))}
    </Tabs>
  )
}

/** A remediation snippet: copy-ready code, or localized steps. */
export function SnippetView({ snippet }: { snippet: Snippet }) {
  const tSteps = useTranslations('remediation.steps')
  return snippet.kind === 'code' ? (
    <CodeBlock code={snippet.code} filename={snippet.filename} />
  ) : (
    <p className="leading-relaxed">
      {tSteps(snippet.messageKey.replace('remediation.steps.', ''), snippet.params ?? {})}
    </p>
  )
}

interface FixTabsProps {
  rule: RuleId
  platform: Platform
  onPlatformChange: (platform: Platform) => void
}

/** The fix for one finding, per platform. */
export function FixTabs({ rule, platform, onPlatformChange }: FixTabsProps) {
  return (
    <PlatformTabs platform={platform} onPlatformChange={onPlatformChange}>
      {(p) => <SnippetView snippet={remediationFor(rule, p)} />}
    </PlatformTabs>
  )
}
