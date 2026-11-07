'use client'

import { useTranslations } from 'next-intl'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PLATFORMS, type Platform, remediationFor } from '@/lib/remediation'
import type { RuleId } from '@/lib/scanner/types'

import { CodeBlock } from './CodeBlock'

interface FixTabsProps {
  rule: RuleId
  platform: Platform
  onPlatformChange: (platform: Platform) => void
}

function isPlatform(value: unknown): value is Platform {
  return typeof value === 'string' && (PLATFORMS as readonly string[]).includes(value)
}

/**
 * Platform tabs (`06` §2, §5): WAI-ARIA tabs from Base UI, arrow keys follow the text
 * direction. The selected platform is shared across cards and carried into print.
 */
export function FixTabs({ rule, platform, onPlatformChange }: FixTabsProps) {
  const t = useTranslations('results')
  const tSteps = useTranslations('remediation.steps')
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
      {PLATFORMS.map((p) => {
        const snippet = remediationFor(rule, p)
        return (
          <TabsContent key={p} value={p} className="pt-2">
            <p className="mb-2 hidden text-sm font-medium print:block">{t(`platforms.${p}`)}</p>
            {snippet.kind === 'code' ? (
              <CodeBlock code={snippet.code} filename={snippet.filename} />
            ) : (
              <p className="leading-relaxed">
                {tSteps(snippet.messageKey.replace('remediation.steps.', ''), snippet.params ?? {})}
              </p>
            )}
          </TabsContent>
        )
      })}
    </Tabs>
  )
}
