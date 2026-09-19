import fs from 'node:fs'

const path = 'specs/006-tax-engine/tasks.md'
let s = fs.readFileSync(path, 'utf8')
const wanted = process.argv.slice(2)
for (const t of wanted) {
  const needle = `- [ ] ${t} `
  if (!s.includes(needle)) {
    throw new Error(`not found: ${t}`)
  }
  s = s.replace(needle, `- [X] ${t} `)
}
fs.writeFileSync(path, s)
console.log(`marked: ${wanted.join(', ')}`)
