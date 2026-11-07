'use client'

import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useId, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from '@/i18n/navigation'
import { type FormError, checkUrlInput } from '@/lib/client-url-check'

interface ScanFormProps {
  /** Pre-filled value, e.g. on the results page for a rescan of another site. */
  defaultValue?: string
  /** Example hostnames offered as one-click chips. */
  examples?: { label: string; value: string }[]
}

/**
 * URL form (FR-01, `06` §5): visible label, hint and error tied to the input with
 * `aria-describedby`, error announced on submit, focus returned to the field.
 */
export function ScanForm({ defaultValue = '', examples = [] }: ScanFormProps) {
  const t = useTranslations('home')
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(defaultValue)
  const [error, setError] = useState<FormError | null>(null)
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`

  function submit(raw: string) {
    const problem = checkUrlInput(raw)
    setError(problem)
    if (problem) {
      inputRef.current?.focus()
      return
    }
    router.push({ pathname: '/scan', query: { url: raw.trim() } })
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          submit(value)
        }}
        className="flex flex-col gap-2"
      >
        <Label htmlFor={id} className="font-heading">
          {t('form.label')}
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            ref={inputRef}
            id={id}
            name="url"
            type="text"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            dir="ltr"
            placeholder={t('form.placeholder')}
            value={value}
            onChange={(event) => {
              setValue(event.target.value)
              if (error) setError(null)
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${errorId} ${hintId}` : hintId}
            className="h-10 font-mono text-base sm:flex-1"
          />
          <Button type="submit" size="lg" className="h-10 sm:w-32">
            <Search strokeWidth={1.75} className="size-5" aria-hidden />
            {t('form.submit')}
          </Button>
        </div>
        <p id={hintId} className="text-sm text-muted-foreground">
          {t('form.hint')}
        </p>
        <p id={errorId} role="alert" className="min-h-5 text-sm font-medium text-destructive">
          {error ? t(`form.errors.${error}`) : null}
        </p>
      </form>
      {examples.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t('examples.label')}</span>
          {examples.map((example) => (
            <Button
              key={example.value}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setValue(example.value)
                submit(example.value)
              }}
            >
              <bdi dir="ltr" className="font-mono">
                {example.label}
              </bdi>
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
