import fs from 'node:fs'

// Active feature from .specify/feature.json ("feature_directory"), with an
// optional --feature <dir> override for cross-feature marking.
const args = process.argv.slice(2)
let override
const flagIdx = args.indexOf('--feature')
if (flagIdx !== -1) {
  override = args.splice(flagIdx, 2)[1]
}
const wanted = args
const featureDir =
  override ?? JSON.parse(fs.readFileSync('.specify/feature.json', 'utf8')).feature_directory
const path = `${featureDir}/tasks.md`
let s = fs.readFileSync(path, 'utf8')
for (const t of wanted) {
  const needle = `- [ ] ${t} `
  if (!s.includes(needle)) {
    throw new Error(`not found: ${t}`)
  }
  s = s.replace(needle, `- [X] ${t} `)
}
fs.writeFileSync(path, s)
console.log(`marked (${path}): ${wanted.join(', ')}`)
