import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const OUTPUT_DIRECTORY = 'out'
const SCRIPT_TAG = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi

function listHtmlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)

    if (entry.isDirectory()) {
      return listHtmlFiles(path)
    }

    return entry.name.endsWith('.html') ? [path] : []
  })
}

function findViolations(html) {
  const violations = []

  for (const [, attributes] of html.matchAll(SCRIPT_TAG)) {
    if (!/\bsrc=/.test(attributes) && !/type="application\/json"/.test(attributes)) {
      violations.push('inline script')
    }
  }

  if (/<style\b/i.test(html)) {
    violations.push('inline style element')
  }

  if (/<[a-z][^>]*\sstyle="/i.test(html)) {
    violations.push('style attribute')
  }

  if (/<[a-z][^>]*\son[a-z]+="/i.test(html)) {
    violations.push('inline event handler')
  }

  return violations
}

function listJavaScriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)

    if (entry.isDirectory()) {
      return listJavaScriptFiles(path)
    }

    return entry.name.endsWith('.js') ? [path] : []
  })
}

const files = listHtmlFiles(OUTPUT_DIRECTORY)
const failures = files.flatMap((file) => findViolations(readFileSync(file, 'utf8')).map((violation) => `${file}: ${violation}`))

// A variable meant for development ends up in the bundle if it comes from .env, and the CSP would then block every request
const localApiFailures = listJavaScriptFiles(OUTPUT_DIRECTORY)
  .filter((file) => /\bhttps?:\/\/localhost:\d/.test(readFileSync(file, 'utf8')))
  .map((file) => `${file}: points to a local API, check NEXT_PUBLIC_API_URL`)

failures.push(...localApiFailures)

if (files.length === 0) {
  failures.push(`${OUTPUT_DIRECTORY}: no pages found`)
}

if (failures.length > 0) {
  console.error(`The strict CSP would block these:\n${failures.join('\n')}`)
  process.exit(1)
}

console.log(`CSP check passed on ${files.length} pages`)
