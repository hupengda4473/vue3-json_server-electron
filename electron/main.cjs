const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron')
const express = require('express')
const fs = require('node:fs')
const path = require('node:path')
const jsonServer = require('json-server')

let mainWindow = null
let apiServer = null
let apiBaseUrl = ''
let dataFilePath = ''

const isSmokeTest =
  process.argv.includes('--smoke-test') ||
  app.commandLine.hasSwitch('smoke-test')
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

  fs.mkdirSync(dataDirectory, { recursive: true })

  if (!fs.existsSync(dataFilePath)) {
    fs.copyFileSync(getTemplatePath(), dataFilePath)
    return dataFilePath
  }

  try {
    JSON.parse(fs.readFileSync(dataFilePath, 'utf8'))
  } catch (error) {
    const backupPath = `${dataFilePath}.broken-${Date.now()}`
    fs.copyFileSync(dataFilePath, backupPath)
    fs.copyFileSync(getTemplatePath(), dataFilePath)
    console.error(`数据库文件损坏，已备份到 ${backupPath}`, error)
  }

  return dataFilePath
}

function startApiServer() {
  const dbPath = ensureDatabase()
  const serverApp = express()

  serverApp.use(
    jsonServer.defaults({
      logger: !app.isPackaged,
      noCors: false,
    }),
  )
  serverApp.use(jsonServer.bodyParser)
  serverApp.use(jsonServer.router(dbPath))

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
  }))

  ipcMain.handle('app:open-data-folder', async () => {
    const result = await shell.openPath(path.dirname(dataFilePath))
    return result || null
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

  try {
    const response = await fetch(`${apiBaseUrl}/records`)
    if (!response.ok) {
      throw new Error(`JSON Server 返回 ${response.status}`)
    }

    const records = await response.json()
    fs.writeFileSync(
      resultPath,
      JSON.stringify(
        {
          ok: true,
          records: records.length,
          dataFilePath,
          apiBaseUrl,
        },
        null,
        2,
      ),
    )
    app.exit(0)
  } catch (error) {
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
