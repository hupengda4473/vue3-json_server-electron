const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const projectRoot = path.join(__dirname, '..')
const appBuilderPath = path.join(
  projectRoot,
  'node_modules',
  'app-builder-bin',
  'win',
  'x64',
  'app-builder.exe',
)
const temporaryDirectory = path.join(projectRoot, 'build', '.icon-work')
const outputPath = path.join(projectRoot, 'build', 'app-icon.ico')
const rceditPath = path.join(
  projectRoot,
  'build',
  'tools',
  'rcedit-x64.exe',
)

if (!fs.existsSync(appBuilderPath)) {
  throw new Error(`找不到 app-builder：${appBuilderPath}`)
}

if (!fs.existsSync(rceditPath)) {
  throw new Error(`找不到 rcedit：${rceditPath}`)
}

fs.rmSync(temporaryDirectory, { recursive: true, force: true })
fs.mkdirSync(temporaryDirectory, { recursive: true })

try {
  const result = execFileSync(
    appBuilderPath,
    [
      'icon',
      '--format',
      'ico',
      '--root',
      path.join(projectRoot, 'public', 'image'),
      '--root',
      projectRoot,
      '--out',
      temporaryDirectory,
      '--input',
      'logo.png',
    ],
    { encoding: 'utf8' },
  )
  const parsed = JSON.parse(result)
  const generatedIcon = parsed.icons?.[0]?.file

  if (!generatedIcon || !fs.existsSync(generatedIcon)) {
    throw new Error('未生成有效的应用 ICO 图标')
  }

  fs.copyFileSync(generatedIcon, outputPath)
  console.log(`应用图标已生成：${outputPath}`)
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true })
}
