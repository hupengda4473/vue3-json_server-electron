# 本地数据台

本地数据台是一个基于 Vue 3、Vite、Vue Router、JSON Server 和 Electron 的本地数据管理示例。

应用不需要单独安装数据库服务。Electron 主进程会在本机回环地址启动 JSON Server，数据、图片和备份都保存在本机。项目包含联系人台账、项目记录、数据概览、数据结构说明和备份中心五个页面。

## 功能

- Vue 3 + Vite 联系人管理界面
- Vue Router Hash 路由，兼容 Electron `file://` 启动
- JSON Server 本地 HTTP API
- Electron 桌面应用与 Windows 安装包
- 联系人创建、读取、更新、删除
- 项目 `projects` 集合创建、读取、更新、删除
- 数据概览、状态分布和最近更新
- 当前数据结构和多集合分类说明
- 带快照与无快照请求封装及示例页面
- 联系人图片上传、预览、更换和移除
- 图片文件与联系人元数据分开存储
- `db.json` 原子写入
- 启动时自动备份
- 数据修改前自动快照
- 修改成功后更新 `latest.json`
- 图片文件同步备份
- 两个备份目标并行写入
- 备份中心查看状态、打开目录和手动备份
- 本地数据目录和备份目录快捷入口
- 全屏运行，并提供“退出应用”按钮
- CRUD、图片上传、原子写入和自动备份冒烟测试

## 技术栈

- Vue 3
- Vite
- Vue Router 4
- JSON Server 0.17
- lowdb 1
- Electron
- Express
- Multer
- electron-builder

## 核心配置说明

本节集中说明当前项目的关键配置。修改配置后通常需要重新启动开发服务或重新打包。

### 打包配置

配置文件：[package.json](E:/json_DB/package.json)

```json
{
  "name": "local-data-desk",
  "version": "1.0.0",
  "main": "electron/main.cjs",
  "build": {
    "appId": "com.localdatadesk.app",
    "productName": "本地数据台",
    "artifactName": "LocalDataDesk-${version}-${arch}.${ext}",
    "directories": {
      "output": "release"
    },
    "extraResources": [
      {
        "from": "electron/db.template.json",
        "to": "db.template.json"
      }
    ],
    "win": {
      "icon": "public/image/logo.png",
      "signAndEditExecutable": false,
      "target": [
        {
          "target": "nsis",
          "arch": [
            "x64"
          ]
        }
      ]
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "installerIcon": "build/installerIcon.ico",
      "uninstallerIcon": "build/uninstallerIcon.ico",
      "installerHeaderIcon": "build/installerHeaderIcon.ico"
    },
    "afterPack": "scripts/after-pack.cjs"
  }
}
```

字段说明：

| 配置 | 作用 |
| --- | --- |
| `name` | npm 包名称，同时影响默认 Electron `userData` 目录名 |
| `version` | 应用和安装包版本 |
| `main` | Electron 主进程入口 |
| `appId` | Windows 应用身份标识，正式发布后应保持稳定 |
| `productName` | 安装后的显示名称，生成 `本地数据台.exe` |
| `artifactName` | 安装包文件名模板 |
| `directories.output` | 安装包和解包目录，当前为 `release/` |
| `extraResources` | 将桌面数据库模板复制到安装包资源目录 |
| `win.icon` | 应用图标源文件，当前为 `public/image/logo.png` |
| `signAndEditExecutable` | 当前为 `false`，避免 Electron Builder 触发 `winCodeSign` 符号链接问题；图标由 `afterPack` 钩子写入 |
| `win.target` | Windows 目标为 NSIS，只生成 x64 |
| `afterPack` | 打包后调用本地 `rcedit` 写入 `.exe` 图标和版本信息 |
| `nsis.oneClick` | `false` 表示使用带安装向导的安装方式 |
| `nsis.allowToChangeInstallationDirectory` | 允许用户修改安装目录 |
| `nsis.createDesktopShortcut` | 创建桌面快捷方式 |
| `nsis.createStartMenuShortcut` | 创建开始菜单快捷方式 |
| `nsis.installerIcon` | 安装包图标，保持原始 Electron 图标 |
| `nsis.uninstallerIcon` | 卸载程序图标，保持原始 Electron 图标 |
| `nsis.installerHeaderIcon` | 安装向导标题图标，保持原始 Electron 图标 |

当前打包流程：

```bash
npm run build
npm run prepare:icons
electron-builder --win nsis
```

`prepare:icons` 使用 Electron Builder 自带的 `app-builder icon`：

1. 从 `public/image/logo.png` 生成 `build/app-icon.ico`。
2. 检查项目内置的 `build/tools/rcedit-x64.exe` 是否存在。

`afterPack` 使用本地 `rcedit` 直接修改：

```text
release\win-unpacked\本地数据台.exe
```

写入内容：

- 应用图标
- `FileVersion`
- `ProductVersion`
- `ProductName`
- `FileDescription`
- `CompanyName`
- `InternalName`
- `OriginalFilename`
- `requestedExecutionLevel = asInvoker`

项目不再依赖 Electron Builder 解压完整的 `winCodeSign` 安装包，因此不会因为其中两个 macOS 符号链接缺少权限而失败。

安装包使用 `build/installerIcon.ico`、`build/uninstallerIcon.ico` 和
`build/installerHeaderIcon.ico`，不会被 `win.icon` 覆盖。

三个安装图标从 `electron.exe` 的 256×256 原始 Electron 图标生成，因此安装包和卸载程序保持原来的 Electron 图标。

### 备份保留配置

配置文件：[backup-manager.cjs](E:/json_DB/electron/backup-manager.cjs)

```js
const BACKUP_DIRECTORY = 'E:\\vue3+json_server+electron\\数据备份'
const BACKUP_DIRECTORY_2 = 'E:\\vue3+json_server+electron\\数据备份2'
const MAX_SNAPSHOTS = 60
const RETENTION_DAYS = 30
const MAX_TOTAL_BYTES = 10 * 1024 * 1024 * 1024
```

含义：

| 配置 | 当前值 | 作用 |
| --- | --- | --- |
| `BACKUP_DIRECTORY` | `E:\vue3+json_server+electron\数据备份` | 主备份目录 |
| `BACKUP_DIRECTORY_2` | `E:\vue3+json_server+electron\数据备份2` | 第二备份目录，可替换为移动硬盘路径 |
| `MAX_SNAPSHOTS` | `60` | 最近 60 个数据库快照始终保留 |
| `RETENTION_DAYS` | `30` | 超过 60 个的快照超过 30 天后可删除 |
| `MAX_TOTAL_BYTES` | `10 GB` | 每个备份目录的最大总占用 |

完整策略：

1. 最近 60 个 `db-*.json` 快照始终保留。
2. 超过 60 个的快照，只有超过 30 天才删除。
3. 如果单个备份目录总占用超过 10 GB，先删除最老的数据库快照。
4. 数据库快照删除后，再清理未被任何保留快照或 `latest.json` 引用的旧图片。
5. `latest.json` 不会被删除。
6. 当前最新数据仍在引用的图片不会被强制删除。
7. 如果仅最新数据本身超过 10 GB，备份中心会显示超限警告。

每个备份目标独立执行 10 GB 上限，因此两个目录可以各自使用最多 10 GB。

### Electron 窗口与服务配置

配置文件：[main.cjs](E:/json_DB/electron/main.cjs)

主要配置：

```js
new BrowserWindow({
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
```

说明：

- `fullscreen: true`：启动后直接全屏。
- `show: false`：窗口加载完成后才显示，减少白屏。
- `autoHideMenuBar: true`：隐藏默认 Electron 菜单栏。
- `contextIsolation: true`：隔离页面上下文。
- `nodeIntegration: false`：页面不能直接访问 Node.js。
- `sandbox: true`：启用渲染进程沙箱。
- `preload.cjs`：只向页面暴露受控 IPC 方法。
- Electron 使用单实例锁，避免同一用户同时打开两个写入实例。
- JSON Server 仅监听 `127.0.0.1`，端口由系统随机分配。
- 桌面 API 地址通过页面 Query String 注入，不硬编码随机端口。

### HTTP 请求配置

配置文件：[request.js](E:/json_DB/src/http/request.js)

API 地址解析顺序：

```text
1. 页面 Query String 的 apiBase
2. VITE_API_BASE_URL
3. http://127.0.0.1:3001
```

支持的 HTTP 方法：

```text
GET
POST
PUT
PATCH
DELETE
```

快照策略：

```js
await http.post('/records', data, {
  snapshot: true,
})

await http.patch(`/records/${id}`, data, {
  snapshot: false,
})
```

- `snapshot` 默认为 `true`。
- 写请求自动设置 `X-Data-Snapshot: required` 或 `skip`。
- `/api/media` 图片接口自动排除数据库快照请求头。
- JSON 请求自动设置 `Content-Type: application/json`。
- FormData 请求不会手动设置 `Content-Type`，由浏览器生成 boundary。
- 非 2xx 响应会读取 `error` 或 `message` 并抛出统一错误。

### 图片上传配置

配置文件：[main.cjs](E:/json_DB/electron/main.cjs)

```js
{
  fileSize: 8 * 1024 * 1024,
  files: 1,
}
```

- 单张图片最大 8 MB。
- 单次只接受 1 个文件。
- 支持 PNG、JPEG、WebP、GIF。
- 通过文件头检测真实格式，不只看扩展名。
- 图片文件名使用 UUID。
- 图片写入 `data/media`，JSON 只保存相对路径和元数据。
- 未被记录引用且超过 30 天的源图片会在应用启动时清理。

### 环境变量

| 环境变量 | 作用 |
| --- | --- |
| `VITE_API_BASE_URL` | 浏览器开发模式下的 JSON Server 地址 |
| `LOCAL_DATA_DESK_BACKUP_DIRECTORY` | 覆盖主备份目录，用于测试或部署 |
| `LOCAL_DATA_DESK_BACKUP_DIRECTORY_2` | 覆盖第二备份目录 |
| `LOCAL_DATA_DESK_SMOKE_USER_DATA` | 冒烟测试使用隔离用户数据目录 |
| `LOCAL_DATA_DESK_SMOKE_RESULT` | 冒烟测试结果文件路径 |

`npm run test:desktop` 会自动使用：

```text
.smoke-user-data
.smoke-backups
.smoke-backups-2
```

不会修改正式桌面数据。

## 运行环境

开发环境：

- Windows 10 或 Windows 11
- Node.js 20 或更高版本
- npm

运行安装后的桌面应用不需要单独安装 Node.js、npm、JSON Server 或数据库。

## 安装依赖

```bash
npm install
```

## 开发运行

启动 Electron 桌面开发版：

```bash
npm run dev
```

该命令会同时启动 Vite 和 Electron。JSON Server 由 Electron 主进程启动，监听 `127.0.0.1` 上的随机端口。

只启动浏览器开发模式：

```bash
npm run dev:web
```

浏览器模式使用项目根目录中的 `db.json`，接口地址为 `http://127.0.0.1:3001`。

注意：`npm run dev:web` 使用 JSON Server CLI，不包含 Electron 主进程中的图片上传接口和自动备份逻辑。完整功能请使用 `npm run dev`。

## 常用命令

```bash
npm run dev          # Electron 桌面开发模式
npm run dev:web      # 浏览器和 JSON Server 开发模式
npm run build        # 构建 Vue 前端
npm run prepare:icons # 从 logo.png 生成应用 ICO
npm run test:crud    # 测试 JSON Server 基本增删改查
npm run test:backup  # 测试 60 个/30 天策略和容量上限
npm run test:desktop # 测试 Electron、原子写入、备份和图片上传
npm run package:win  # 生成 Windows 安装包
```

`npm run test:desktop` 使用 `.smoke-user-data`、`.smoke-backups` 和 `.smoke-backups-2`，不会修改正式应用数据。测试不会生成安装包。

## 目录结构

```text
electron/
  main.cjs                 Electron 主进程、JSON Server 和图片上传接口
  preload.cjs              渲染进程安全 IPC 桥接
  atomic-file-sync.cjs     原子写入适配器
  backup-manager.cjs       自动快照、图片同步和备份清单
  db.template.json         桌面数据库初始模板
scripts/
  crud-smoke-test.cjs      JSON Server CRUD 冒烟测试
  backup-retention-test.cjs 备份保留和 10 GB 上限测试
  prepare-icons.cjs       生成 build/app-icon.ico
  after-pack.cjs          使用 rcedit 写入应用图标和版本信息
build/
  installerIcon.ico       原始 Electron 安装包图标
  uninstallerIcon.ico     原始 Electron 卸载程序图标
  installerHeaderIcon.ico 安装向导图标
  app-icon.ico            打包时生成的本地数据台 ICO
  tools/rcedit-x64.exe    本地可执行文件资源编辑器
src/
  api/
    drafts.js              快照/无快照演示方法
    records.js             联系人 API、图片 API 和图片 URL
    projects.js            项目集合 API
  http/
    request.js             统一 HTTP 请求、错误处理和快照策略
  components/
    RecordModal.vue        联系人表单和图片上传
    ProjectModal.vue       项目表单
    ConfirmDialog.vue      删除确认弹窗
  router/
    index.js               Vue Router 配置
  views/
    ContactsView.vue       联系人台账
    ProjectsView.vue       项目集合
    OverviewView.vue       数据概览
    DataStructureView.vue  数据结构与分类说明
    BackupView.vue         多目标备份中心
    ApiExamplesView.vue     快照策略和请求示例
  App.vue                  应用外壳和侧边导航
  style.css                页面样式
db.json                    浏览器开发模式数据库
```

## 桌面数据目录

默认正式数据目录：

```text
C:\Users\<用户名>\AppData\Roaming\local-data-desk\data
```

目录结构：

```text
data/
  db.json
  media/
    <UUID>.png
    <UUID>.jpg
    <UUID>.webp
    <UUID>.gif
```

`db.json` 保存联系人、状态、备注和图片元数据。图片二进制文件保存在 `media` 目录中。

应用左下角提供：

- 打开数据目录
- 打开备份目录
- 退出应用

### 修改正式数据和图片存储位置

正式数据库和图片目录由 [main.cjs](E:/json_DB/electron/main.cjs) 的 `ensureDatabase()` 决定。

当前代码：

```js
function ensureDatabase() {
  const dataDirectory = path.join(app.getPath('userData'), 'data')
  dataFilePath = path.join(dataDirectory, 'db.json')
  mediaDirectory = path.join(dataDirectory, 'media')
}
```

当前默认位置：

```text
C:\Users\<用户名>\AppData\Roaming\local-data-desk\data\
  db.json
  media\
```

如果要修改到固定磁盘目录，可以改成：

```js
function ensureDatabase() {
  const dataDirectory = 'D:\\LocalDataDesk\\data'
  dataFilePath = path.join(dataDirectory, 'db.json')
  mediaDirectory = path.join(dataDirectory, 'media')

  fs.mkdirSync(dataDirectory, { recursive: true })
  fs.mkdirSync(mediaDirectory, { recursive: true })

  // 后续数据库初始化和校验逻辑保持不变
}
```

如果希望放在当前用户文档目录：

```js
const dataDirectory = path.join(
  app.getPath('documents'),
  'LocalDataDesk',
  'data',
)
```

修改后路径会变成：

```text
C:\Users\<用户名>\Documents\LocalDataDesk\data\db.json
```

注意：

- 数据库路径和图片路径应保持在同一 `dataDirectory` 下。
- 应用不会自动迁移旧目录中的 `db.json` 和 `media`，需要手动复制。
- 不要把正式数据库放在难以写入的 `Program Files` 安装目录。
- 修改代码后需要重新启动开发应用或重新打包。
- 只修改数据目录不会改变两个备份目录。

也可以只移动整个 Electron `userData` 根目录，但这会同时影响缓存、本地存储和单实例锁等数据：

```js
const customUserData = 'D:\\LocalDataDesk\\user-data'
fs.mkdirSync(customUserData, { recursive: true })
app.setPath('userData', customUserData)
```

`app.setPath('userData', ...)` 应在创建窗口、启动 JSON Server 和调用 `app.getPath('userData')` 之前执行。

### 修改备份数据位置

备份路径由 [backup-manager.cjs](E:/json_DB/electron/backup-manager.cjs) 顶部的两个常量决定：

```js
const BACKUP_DIRECTORY = 'E:\\vue3+json_server+electron\\数据备份'
const BACKUP_DIRECTORY_2 = 'E:\\vue3+json_server+electron\\数据备份2'
```

修改主备份目录：

```js
const BACKUP_DIRECTORY = 'D:\\LocalDataDesk\\backup-primary'
```

修改第二备份目录，例如移动硬盘：

```js
const BACKUP_DIRECTORY_2 = 'F:\\LocalDataDesk\\backup-mobile'
```

修改后需要确保磁盘和目录可写。应用会使用 `fs.mkdirSync(..., { recursive: true })` 自动创建缺失的多层文件夹。

也可以不修改代码，通过环境变量覆盖：

```powershell
$env:LOCAL_DATA_DESK_BACKUP_DIRECTORY='D:\LocalDataDesk\backup-primary'
$env:LOCAL_DATA_DESK_BACKUP_DIRECTORY_2='F:\LocalDataDesk\backup-mobile'
npm run dev
```

环境变量说明：

| 环境变量 | 对应目录 |
| --- | --- |
| `LOCAL_DATA_DESK_BACKUP_DIRECTORY` | 主备份目录 |
| `LOCAL_DATA_DESK_BACKUP_DIRECTORY_2` | 第二备份目录 |

正式打包后的应用不会自动继承当前 PowerShell 临时环境变量。要长期使用固定路径，直接修改代码常量，或者在系统环境变量中配置后启动应用。

如果主备份目录无法创建或写入，会回退到：

```text
%APPDATA%\local-data-desk\backups
```

第二备份不可用时只会标记为离线，不会阻止应用运行。

修改备份路径不会自动复制旧备份。需要保留历史备份时，手动将原备份目录中的 `db` 和 `media` 复制到新目录。

备份目录结构：

```text
backup-primary\
  backup-manifest.json
  db\
  media\

backup-mobile\
  backup-manifest.json
  db\
  media\
```

修改备份路径后建议：

1. 启动应用。
2. 打开“备份中心”。
3. 确认两个目标均为“可用”。
4. 点击“立即备份”。
5. 检查两个新目录中是否生成 `db`、`media` 和 `backup-manifest.json`。

## 页面与路由

路由使用 `createWebHashHistory()`，确保桌面应用通过 `file://` 加载时仍可正常导航。

```text
/          联系人台账
/projects  项目记录
/overview  数据概览
/schema    数据结构
/backups   备份中心
/api-examples 快照请求示例
```

浏览器开发模式下地址示例：

```text
http://127.0.0.1:5173/#/projects
```

桌面应用内部通过 Query String 注入本地 JSON Server 的随机端口，因此路由地址不会包含 API 端口。

## records 与 projects

当前桌面数据库根对象包含三个同级集合：

```json
{
  "records": [],
  "projects": [],
  "drafts": []
}
```

- `records`：联系人数据。
- `projects`：项目数据。
- `drafts`：请求示例页使用的临时草稿集合。
- 图片文件：独立保存在 `data/media`。

JSON Server 会根据顶层数组自动生成接口：

```text
GET    /records
POST   /records
PATCH  /records/:id
DELETE /records/:id

GET    /projects
POST   /projects
PATCH  /projects/:id
DELETE /projects/:id

GET    /drafts
POST   /drafts
DELETE /drafts/:id
```

新增 `projects` 后，联系人对象本身不会被改写，只是在数据库根对象中增加一个同级数组。旧桌面数据库启动时会自动补充空的 `projects` 数组，并在迁移前创建启动备份。

## 分类原则

不同业务实体应使用不同顶层集合；同一实体的不同状态应使用字段区分。

合理示例：

```json
{
  "records": [
    {
      "id": "record-001",
      "fullName": "林晓",
      "companyId": "company-001",
      "categoryId": "customer",
      "status": "active"
    }
  ],
  "projects": [
    {
      "id": "project-001",
      "name": "品牌官网升级",
      "ownerRecordId": "record-001",
      "status": "in_progress"
    }
  ],
  "companies": [],
  "categories": [],
  "activities": []
}
```

不建议的示例：

```json
{
  "contacts": [],
  "activeContacts": [],
  "leadContacts": [],
  "projects": [],
  "myProjects": []
}
```

联系人状态应使用 `status` 字段，不应为每个状态创建新集合。不同实体之间通过 ID 关联，例如 `companyId`、`ownerRecordId` 和 `recordId`。

## 联系人数据结构

示例：

```json
{
  "records": [
    {
      "id": "record-001",
      "fullName": "林晓",
      "company": "远山设计",
      "phone": "138 0000 1201",
      "email": "lin.xiao@example.com",
      "status": "active",
      "notes": "负责品牌升级项目",
      "image": {
        "path": "media/3ac86d8c-ffb8-4d3c-b119-cabaa0fa5237.png",
        "mimeType": "image/png",
        "size": 127,
        "originalName": "avatar.png"
      },
      "createdAt": "2026-11-16T03:00:00.000Z",
      "updatedAt": "2026-11-16T03:10:00.000Z"
    }
  ]
}
```

图片路径使用相对路径 `media/<文件名>`，不保存本机绝对路径，也不保存随机 JSON Server 端口。

## 图片上传

图片上传流程：

1. 前端校验文件类型和大小。
2. 图片通过 `multipart/form-data` 上传到 `/api/media`。
3. 服务端再次检查文件头和真实图片格式。
4. 使用 UUID 生成文件名。
5. 图片写入 `data/media`。
6. 图片同步复制到备份目录。
7. 联系人保存时，仅将图片元数据写入 `db.json`。

限制：

- 支持 PNG、JPEG、WebP、GIF
- 单张最大 8 MB
- 不接受 SVG，避免脚本注入风险
- 原始文件名只作为元数据保存，不作为磁盘文件名
- 图片通过 `/media/<文件名>` 只读访问

替换图片或删除联系人时，旧图片文件会尝试删除。未被任何记录引用且超过 30 天的图片会在应用启动时清理。备份目录中的图片不会被主动删除，方便恢复。

## 原子写入

lowdb 默认的 `FileSync` 适配器直接覆盖目标文件。如果写入过程中断电、进程崩溃或被强制结束，可能留下不完整 JSON。

本项目使用 [atomic-file-sync.cjs](E:/json_DB/electron/atomic-file-sync.cjs) 替换默认适配器：

1. 将新 JSON 写入同目录临时文件。
2. 调用 `fs.fsyncSync()` 将数据刷新到磁盘。
3. 使用 `fs.renameSync()` 原子替换正式 `db.json`。
4. Windows 文件被占用时进行有限重试。
5. 写入失败时保留原文件并清理临时文件。
6. 写入前解析序列化结果，避免写入无效 JSON。

图片上传也先写入 `.upload` 临时文件，再重命名为最终文件。

原子写入可以显著降低“半截 JSON”风险，但不能防止硬盘损坏、勒索软件、用户主动删除或整个磁盘丢失，因此仍然需要自动备份和外部副本。

## 自动备份

默认启用两个备份目标：

```text
E:\vue3+json_server+electron\数据备份
E:\vue3+json_server+electron\数据备份2
```

第一个路径是主备份。如果主备份无法创建或写入，会回退到：

```text
%APPDATA%\local-data-desk\backups
```

第二个路径模拟移动硬盘或第二块数据盘。第二备份不可用时只会标记为离线，不会阻止应用运行。

“备份中心”页面可以查看两个目标的：

- 在线或离线状态
- 实际备份路径
- 最近备份时间
- 快照数量
- 图片备份数量
- 最近错误

在备份中心点击“立即备份”会重新尝试连接所有目标并创建手动快照。

备份目录结构：

```text
数据备份/
  backup-manifest.json
  db/
    db-2026-11-16T03-09-26-783Z-startup.json
    db-2026-11-16T03-09-27-339Z-before-post.json
    db-2026-11-16T03-09-27-575Z-before-patch.json
    db-2026-11-16T03-09-27-691Z-before-delete.json
    latest.json
  media/
    <UUID>.png
```

`数据备份2` 使用相同结构：

```text
数据备份2/
  backup-manifest.json
  db/
  media/
```

自动备份时机：

- 应用启动并验证数据库后，向所有可用目标创建启动快照。
- 除图片上传和删除接口外，所有 JSON 数据集合的 `POST`、`PUT`、`PATCH`、`DELETE` 前，都会向所有目标创建修改前快照。
- 数据修改成功后，更新所有目标的 `latest.json`。
- 图片上传成功后，将图片复制到所有可用目标的 `media` 目录。
- 从旧版本数据库新增 `projects` 或 `drafts` 集合前，先创建启动备份和 `schema-upgrade` 快照。
- 应用退出时由正常写入流程保证最后一次成功修改已经生成快照。

当前和未来新增的顶层 JSON 集合都会经过同一规则，例如 `records`、`projects`、`companies`、`activities`。图片文件不是 `db.json` 中的数据写入，因此不会单独生成数据库快照，但上传后会同步到所有可用备份目标，删除时也保留备份副本。

如果主备份失败，本次数据写入会被拒绝，并返回“自动备份失败，已拒绝写入”。如果第二备份失败，只会记录离线状态并继续使用主备份。

如果图片无法同步到主备份目录，本次图片上传会取消，并删除刚写入的临时图片。第二备份失败不会取消上传。

## 快照策略 API

所有请求统一经过 [request.js](E:/json_DB/src/http/request.js)。`src/api` 只包含联系人、项目等业务资源方法，不再直接处理 `fetch`、请求头或错误响应。

```js
import { http } from './http/request'

await http.post('/records', {
  fullName: '新联系人',
  phone: '13800000000',
  status: 'active',
}, {
  snapshot: true,
})
```

资源 API 也支持可选配置：

```js
import { createRecord, updateRecord } from './api/records'

await createRecord(payload) // 默认生成快照
await updateRecord(id, payload, { snapshot: false }) // 跳过历史快照
```

两种封装最终发送不同的请求头：

```text
X-Data-Snapshot: required
X-Data-Snapshot: skip
```

服务端默认按 `required` 处理。只有精确传入 `skip` 时才不创建历史快照：

- `required`：写入前生成快照；失败则拒绝写入；成功后更新 `latest.json`。
- `skip`：不生成历史快照；仍使用原子写入；成功后更新 `latest.json`。
- 图片上传和图片删除接口不进入数据库快照流程。

请求示例页使用独立的 `drafts` 集合做真实调用演示：

```js
// src/api/drafts.js
export function createDraftWithSnapshot(draft) {
  return http.post('/drafts', draft, { snapshot: true })
}

export function createDraftWithoutSnapshot(draft) {
  return http.post('/drafts', draft, { snapshot: false })
}
```

打开 `/api-examples` 后，可以分别点击两个真实执行按钮，并检查主备份快照数量变化。

适合使用 `snapshot: false` 的场景：

- 自动保存的临时草稿。
- 可重新生成的数据。
- 高频 UI 状态或缓存元数据。
- 已经在一个批次开始前创建过快照的连续操作。

不应跳过快照的场景：

- 联系人、正式项目等用户手工录入的数据。
- 不可逆的删除或批量更新。
- 财务、合同、审计和高价值业务数据。

## 备份保留策略

每个备份目标独立执行以下策略：

- 最近 60 个数据库快照始终保留。
- 超过 60 个后，只有超过 30 天的旧快照才会被删除。
- 每个备份目标总占用上限为 10 GB。
- 超过 10 GB 时优先删除最老的数据库快照。
- 数据库快照删除后，再删除没有被任何保留快照或 `latest.json` 引用的旧图片。
- 当前最新数据仍在引用的图片不会为了满足容量上限而删除。
- 如果仅最新数据就超过 10 GB，备份中心会显示超限警告。
- 图片使用不可变 UUID 文件名，备份中已存在的图片不会重复复制。
- 备份目录中的旧图片不会因为联系人删除而立即删除。

`backup-manifest.json` 记录：

- 最近备份时间
- 备份原因
- 数据源路径
- 备份目录
- 联系人数量
- 数据库大小
- 数据库 SHA-256
- 快照数量
- 图片数量
- 当前总占用和 10 GB 上限
- 是否超过容量上限
- 保留策略

## 从备份恢复

恢复前先关闭应用。

示例：从 `latest.json` 恢复数据库。

1. 备份当前正式数据，避免恢复操作本身造成不可逆覆盖。
2. 打开备份目录中的 `db` 子目录。
3. 将 `latest.json` 或某个时间点快照复制到正式数据目录。
4. 将文件重命名为 `db.json`。
5. 将备份目录 `media` 中的必要图片复制回正式数据目录 `media`。
6. 启动应用。
7. 检查联系人数量和图片是否正常。

正式数据目录：

```text
%APPDATA%\local-data-desk\data
```

例如：

```text
E:\vue3+json_server+electron\数据备份\db\latest.json
  -> C:\Users\<用户名>\AppData\Roaming\local-data-desk\data\db.json
```

图片：

```text
E:\vue3+json_server+electron\数据备份\media\<UUID>.png
  -> C:\Users\<用户名>\AppData\Roaming\local-data-desk\data\media\<UUID>.png
```

`数据备份2` 中也可以使用同样的方式恢复。当主备份不可用时，从第二备份恢复：

```text
E:\vue3+json_server+electron\数据备份2\db\latest.json
  -> C:\Users\<用户名>\AppData\Roaming\local-data-desk\data\db.json
```

恢复的 `db.json` 必须是有效 JSON。应用启动时会验证，如果 JSON 损坏，会将损坏文件改名备份，然后重新使用 `db.template.json` 初始化。

## 外部备份建议

当前两个模拟备份目录都位于 `E:` 盘。如果该磁盘损坏、被格式化或遭遇勒索软件，正式数据和两份备份仍可能同时丢失。

建议：

- 实际部署时，将 `数据备份2` 路径改成移动硬盘、NAS 或其他物理磁盘。
- 定期将任一备份目录复制到云盘或离线存储。
- 定期实际执行一次恢复测试。
- 不要把正在运行的 `db.json` 直接放在 OneDrive、Dropbox 或网络共享目录中。
- 可以先让应用写本地数据，再将备份目录同步到云盘。
- 不要把 `db.json` 和多台电脑同时写入同一个网络文件。

## 升级和模板行为

应用升级后，只要以下配置保持一致，就会继续使用原数据：

- `package.json` 顶层 `name`
- Electron `userData` 路径
- `data/db.json` 路径
- 数据结构

`db.template.json` 只用于：

- 数据库不存在时初始化
- 数据库 JSON 损坏时，在备份损坏文件后重新初始化

已有有效 `db.json` 不会被新版模板覆盖或合并。

如果修改数据结构，应先自动备份，再增加显式的 `schemaVersion` 迁移逻辑。

## 测试

JSON Server CRUD 测试：

```bash
npm run test:crud
```

备份保留策略测试：

```bash
npm run test:backup
```

该测试使用较小的临时容量上限验证“超过上限时删除最老快照和未引用图片”的清理逻辑，不会写入正式备份目录。

完整桌面存储测试：

```bash
npm run test:desktop
```

桌面测试会验证：

- Electron 启动
- JSON Server 启动
- 图片上传
- 图片读取
- 联系人创建
- 联系人更新
- 联系人删除
- 图片文件清理
- `db.json` 原子写入
- 数据库快照
- `latest.json`
- 备份清单
- 图片备份
- `projects` 顶层集合创建、更新和删除
- 两个备份目标同时在线
- 图片同步到两个备份目录
- `X-Data-Snapshot: skip` 不增加历史快照数量

测试使用隔离目录，不修改正式应用数据。

## 构建和安装包

只构建前端：

```bash
npm run build
```

生成 Windows 安装包：

```bash
npm run package:win
```

输出目录：

```text
release/
```

当前 Windows 安装包为 x64。安装后的应用不需要 Node.js、npm 或独立 JSON Server。

安装后的 `本地数据台.exe` 和开发窗口图标使用：

```text
public/image/logo.png
```

安装包、卸载程序和安装向导继续使用原始 Electron 图标：

```text
build/installerIcon.ico
build/uninstallerIcon.ico
build/installerHeaderIcon.ico
```

`win.icon` 只控制安装后的应用可执行文件；NSIS 的 `installerIcon`、`uninstallerIcon` 和 `installerHeaderIcon` 单独控制安装程序。Electron Builder 会在打包时将 `logo.png` 转换为 Windows ICO 资源。

若 Windows 打包环境无法创建符号链接，需要启用 Windows 开发者模式或以管理员权限执行打包，否则 `winCodeSign` 解压可能失败。

## 安全与限制

- Electron 使用 `contextIsolation: true`、`nodeIntegration: false` 和 `sandbox: true`。
- JSON Server 只监听 `127.0.0.1` 随机端口。
- 应用使用单实例锁，避免同一用户同时启动多个写入实例。
- 上传接口限制文件大小、文件数量、文件头和扩展名。
- 不支持两台电脑同时写同一个 JSON 文件。
- JSON Server 适合本地示例和中小规模数据。
- 大量图片、高并发或多设备同步场景建议迁移到 SQLite 或服务器数据库，图片继续使用文件系统或对象存储。

## 常见问题

### 备份目录打不开

检查 `E:` 盘是否存在且可写。若自动回退，界面中的“打开备份目录”会打开实际备份目录。

### 应用无法保存联系人

如果提示自动备份失败，检查备份目录权限、磁盘空间和文件占用情况。应用会拒绝在没有有效前置快照的情况下写入联系人数据。

### 图片上传失败

检查：

- 文件是否为 PNG、JPEG、WebP 或 GIF
- 文件是否超过 8 MB
- 数据目录和备份目录是否可写
- 磁盘是否已满

### 数据库损坏

应用启动时会检测 JSON。损坏文件会保存为：

```text
db.json.broken-<时间戳>
```

随后使用最新安装包中的 `db.template.json` 初始化数据库。图片文件不会立即全部删除，仍可从 `media` 和备份目录恢复。

### 浏览器开发模式不能上传图片

`npm run dev:web` 不运行 Electron 主进程，因此没有图片上传接口。使用 `npm run dev` 测试完整功能。

### 能否把数据保存到其他位置

可以。修改 `electron/main.cjs` 中 `ensureDatabase()` 的数据目录，或在启动早期调用：

```js
app.setPath('userData', customUserDataPath)
```

修改路径后旧数据不会自动迁移，需要手动复制数据库和 `media` 目录，或者编写迁移逻辑。
