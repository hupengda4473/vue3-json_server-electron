<script setup>
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  FolderOpen,
  HardDrive,
  RefreshCw,
} from 'lucide-vue-next'
import { onMounted, ref } from 'vue'

const targets = ref([])
const loading = ref(true)
const backingUp = ref(false)
const errorMessage = ref('')
const notice = ref('')
const hasDesktopApi = Boolean(window.desktopAPI)

function formatDate(value) {
  if (!value) return '尚未备份'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatBytes(value) {
  if (!value) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const unitIndex = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  )
  return `${(value / 1024 ** unitIndex).toFixed(unitIndex > 1 ? 2 : 0)} ${units[unitIndex]}`
}

async function loadStatus() {
  loading.value = true
  errorMessage.value = ''

  if (!hasDesktopApi) {
    errorMessage.value = '浏览器开发模式无法读取 Electron 多目标备份状态，请使用 npm run dev。'
    loading.value = false
    return
  }

  try {
    targets.value = await window.desktopAPI.getBackupStatus()
  } catch (error) {
    errorMessage.value = `读取备份状态失败：${error.message}`
  } finally {
    loading.value = false
  }
}

async function runBackup() {
  backingUp.value = true
  errorMessage.value = ''
  notice.value = ''

  try {
    targets.value = await window.desktopAPI.createBackup()
    notice.value = '数据库快照已写入所有当前可用的备份目标。'
  } catch (error) {
    errorMessage.value = `手动备份失败：${error.message}`
    await loadStatus()
  } finally {
    backingUp.value = false
  }
}

async function openTarget(target) {
  const error = await window.desktopAPI.openBackupFolder(target.id)
  if (error) {
    errorMessage.value = `无法打开备份目录：${error}`
  }
}

onMounted(loadStatus)
</script>

<template>
  <div class="page-view backup-page">
    <header class="page-header">
      <div>
        <p class="page-kicker">BACKUP TARGETS</p>
        <h1>备份中心</h1>
        <p class="page-subtitle">同时维护本地备份和模拟移动硬盘备份</p>
      </div>

      <div class="page-actions">
        <button
          class="button secondary"
          type="button"
          :disabled="loading || backingUp"
          @click="loadStatus"
        >
          <RefreshCw :size="17" :class="{ spinning: loading }" />
          刷新状态
        </button>
        <button
          class="button primary"
          type="button"
          :disabled="!hasDesktopApi || backingUp"
          @click="runBackup"
        >
          <Archive :size="17" />
          {{ backingUp ? '备份中...' : '立即备份' }}
        </button>
      </div>
    </header>

    <div v-if="notice" class="inline-notice success">
      <CheckCircle2 :size="18" />
      {{ notice }}
    </div>
    <div v-if="errorMessage" class="inline-notice error">
      <AlertTriangle :size="18" />
      {{ errorMessage }}
    </div>

    <section v-if="loading" class="loading-state">
      <span class="spinner"></span>
      <p>正在读取备份目标</p>
    </section>

    <section v-else class="backup-target-grid">
      <article
        v-for="target in targets"
        :key="target.id"
        class="backup-target-card"
      >
        <div class="backup-target-header">
          <div class="backup-target-icon" :class="target.status">
            <HardDrive :size="22" />
          </div>
          <div>
            <span class="backup-target-label">{{ target.label }}</span>
            <h2>{{ target.required ? '主备份' : '第二备份' }}</h2>
          </div>
          <span class="backup-status" :class="target.status">
            {{ target.status === 'online' ? '可用' : '离线' }}
          </span>
        </div>

        <code class="backup-path">{{ target.directory }}</code>

        <div class="backup-stats">
          <div>
            <span>最近备份</span>
            <strong>{{ formatDate(target.lastBackupAt) }}</strong>
          </div>
          <div>
            <span>数据库快照</span>
            <strong>{{ target.snapshotCount }}</strong>
          </div>
          <div>
            <span>备份图片</span>
            <strong>{{ target.mediaFiles }}</strong>
          </div>
          <div>
            <span>存储占用 / 上限</span>
            <strong
              :class="{ 'limit-warning': target.sizeLimitExceeded }"
            >
              {{ formatBytes(target.totalBytes) }} /
              {{ formatBytes(target.maxTotalBytes) }}
            </strong>
          </div>
        </div>

        <p v-if="target.sizeLimitExceeded" class="backup-error">
          已超过 10 GB，但当前数据引用的图片不能被安全删除。
        </p>
        <p v-if="target.error" class="backup-error">{{ target.error }}</p>

        <button
          class="button secondary backup-open-button"
          type="button"
          :disabled="!target.directory"
          @click="openTarget(target)"
        >
          <FolderOpen :size="16" />
          打开备份目录
        </button>
      </article>

      <div v-if="targets.length === 0 && !errorMessage" class="state-message">
        <h2>没有可用的备份目标</h2>
        <p>请检查备份目录和磁盘连接状态。</p>
      </div>
    </section>

    <section class="backup-explanation">
      <p class="section-kicker">HOW IT WORKS</p>
      <h2>多地址备份策略</h2>
      <p>
        除图片文件操作外，每次 JSON 数据写入前都会创建快照。主备份路径为
        `E:\vue3+json_server+electron\数据备份`，第二备份路径为
        `E:\vue3+json_server+electron\数据备份2`。每次 JSON 数据写入前会同时创建数据库快照，图片上传后会复制到所有可用目标。
      </p>
      <p>
        每个备份目标采用“最近 60 个快照 + 30 天”的保留策略，并限制为 10 GB。超过上限时先删除最老的数据库快照，再删除未被任何保留快照引用的旧图片；当前最新数据正在引用的图片不会被删除。
      </p>
      <p>
        第二备份离线不会阻止应用运行，但主备份失败时会拒绝联系人写入。实际接入移动硬盘时，只需将第二路径改成移动硬盘挂载目录。
      </p>
    </section>
  </div>
</template>
