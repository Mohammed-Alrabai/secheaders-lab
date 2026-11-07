import type { CheckInput, Finding } from '../types'

import { checkCookies } from './cookies'
import { checkCsp } from './csp'
import { checkDisclosure } from './disclosure'
import {
  checkCoop,
  checkDuplicates,
  checkFrame,
  checkPermissions,
  checkReferrer,
  checkXcto,
  checkXxss,
} from './headers'
import { checkHsts } from './hsts'
import { checkHttpRedirect, checkTls } from './tls'

/** Every check, in registry order. Each is a pure function of {@link CheckInput}. */
const CHECKS: readonly ((input: CheckInput) => Finding[])[] = [
  checkHsts,
  checkCsp,
  checkFrame,
  checkXcto,
  checkReferrer,
  checkPermissions,
  checkCoop,
  checkXxss,
  checkDuplicates,
  checkTls,
  checkHttpRedirect,
  checkCookies,
  checkDisclosure,
]

/** Runs all checks (`04` §4). Pure: no I/O, deterministic for a given input. */
export function runChecks(input: CheckInput): Finding[] {
  return CHECKS.flatMap((check) => check(input))
}
