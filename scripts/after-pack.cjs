const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return

  const projectRoot = context.packager.projectDir
  const executableName = `${context.packager.appInfo.productFilename}.exe`
  const executablePath = path.join(context.appOutDir, executableName)
  const iconPath = path.join(projectRoot, 'build', 'app-icon.ico')
  const rceditPath = path.join(
    projectRoot,
    'build',
    'tools',
    'rcedit-x64.exe',
  )

  for (const requiredPath of [executablePath, iconPath, rceditPath]) {
    if (!fs.existsSync(requiredPath)) {
      throw new Error(`afterPack 缺少文件：${requiredPath}`)
    }
  }

  const productName = context.packager.appInfo.productName
  const appVersion = context.packager.appInfo.version
  const companyName = context.packager.appInfo.companyName || productName

  execFileSync(
    rceditPath,
    [
      executablePath,
      '--set-icon',
      iconPath,
      '--set-file-version',
      appVersion,
      '--set-product-version',
      appVersion,
      '--set-version-string',
      'ProductName',
      productName,
      '--set-version-string',
      'FileDescription',
      productName,
      '--set-version-string',
      'CompanyName',
      companyName,
      '--set-version-string',
      'InternalName',
      context.packager.appInfo.productFilename,
      '--set-version-string',
      'OriginalFilename',
      executableName,
      '--set-requested-execution-level',
      'asInvoker',
    ],
    { stdio: 'inherit' },
  )

  console.log(`已写入应用图标和版本信息：${executablePath}`)
}
