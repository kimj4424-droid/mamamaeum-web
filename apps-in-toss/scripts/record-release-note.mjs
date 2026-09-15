import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const bundlePath = resolve(appDirectory, 'momslator.ait')
const notesPath = resolve(appDirectory, 'RELEASE_NOTES.md')

if (!existsSync(bundlePath)) {
  throw new Error('momslator.ait 파일을 찾을 수 없습니다. ait build 후 실행해 주세요.')
}

const bundleHash = createHash('sha256').update(readFileSync(bundlePath)).digest('hex').slice(0, 12)
const existingNotes = existsSync(notesPath) ? readFileSync(notesPath, 'utf8') : '# 앱인토스 출시 메모\n'
let commitId = 'uncommitted'
let changeSummary = '앱인토스 번들을 갱신했습니다.'

try {
  commitId = execFileSync('git', ['-C', appDirectory, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim() || commitId
  changeSummary = execFileSync('git', ['-C', appDirectory, 'log', '-1', '--format=%s'], { encoding: 'utf8' }).trim() || changeSummary
} catch {
  // Git 정보를 읽을 수 없는 환경에서도 번들 생성은 막지 않습니다.
}

const marker = `<!-- commit:${commitId} -->`
if (existingNotes.includes(marker)) {
  console.log('출시 메모: 이번 변경 커밋은 이미 기록되어 새 항목을 만들지 않았습니다.')
  process.exit(0)
}

const date = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date())
const entry = `\n## ${date}\n${marker}\n<!-- ait:${bundleHash} -->\n- ${changeSummary}\n`
writeFileSync(notesPath, `${existingNotes.trimEnd()}\n${entry}`, 'utf8')
console.log(`출시 메모를 기록했습니다: ${notesPath}`)
