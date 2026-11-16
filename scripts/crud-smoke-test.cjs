const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const express = require('express')
const jsonServer = require('json-server')

const projectRoot = path.join(__dirname, '..')
const sourceDatabase = path.join(projectRoot, 'db.json')
const testDatabase = path.join(
  os.tmpdir(),
  `local-data-desk-crud-${process.pid}.json`,
)

function readDatabase() {
  return JSON.parse(fs.readFileSync(testDatabase, 'utf8'))
}

function startServer() {
  const serverApp = express()
  const router = jsonServer.router(testDatabase)

  serverApp.use(jsonServer.defaults({ logger: false }))
  serverApp.use(jsonServer.bodyParser)
  serverApp.use(router)

  return new Promise((resolve, reject) => {
    const server = serverApp.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve({ server, baseUrl: `http://127.0.0.1:${port}/records` })
    })

    server.on('error', reject)
  })
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  assert.ok(response.ok, `请求失败：${response.status} ${response.statusText}`)
  return response.status === 204 ? null : response.json()
}

async function run() {
  fs.copyFileSync(sourceDatabase, testDatabase)
  const initialCount = readDatabase().records.length
  const { server, baseUrl } = await startServer()
  const now = new Date().toISOString()

  try {
    const created = await request(baseUrl, {
      method: 'POST',
      body: JSON.stringify({
        fullName: 'CRUD 测试联系人',
        company: '本地测试',
        phone: '130 0000 0000',
        email: 'crud-test@example.com',
        status: 'lead',
        notes: '自动化冒烟测试记录',
        createdAt: now,
        updatedAt: now,
      }),
    })

    assert.equal(readDatabase().records.length, initialCount + 1)

    const updated = await request(`${baseUrl}/${created.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        fullName: 'CRUD 测试联系人（已更新）',
        status: 'active',
        updatedAt: new Date().toISOString(),
      }),
    })

    assert.equal(updated.fullName, 'CRUD 测试联系人（已更新）')
    assert.equal(updated.status, 'active')

    const persistedRecord = readDatabase().records.find(
      (record) => String(record.id) === String(created.id),
    )
    assert.equal(persistedRecord.fullName, 'CRUD 测试联系人（已更新）')

    await request(`${baseUrl}/${created.id}`, { method: 'DELETE' })

    const finalDatabase = readDatabase()
    assert.equal(finalDatabase.records.length, initialCount)
    assert.equal(
      finalDatabase.records.some(
        (record) => String(record.id) === String(created.id),
      ),
      false,
    )

    console.log('CRUD smoke test passed')
    console.log(`初始记录：${initialCount}`)
    console.log('创建：通过，并已写入测试 JSON 文件')
    console.log('更新：通过，并已写入测试 JSON 文件')
    console.log('删除：通过，测试记录已从 JSON 文件移除')
  } finally {
    await new Promise((resolve) => server.close(resolve))
    fs.rmSync(testDatabase, { force: true })
  }
}

run().catch((error) => {
  console.error(error)
  fs.rmSync(testDatabase, { force: true })
  process.exitCode = 1
})
