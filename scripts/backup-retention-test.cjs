const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const {
  BackupManager,
  MAX_SNAPSHOTS,
  RETENTION_DAYS,
} = require('../electron/backup-manager.cjs')

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds)
}

function createDatabase(filePath, records) {
  fs.writeFileSync(
    filePath,
    `${JSON.stringify(
      {
        records,
        projects: [],
        drafts: [],
      },
      null,
      2,
    )}\n`,
  )
}

function snapshotCount(manager) {
  return fs
    .readdirSync(manager.databaseBackupDirectory)
    .filter((name) => name.startsWith('db-') && name.endsWith('.json')).length
}

function directorySize(directory) {
  let total = 0
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    total += entry.isDirectory()
      ? directorySize(entryPath)
      : fs.statSync(entryPath).size
  }
  return total
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'local-data-desk-backup-test-'))
const dataDirectory = path.join(root, 'data')
const mediaDirectory = path.join(dataDirectory, 'media')
fs.mkdirSync(mediaDirectory, { recursive: true })

const dataFilePath = path.join(dataDirectory, 'db.json')
createDatabase(
  dataFilePath,
  Array.from({ length: 40 }, (_, index) => ({
    id: `record-${index}`,
    fullName: `Test ${index}`,
    notes: 'backup retention test',
  })),
)

try {
  const retentionManager = new BackupManager({
    dataFilePath,
    mediaDirectory,
    backupDirectory: path.join(root, 'retention-backup'),
    maxTotalBytes: 10 * 1024 * 1024,
  })

  for (let index = 0; index < MAX_SNAPSHOTS + 6; index += 1) {
    retentionManager.createSnapshot(`snapshot-${index}`, {
      syncMedia: false,
    })
    sleep(2)
  }

  const oldestSnapshots = retentionManager
    .getSnapshotFiles()
    .sort()
    .slice(0, 7)
  const oldTime = new Date(
    Date.now() - (RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000,
  )
  for (const name of oldestSnapshots) {
    fs.utimesSync(
      path.join(retentionManager.databaseBackupDirectory, name),
      oldTime,
      oldTime,
    )
  }

  retentionManager.createSnapshot('retention-check', { syncMedia: false })
  assert.ok(snapshotCount(retentionManager) <= MAX_SNAPSHOTS)

  const sizeManager = new BackupManager({
    dataFilePath,
    mediaDirectory,
    backupDirectory: path.join(root, 'size-backup'),
    maxTotalBytes: 12 * 1024,
  })
  sizeManager.ensureDirectories()

  const orphanMediaPath = path.join(mediaDirectory, 'orphan.png')
  fs.writeFileSync(orphanMediaPath, Buffer.alloc(16 * 1024, 1))
  sizeManager.copyMediaFile(orphanMediaPath)

  for (let index = 0; index < 12; index += 1) {
    sizeManager.createSnapshot(`size-${index}`, { syncMedia: false })
    sleep(2)
  }

  assert.ok(directorySize(sizeManager.backupDirectory) <= sizeManager.maxTotalBytes)
  assert.ok(fs.existsSync(sizeManager.latestPath))
  assert.equal(
    fs.existsSync(path.join(sizeManager.mediaBackupDirectory, 'orphan.png')),
    false,
  )

  console.log('Backup retention test passed')
  console.log(`快照数量策略：${MAX_SNAPSHOTS} 个 / ${RETENTION_DAYS} 天`)
  console.log(`容量上限测试：${sizeManager.maxTotalBytes} bytes`)
} finally {
  fs.rmSync(root, { recursive: true, force: true })
}
