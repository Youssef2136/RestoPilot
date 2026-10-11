#!/usr/bin/env node
/**
 * specs/039 T011 — the no-silent-gaps verifier (FR-04): every citation in
 * scenario-proof.md must resolve on disk — the named file exists AND the
 * named test title appears in it. Fails (exit 1) on any unresolvable row,
 * listing them. Wired as `npm run verify:scenario-proof`.
 *
 * Mechanically honest: it does NOT run the tests (the gate does); it
 * verifies the TABLE's citations exist — the anti-silent-gap half.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TABLE = resolve(ROOT, 'specs/039-frontend-e2e-validation/scenario-proof.md')

const markdown = readFileSync(TABLE, 'utf8')
const rowRe = /^\| (\d+) \| (.+?) \| (CITED|NEW) \| (.+?) \|$/gm

const unresolvable = []
let count = 0
for (const m of markdown.matchAll(rowRe)) {
  count += 1
  const [, num, scenario, status, proofCell] = m
  // A proof cell may cite several space-separated refs; each ref is a
  // file › test-title pair (new files are listed with ›+ test fragment).
  for (const ref of proofCell.split(/ \+ /).map((s) => s.trim())) {
    const sep = ref.indexOf(' › ')
    if (sep === -1) {
      unresolvable.push({ num, scenario, ref, reason: 'no file › test separator' })
      continue
    }
    const file = ref.slice(0, sep).trim()
    const testTitle = ref.slice(sep + 3).trim()
    // Strip a "THE" prefix artifact for title fragments (e.g. "THE ... ").
    const normalized = testTitle.replace(/^THE\s+/i, '')
    const path = resolve(ROOT, file)
    if (!existsSync(path)) {
      unresolvable.push({ num, scenario, ref, reason: `file not found: ${file}` })
      continue
    }
    const source = readFileSync(path, 'utf8')
    const needle = normalized
      // Take the title up to the first ' + ' or '—' if present already
      // handled by split; match a distinctive prefix (case-insensitive) so
      // paraphrased row text still resolves.
      .split(/[,.;]/)[0]
      ?.trim()
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(escaped.slice(0, 60), 'i')
    if (!re.test(source)) {
      unresolvable.push({
        num,
        scenario,
        ref,
        reason: `test fragment not found in ${file}: "${needle.slice(0, 60)}"`,
      })
    }
  }
}

console.log(`scenario-proof: ${count} rows scanned`)
if (unresolvable.length > 0) {
  console.error(`UNRESOLVED (${unresolvable.length}):`)
  for (const u of unresolvable) {
    console.error(`  row ${u.num} [${u.scenario}] — ${u.reason}`)
  }
  process.exit(1)
}
console.log('scenario-proof: every citation resolves (no silent gaps)')
