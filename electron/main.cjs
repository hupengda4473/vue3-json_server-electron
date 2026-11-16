const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron')
const express = require('express')
const { randomUUID } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const jsonServer = require('json-server')
const low = require('lowdb')
const multer = require('multer')
const { AtomicFileSync, atomicWriteFileSync } = require('./atomic-file-sync.cjs')
const {
  BACKUP_DIRECTORY,
  BACKUP_DIRECTORY_2,
  BackupManager,
} = require('./backup-manager.cjs')

let mainWindow = null
let apiServer = null
let apiBaseUrl = ''
let dataFilePath = ''
let mediaDirectory = ''
let backupManager = null
let backupTargets = []

const isSmokeTest =
  process.argv.includes('--smoke-test') ||
  app.commandLine.hasSwitch('smoke-test')
const smokeUserDataDirectory = process.env.LOCAL_DATA_DESK_SMOKE_USER_DATA

if (isSmokeTest && smokeUserDataDirectory) {
  const isolatedUserData = path.resolve(smokeUserDataDirectory)
  fs.mkdirSync(isolatedUserData, { recursive: true })
  app.setPath('userData', isolatedUserData)
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
}

function getTemplatePath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'db.template.json')
    : path.join(__dirname, 'db.template.json')
}

function ensureDatabase() {
  const dataDirectory = path.join(app.getPath('userData'), 'data')
  dataFilePath = path.join(dataDirectory, 'db.json')
  mediaDirectory = path.join(dataDirectory, 'media')

  fs.mkdirSync(dataDirectory, { recursive: true })
  fs.mkdirSync(mediaDirectory, { recursive: true })

  if (!fs.existsSync(dataFilePath)) {
    atomicWriteFileSync(dataFilePath, fs.readFileSync(getTemplatePath()))
    return dataFilePath
  }

  try {
    JSON.parse(fs.readFileSync(dataFilePath, 'utf8'))
  } catch (error) {
    const backupPath = `${dataFilePath}.broken-${Date.now()}`
    fs.copyFileSync(dataFilePath, backupPath)
    atomicWriteFileSync(dataFilePath, fs.readFileSync(getTemplatePath()))
    console.error(`数据库文件损坏，已备份到 ${backupPath}`, error)
  }

  return dataFilePath
}

function ensureDatabaseCollections() {
  const database = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'))
  let changed = false

  if (!Array.isArray(database.projects)) {
    database.projects = []
    changed = true
  }

  if (!Array.isArray(database.drafts)) {
    database.drafts = []
    changed = true
  }

  if (changed) {
    atomicWriteFileSync(dataFilePath, `${JSON.stringify(database, null, 2)}\n`)
  }

  return changed
}

function initializeBackupManagers() {
  const primaryBackupDirectory = process.env.LOCAL_DATA_DESK_BACKUP_DIRECTORY
    ? path.resolve(process.env.LOCAL_DATA_DESK_BACKUP_DIRECTORY)
    : BACKUP_DIRECTORY
  const secondaryBackupDirectory =
    process.env.LOCAL_DATA_DESK_BACKUP_DIRECTORY_2
      ? path.resolve(process.env.LOCAL_DATA_DESK_BACKUP_DIRECTORY_2)
      : BACKUP_DIRECTORY_2
  const fallbackDirectory = path.join(app.getPath('userData'), 'backups')

  backupTargets = [
    {
      id: 'primary',
      label: '本地硬盘备份',
      requestedDirectory: primaryBackupDirectory,
      required: true,
      manager: null,
      status: 'offline',
      error: '',
      directory: primaryBackupDirectory,
    },
    {
      id: 'secondary',
      label: '移动硬盘 / 第二地址',
      requestedDirectory: secondaryBackupDirectory,
      required: false,
      manager: null,
      status: 'offline',
      error: '',
      directory: secondaryBackupDirectory,
    },
  ]

  for (const target of backupTargets) {
    const candidates = target.required
      ? [target.requestedDirectory, fallbackDirectory]
      : [target.requestedDirectory]
    let lastError = null

    for (const directory of candidates) {
      try {
        const manager = new BackupManager({
          dataFilePath,
          mediaDirectory,
          backupDirectory: directory,
        })
        manager.createSnapshot(target.required ? 'startup' : 'startup-secondary')
        target.manager = manager
        target.directory = manager.backupDirectory
        target.status = 'online'
        target.error = ''
        lastError = null
        break
      } catch (error) {
        lastError = error
        console.error(`备份目录不可用：${directory}`, error.message)
      }
    }

    if (!target.manager && lastError) {
      target.status = 'offline'
      target.error = lastError.message
    }
  }

  const primaryTarget = backupTargets.find((target) => target.id === 'primary')
  if (!primaryTarget?.manager) {
    throw new Error(primaryTarget?.error || '没有可用的主数据备份目录')
  }

  backupManager = primaryTarget.manager
}

function ensureBackupTarget(target) {
  if (target.manager) return true

  try {
    const manager = new BackupManager({
      dataFilePath,
      mediaDirectory,
      backupDirectory: target.requestedDirectory,
    })
    manager.ensureDirectories()
    target.manager = manager
    target.directory = manager.backupDirectory
    target.status = 'online'
    target.error = ''
    return true
  } catch (error) {
    target.status = 'offline'
    target.error = error.message
    return false
  }
}

function createSnapshots(reason, options = { syncMedia: false }) {
  let primaryError = null

  for (const target of backupTargets) {
    try {
      if (!ensureBackupTarget(target, reason)) {
        if (target.required) {
          primaryError = new Error(target.error || '主备份不可用')
        }
        continue
      }
      target.manager.createSnapshot(reason, options)
      target.status = 'online'
      target.error = ''
    } catch (error) {
      target.status = 'offline'
      target.error = error.message
      if (target.required) primaryError = error
    }
  }

  if (primaryError) throw primaryError
}

function refreshBackupLatest(reason) {
  for (const target of backupTargets) {
    if (!target.manager) continue
    try {
      target.manager.refreshLatest(reason, null, { syncMedia: false })
      target.status = 'online'
      target.error = ''
    } catch (error) {
      target.status = 'offline'
      target.error = error.message
    }
  }
}

function copyMediaToBackups(sourcePath) {
  let primaryError = null

  for (const target of backupTargets) {
    try {
      if (!ensureBackupTarget(target)) {
        if (target.required) {
          primaryError = new Error(target.error || '主备份不可用')
        }
        continue
      }
      target.manager.copyMediaFile(sourcePath)
    } catch (error) {
      target.status = 'offline'
      target.error = error.message
      if (target.required) primaryError = error
    }
  }

  if (primaryError) throw primaryError
}

function getBackupStatus() {
  return backupTargets.map((target) => {
    let manifest = null

    if (target.manager?.manifestPath) {
      try {
        manifest = JSON.parse(
          fs.readFileSync(target.manager.manifestPath, 'utf8'),
        )
      } catch {
        manifest = null
      }
    }

    return {
      id: target.id,
      label: target.label,
      status: target.status,
      required: target.required,
      directory: target.manager?.backupDirectory || target.directory,
      error: target.error,
      lastBackupAt: manifest?.lastBackupAt || null,
      snapshotCount: manifest?.snapshotCount || 0,
      mediaFiles: manifest?.mediaFiles || 0,
      recordCount: manifest?.recordCount ?? null,
      totalBytes: manifest?.totalBytes || 0,
      maxTotalBytes: manifest?.maxTotalBytes || 10 * 1024 * 1024 * 1024,
      sizeLimitExceeded: manifest?.sizeLimitExceeded || false,
    }
  })
}

function detectImageType(buffer) {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) {
    return { extension: 'png', mimeType: 'image/png' }
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: 'jpg', mimeType: 'image/jpeg' }
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { extension: 'webp', mimeType: 'image/webp' }
  }

  const gifHeader = buffer.subarray(0, 6).toString('ascii')
  if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') {
    return { extension: 'gif', mimeType: 'image/gif' }
  }

  return null
}

function cleanupOrphanedMedia(maxAgeMs = 30 * 24 * 60 * 60 * 1000) {
  try {
    const database = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'))
    const referencedFiles = new Set(
      (Array.isArray(database.records) ? database.records : [])
        .filter((record) => typeof record.image?.path === 'string')
        .map((record) => path.basename(record.image.path)),
    )
    const cutoff = Date.now() - maxAgeMs

    for (const entry of fs.readdirSync(mediaDirectory, { withFileTypes: true })) {
      if (!entry.isFile() || referencedFiles.has(entry.name)) continue

      const filePath = path.join(mediaDirectory, entry.name)
      if (fs.statSync(filePath).mtimeMs >= cutoff) continue

      fs.unlinkSync(filePath)
    }
  } catch (error) {
    console.warn('图片目录清理失败', error.message)
  }
}

function startApiServer() {
  const dbPath = ensureDatabase()
  initializeBackupManagers()
  const schemaChanged = ensureDatabaseCollections()
  if (schemaChanged) {
    createSnapshots('schema-upgrade', { syncMedia: false })
  }
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 8 * 1024 * 1024,
      files: 1,
    },
  })
  const serverApp = express()
  cleanupOrphanedMedia()

  serverApp.use(
    jsonServer.defaults({
      logger: !app.isPackaged,
      noCors: false,
    }),
  )

  serverApp.use(
    '/media',
    express.static(mediaDirectory, {
      index: false,
      fallthrough: false,
      maxAge: '1h',
      setHeaders(response) {
        response.setHeader('X-Content-Type-Options', 'nosniff')
      },
    }),
  )

  serverApp.post('/api/media', upload.single('image'), (request, response, next) => {
    try {
      if (!request.file) {
        response.status(400).json({ error: '请选择图片文件' })
        return
      }

      const imageType = detectImageType(request.file.buffer)
      if (!imageType) {
        response.status(415).json({
          error: '仅支持 PNG、JPEG、WebP 或 GIF 图片',
        })
        return
      }

      const fileName = `${randomUUID()}.${imageType.extension}`
      const finalPath = path.join(mediaDirectory, fileName)
      const temporaryPath = `${finalPath}.upload`

      fs.writeFileSync(temporaryPath, request.file.buffer, { flag: 'wx' })
      fs.renameSync(temporaryPath, finalPath)

      try {
        copyMediaToBackups(finalPath)
      } catch (error) {
        fs.rmSync(finalPath, { force: true })
        response.status(503).json({
          error: `图片备份失败，已取消上传：${error.message}`,
        })
        return
      }

      const originalName = path
        .basename(request.file.originalname || `image.${imageType.extension}`)
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .slice(0, 180)

      response.status(201).json({
        image: {
          path: `media/${fileName}`,
          mimeType: imageType.mimeType,
          size: request.file.size,
          originalName,
        },
      })
    } catch (error) {
      next(error)
    }
  })

  serverApp.delete('/api/media/:fileName', (request, response) => {
    const { fileName } = request.params
    if (!/^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/i.test(fileName)) {
      response.status(400).json({ error: '图片文件名无效' })
      return
    }

    const filePath = path.join(mediaDirectory, fileName)
    if (!fs.existsSync(filePath)) {
      response.status(404).json({ error: '图片不存在' })
      return
    }

    fs.unlinkSync(filePath)
    response.status(204).end()
  })

  serverApp.use((error, request, response, next) => {
    if (error instanceof multer.MulterError) {
      response.status(400).json({
        error:
          error.code === 'LIMIT_FILE_SIZE'
            ? '图片不能超过 8 MB'
            : '图片上传失败',
      })
      return
    }

    next(error)
  })

  serverApp.use((request, response, next) => {
    const isDataWrite =
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) &&
      !request.path.startsWith('/api/media') &&
      !request.path.startsWith('/media')

    if (!isDataWrite) {
      next()
      return
    }

    const snapshotPolicy = String(
      request.get('x-data-snapshot') || 'required',
    ).toLowerCase()
    const shouldCreateSnapshot = snapshotPolicy !== 'skip'

    if (shouldCreateSnapshot) {
      try {
        createSnapshots(`before-${request.method.toLowerCase()}`, {
          syncMedia: false,
        })
      } catch (error) {
        response.status(503).json({
          error: `自动备份失败，已拒绝写入：${error.message}`,
        })
        return
      }
    }

    response.setHeader(
      'X-Data-Snapshot',
      shouldCreateSnapshot ? 'created' : 'skipped',
    )
    response.on('finish', () => {
      if (response.statusCode >= 200 && response.statusCode < 300) {
        try {
          refreshBackupLatest('after-write')
        } catch (error) {
          console.error('写入后更新备份失败', error)
        }
      }
    })

    next()
  })

  serverApp.use(jsonServer.bodyParser)
  const database = low(new AtomicFileSync(dbPath))
  serverApp.use(jsonServer.router(database))

  return new Promise((resolve, reject) => {
    const server = serverApp.listen(0, '127.0.0.1', () => {
      const address = server.address()
      resolve({
        server,
        url: `http://127.0.0.1:${address.port}`,
      })
    })

    server.on('error', reject)
  })
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    fullscreen: true,
    width: 1240,
    height: 820,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: '#f3f5f1',
    autoHideMenuBar: true,
    icon: app.isPackaged
      ? path.join(__dirname, '..', 'dist', 'image', 'logo.png')
      : path.join(__dirname, '..', 'public', 'image', 'logo.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  const query = { apiBase: apiBaseUrl }
  const devServerUrl = process.env.VITE_DEV_SERVER_URL

  if (devServerUrl) {
    await mainWindow.loadURL(
      `${devServerUrl}?apiBase=${encodeURIComponent(apiBaseUrl)}`,
    )
  } else {
    await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), {
      query,
    })
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function registerIpcHandlers() {
  ipcMain.handle('app:info', () => ({
    appName: app.getName(),
    appVersion: app.getVersion(),
    isPackaged: app.isPackaged,
    apiBaseUrl,
    dataFilePath,
    backupDirectory: backupManager?.backupDirectory || BACKUP_DIRECTORY,
    backupTargets: getBackupStatus(),
  }))

  ipcMain.handle('app:open-data-folder', async () => {
    const result = await shell.openPath(path.dirname(dataFilePath))
    return result || null
  })

  ipcMain.handle('app:open-backup-folder', async (_event, targetId = 'primary') => {
    const target = backupTargets.find((item) => item.id === targetId)
    if (!target) return '备份目标不存在'

    const directory = target.manager?.backupDirectory || target.directory
    const result = await shell.openPath(directory)
    return result || null
  })

  ipcMain.handle('app:backup-status', () => getBackupStatus())

  ipcMain.handle('app:create-backup', () => {
    createSnapshots('manual', { syncMedia: true })
    return getBackupStatus()
  })

  ipcMain.handle('app:quit', () => {
    setImmediate(() => app.quit())
    return true
  })
}

async function runSmokeTest() {
  const resultPath =
    process.env.LOCAL_DATA_DESK_SMOKE_RESULT ||
    path.join(process.cwd(), 'desktop-smoke-test.json')
  let uploadedFilePath = ''
  let uploadedBackupPath = ''
  let secondaryBackupPath = ''
  let createdRecordId = ''
  let createdProjectId = ''
  let skippedSnapshotProjectId = ''

  try {
    const response = await fetch(`${apiBaseUrl}/records`)
    if (!response.ok) {
      throw new Error(`JSON Server 返回 ${response.status}`)
    }

    const records = await response.json()
    const initialRecordCount = records.length
    const projectsResponse = await fetch(`${apiBaseUrl}/projects`)
    if (!projectsResponse.ok) {
      throw new Error(`projects 集合返回 ${projectsResponse.status}`)
    }
    const projects = await projectsResponse.json()
    if (!Array.isArray(projects)) {
      throw new Error('projects 不是顶层数组')
    }
    if (
      backupTargets.length < 2 ||
      backupTargets.some((target) => !target.manager)
    ) {
      throw new Error('多目标备份未全部初始化')
    }

    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    )
    const formData = new FormData()
    formData.append('image', new Blob([pngBuffer], { type: 'image/png' }), 'smoke.png')

    const uploadResponse = await fetch(`${apiBaseUrl}/api/media`, {
      method: 'POST',
      body: formData,
    })
    if (!uploadResponse.ok) {
      throw new Error(`图片上传返回 ${uploadResponse.status}`)
    }

    const uploadResult = await uploadResponse.json()
    const uploadedFileName = path.basename(uploadResult.image.path)
    uploadedFilePath = path.join(mediaDirectory, uploadedFileName)
    if (!fs.existsSync(uploadedFilePath)) {
      throw new Error('图片文件未写入 media 目录')
    }
    uploadedBackupPath = path.join(backupManager.mediaBackupDirectory, uploadedFileName)
    const secondaryTarget = backupTargets.find((target) => target.id === 'secondary')
    secondaryBackupPath = path.join(
      secondaryTarget.manager.mediaBackupDirectory,
      uploadedFileName,
    )
    if (!fs.existsSync(uploadedBackupPath)) {
      throw new Error('图片文件未同步到备份目录')
    }
    if (!fs.existsSync(secondaryBackupPath)) {
      throw new Error('图片文件未同步到第二备份目录')
    }

    const imageResponse = await fetch(
      `${apiBaseUrl}/media/${encodeURIComponent(uploadedFileName)}`,
    )
    if (!imageResponse.ok) {
      throw new Error(`图片读取返回 ${imageResponse.status}`)
    }

    const createRecordResponse = await fetch(`${apiBaseUrl}/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Smoke Test Contact',
        company: 'Local Storage Test',
        phone: '130 0000 0000',
        email: 'smoke@example.com',
        status: 'active',
        notes: 'Temporary record for the desktop storage smoke test',
        image: uploadResult.image,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    })
    if (!createRecordResponse.ok) {
      throw new Error(`测试联系人创建返回 ${createRecordResponse.status}`)
    }

    const createdRecord = await createRecordResponse.json()
    createdRecordId = createdRecord.id

    const updateRecordResponse = await fetch(
      `${apiBaseUrl}/records/${encodeURIComponent(createdRecordId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'lead',
          updatedAt: new Date().toISOString(),
        }),
      },
    )
    if (!updateRecordResponse.ok) {
      throw new Error(`测试联系人更新返回 ${updateRecordResponse.status}`)
    }

    const persistedDatabase = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'))
    const persistedRecord = persistedDatabase.records.find(
      (record) => String(record.id) === String(createdRecordId),
    )
    if (!persistedRecord?.image?.path) {
      throw new Error('联系人图片元数据未写入数据库')
    }

    const deleteRecordResponse = await fetch(
      `${apiBaseUrl}/records/${encodeURIComponent(createdRecordId)}`,
      { method: 'DELETE' },
    )
    if (!deleteRecordResponse.ok) {
      throw new Error(`测试联系人删除返回 ${deleteRecordResponse.status}`)
    }
    createdRecordId = ''

    const createProjectResponse = await fetch(`${apiBaseUrl}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Smoke Test Project',
        category: '测试',
        status: 'planning',
        priority: 'low',
        owner: 'Smoke Test',
        dueDate: '2026-12-31',
        notes: 'Temporary project collection test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    })
    if (!createProjectResponse.ok) {
      throw new Error(`测试项目创建返回 ${createProjectResponse.status}`)
    }
    const createdProject = await createProjectResponse.json()
    createdProjectId = createdProject.id

    const updateProjectResponse = await fetch(
      `${apiBaseUrl}/projects/${encodeURIComponent(createdProjectId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'in_progress',
          updatedAt: new Date().toISOString(),
        }),
      },
    )
    if (!updateProjectResponse.ok) {
      throw new Error(`测试项目更新返回 ${updateProjectResponse.status}`)
    }

    const deleteProjectResponse = await fetch(
      `${apiBaseUrl}/projects/${encodeURIComponent(createdProjectId)}`,
      { method: 'DELETE' },
    )
    if (!deleteProjectResponse.ok) {
      throw new Error(`测试项目删除返回 ${deleteProjectResponse.status}`)
    }
    createdProjectId = ''

    const snapshotCountBeforeSkip = fs
      .readdirSync(backupManager.databaseBackupDirectory)
      .filter((name) => name.startsWith('db-') && name.endsWith('.json')).length
    const skippedSnapshotCreateResponse = await fetch(
      `${apiBaseUrl}/projects`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Data-Snapshot': 'skip',
        },
        body: JSON.stringify({
          name: 'Snapshot Skip Test',
          category: '临时',
          status: 'planning',
          priority: 'low',
          owner: 'Smoke Test',
          notes: 'Temporary no-snapshot test',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      },
    )
    if (!skippedSnapshotCreateResponse.ok) {
      throw new Error(`无快照项目创建返回 ${skippedSnapshotCreateResponse.status}`)
    }
    if (
      skippedSnapshotCreateResponse.headers.get('x-data-snapshot') !== 'skipped'
    ) {
      throw new Error('服务端没有确认跳过快照策略')
    }

    const skippedSnapshotProject = await skippedSnapshotCreateResponse.json()
    skippedSnapshotProjectId = skippedSnapshotProject.id

    const skippedSnapshotDeleteResponse = await fetch(
      `${apiBaseUrl}/projects/${encodeURIComponent(skippedSnapshotProjectId)}`,
      {
        method: 'DELETE',
        headers: { 'X-Data-Snapshot': 'skip' },
      },
    )
    if (!skippedSnapshotDeleteResponse.ok) {
      throw new Error(`无快照项目删除返回 ${skippedSnapshotDeleteResponse.status}`)
    }
    skippedSnapshotProjectId = ''

    const snapshotCountAfterSkip = fs
      .readdirSync(backupManager.databaseBackupDirectory)
      .filter((name) => name.startsWith('db-') && name.endsWith('.json')).length
    if (snapshotCountAfterSkip !== snapshotCountBeforeSkip) {
      throw new Error('skip 请求仍然生成了历史快照')
    }

    const deleteImageResponse = await fetch(
      `${apiBaseUrl}/api/media/${encodeURIComponent(uploadedFileName)}`,
      { method: 'DELETE' },
    )
    if (!deleteImageResponse.ok) {
      throw new Error(`图片删除返回 ${deleteImageResponse.status}`)
    }

    if (fs.existsSync(uploadedFilePath)) {
      throw new Error('图片文件删除失败')
    }
    uploadedFilePath = ''

    const backupManifest = JSON.parse(
      fs.readFileSync(backupManager.manifestPath, 'utf8'),
    )
    const snapshotCount = fs
      .readdirSync(backupManager.databaseBackupDirectory)
      .filter((name) => name.startsWith('db-') && name.endsWith('.json')).length
    if (!snapshotCount || !fs.existsSync(backupManager.latestPath)) {
      throw new Error('自动数据库备份未生成')
    }
    if (!fs.existsSync(uploadedBackupPath)) {
      throw new Error('图片备份文件丢失')
    }

    fs.writeFileSync(
      resultPath,
      JSON.stringify(
        {
          ok: true,
          records: initialRecordCount,
          atomicWrite: true,
          backup: true,
          multiTargetBackup: true,
          projectsCollection: true,
          snapshotSkip: true,
          imageUpload: true,
          backupDirectory: backupManager.backupDirectory,
          backupTargets: getBackupStatus(),
          snapshotCount,
          backupManifestAt: backupManifest.lastBackupAt,
          mediaDirectory,
          dataFilePath,
          apiBaseUrl,
        },
        null,
        2,
      ),
    )
    app.exit(0)
  } catch (error) {
    if (createdRecordId) {
      try {
        await fetch(`${apiBaseUrl}/records/${encodeURIComponent(createdRecordId)}`, {
          method: 'DELETE',
        })
      } catch {
        // Best-effort cleanup for a failed smoke test.
      }
    }
    if (createdProjectId) {
      try {
        await fetch(`${apiBaseUrl}/projects/${encodeURIComponent(createdProjectId)}`, {
          method: 'DELETE',
        })
      } catch {
        // Best-effort cleanup for a failed smoke test.
      }
    }
    if (skippedSnapshotProjectId) {
      try {
        await fetch(
          `${apiBaseUrl}/projects/${encodeURIComponent(skippedSnapshotProjectId)}`,
          {
            method: 'DELETE',
            headers: { 'X-Data-Snapshot': 'skip' },
          },
        )
      } catch {
        // Best-effort cleanup for a failed smoke test.
      }
    }
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      fs.rmSync(uploadedFilePath, { force: true })
    }
    fs.writeFileSync(
      resultPath,
      JSON.stringify(
        {
          ok: false,
          error: error.message,
          dataFilePath,
          apiBaseUrl,
        },
        null,
        2,
      ),
    )
    app.exit(1)
  }
}

if (hasSingleInstanceLock) {
  app.on('second-instance', () => {
    if (!mainWindow) return

    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }

    mainWindow.focus()
  })

  app.whenReady().then(async () => {
    try {
      const result = await startApiServer()
      apiServer = result.server
      apiBaseUrl = result.url

      if (isSmokeTest) {
        await runSmokeTest()
        return
      }

      registerIpcHandlers()
      Menu.setApplicationMenu(null)
      await createWindow()
    } catch (error) {
      dialog.showErrorBox(
        '启动失败',
        `本地数据服务未能启动。\n\n${error.message}`,
      )
      app.quit()
    }

    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await createWindow()
      }
    })
  })

  app.on('before-quit', () => {
    if (apiServer) {
      apiServer.close()
      apiServer = null
    }
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}
