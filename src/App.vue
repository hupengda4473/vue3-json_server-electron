<script setup>
import {
  Archive,
  Braces,
  Database,
  FolderOpen,
  FolderKanban,
  HardDrive,
  LayoutDashboard,
  Power,
  Users,
} from 'lucide-vue-next'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { API_BASE_URL, listRecords } from './api/records'

const route = useRoute()
const recordCount = ref(0)
const desktopInfo = ref(null)

async function refreshCount() {
  try {
    recordCount.value = (await listRecords()).length
  } catch {
    recordCount.value = 0
  }
}

function handleRecordsChanged(event) {
  if (Number.isFinite(event.detail?.count)) {
    recordCount.value = event.detail.count
  }
}

async function openDataFolder() {
  if (!window.desktopAPI) return

  const error = await window.desktopAPI.openDataFolder()
  if (error) {
    console.error(`无法打开数据目录：${error}`)
  }
}

async function openBackupFolder() {
  if (!window.desktopAPI) return

  const error = await window.desktopAPI.openBackupFolder()
  if (error) {
    console.error(`无法打开备份目录：${error}`)
  }
}

async function quitApplication() {
  if (window.desktopAPI) {
    await window.desktopAPI.quitApp()
    return
  }

  window.close()
}

onMounted(async () => {
  await refreshCount()
  window.addEventListener('records-changed', handleRecordsChanged)

  if (window.desktopAPI) {
    try {
      desktopInfo.value = await window.desktopAPI.getAppInfo()
    } catch {
      desktopInfo.value = null
    }
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('records-changed', handleRecordsChanged)
})
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">
          <Database :size="21" stroke-width="2.1" />
        </div>
        <div class="brand-copy">
          <strong>本地数据台</strong>
          <span>LOCAL DATA DESK</span>
        </div>
      </div>

      <nav class="sidebar-nav" aria-label="主导航">
        <RouterLink
          to="/"
          class="nav-item"
          :class="{ active: route.name === 'contacts' }"
        >
          <Users :size="18" />
          <span>联系人台账</span>
          <span class="nav-count">{{ recordCount }}</span>
        </RouterLink>
        <RouterLink
          to="/projects"
          class="nav-item"
          :class="{ active: route.name === 'projects' }"
        >
          <FolderKanban :size="18" />
          <span>项目记录</span>
        </RouterLink>
        <RouterLink
          to="/overview"
          class="nav-item"
          :class="{ active: route.name === 'overview' }"
        >
          <LayoutDashboard :size="18" />
          <span>数据概览</span>
        </RouterLink>
        <RouterLink
          to="/schema"
          class="nav-item"
          :class="{ active: route.name === 'schema' }"
        >
          <Braces :size="18" />
          <span>数据结构</span>
        </RouterLink>
        <RouterLink
          to="/backups"
          class="nav-item"
          :class="{ active: route.name === 'backups' }"
        >
          <HardDrive :size="18" />
          <span>备份中心</span>
        </RouterLink>
      </nav>

      <div class="sidebar-meta">
        <div class="storage-note">
          <div class="storage-heading">
            <span class="live-dot"></span>
            <strong>JSON Server 已连接</strong>
          </div>
          <p>{{ desktopInfo ? '桌面持久化模式' : '浏览器开发模式' }}</p>
          <code>{{ desktopInfo?.dataFilePath || API_BASE_URL }}</code>
        </div>

        <button
          v-if="desktopInfo"
          class="folder-button"
          type="button"
          @click="openDataFolder"
        >
          <FolderOpen :size="17" />
          打开数据目录
        </button>

        <button
          v-if="desktopInfo"
          class="folder-button"
          type="button"
          title="打开备份目录"
          aria-label="打开备份目录"
          @click="openBackupFolder"
        >
          <Archive :size="17" />
          打开备份目录
        </button>

        <button
          v-if="desktopInfo"
          class="folder-button exit-button"
          type="button"
          title="退出应用"
          aria-label="退出应用"
          @click="quitApplication"
        >
          <Power :size="17" />
          退出应用
        </button>
      </div>
    </aside>

    <main class="workspace">
      <RouterView />
    </main>
  </div>
</template>
