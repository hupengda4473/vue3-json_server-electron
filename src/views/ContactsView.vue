<script setup>
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Mail,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
  Users,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  API_BASE_URL,
  createRecord,
  deleteContactImage,
  deleteRecord,
  getMediaUrl,
  listRecords,
  updateRecord,
} from '../api/records'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import RecordModal from '../components/RecordModal.vue'

const records = ref([])
const loading = ref(true)
const loadError = ref('')
const searchQuery = ref('')
const statusFilter = ref('all')
const sortBy = ref('updated-desc')
const modalOpen = ref(false)
const editingRecord = ref(null)
const saving = ref(false)
const deleteTarget = ref(null)
const deleting = ref(false)
const toast = ref(null)
let toastTimer = null

const statusMeta = {
  active: { label: '已联系', className: 'status-active' },
  lead: { label: '待跟进', className: 'status-lead' },
  inactive: { label: '已归档', className: 'status-inactive' },
}

const filteredRecords = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase()

  const result = records.value.filter((record) => {
    const matchesStatus =
      statusFilter.value === 'all' || record.status === statusFilter.value
    const searchableText = [
      record.fullName,
      record.company,
      record.phone,
      record.email,
      record.notes,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return matchesStatus && (!keyword || searchableText.includes(keyword))
  })

  return result.sort((first, second) => {
    if (sortBy.value === 'name-asc') {
      return first.fullName.localeCompare(second.fullName, 'zh-CN')
    }

    if (sortBy.value === 'company-asc') {
      return (first.company || '').localeCompare(second.company || '', 'zh-CN')
    }

    return new Date(second.updatedAt || 0) - new Date(first.updatedAt || 0)
  })
})

const activeCount = computed(
  () => records.value.filter((record) => record.status === 'active').length,
)
const leadCount = computed(
  () => records.value.filter((record) => record.status === 'lead').length,
)
const latestUpdate = computed(() => {
  const latest = records.value.reduce((current, record) => {
    const timestamp = new Date(record.updatedAt || 0).getTime()
    return Math.max(current, timestamp)
  }, 0)

  return latest ? formatDate(new Date(latest).toISOString()) : '暂无记录'
})

const resultSummary = computed(() => {
  if (filteredRecords.value.length === records.value.length) {
    return `共 ${records.value.length} 条记录`
  }

  return `筛选出 ${filteredRecords.value.length} / ${records.value.length} 条记录`
})

function formatDate(value) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function getInitial(name) {
  return name?.trim().charAt(0) || '?'
}

function showToast(message, type = 'success') {
  toast.value = { message, type }
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.value = null
  }, 2800)
}

async function loadRecords({ silent = false } = {}) {
  if (!silent) {
    loading.value = true
  }
  loadError.value = ''

  try {
    records.value = await listRecords()
    window.dispatchEvent(
      new CustomEvent('records-changed', {
        detail: { count: records.value.length },
      }),
    )
  } catch (error) {
    loadError.value = `无法读取本地数据：${error.message}`
  } finally {
    loading.value = false
  }
}

function openCreateModal() {
  editingRecord.value = null
  modalOpen.value = true
}

function openEditModal(record) {
  editingRecord.value = record
  modalOpen.value = true
}

function closeModal() {
  if (saving.value) return
  modalOpen.value = false
  editingRecord.value = null
}

async function saveRecord(payload) {
  saving.value = true
  const now = new Date().toISOString()
  const previousImage = editingRecord.value?.image

  try {
    if (editingRecord.value) {
      await updateRecord(editingRecord.value.id, {
        ...payload,
        updatedAt: now,
      })
      showToast('联系人信息已更新')
    } else {
      await createRecord({
        ...payload,
        createdAt: now,
        updatedAt: now,
      })
      showToast('联系人已创建')
    }

    if (previousImage?.path && previousImage.path !== payload.image?.path) {
      deleteContactImage(previousImage.path).catch((error) => {
        console.warn('旧联系人图片清理失败', error)
      })
    }

    modalOpen.value = false
    editingRecord.value = null
    await loadRecords({ silent: true })
  } catch (error) {
    showToast(`保存失败：${error.message}`, 'error')
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  if (!deleteTarget.value) return

  deleting.value = true
  const imageToDelete = deleteTarget.value.image

  try {
    await deleteRecord(deleteTarget.value.id)
    deleteTarget.value = null

    if (imageToDelete?.path) {
      deleteContactImage(imageToDelete.path).catch((error) => {
        console.warn('联系人图片清理失败', error)
      })
    }

    await loadRecords({ silent: true })
    showToast('记录已删除')
  } catch (error) {
    showToast(`删除失败：${error.message}`, 'error')
  } finally {
    deleting.value = false
  }
}

onMounted(async () => {
  await loadRecords()
})

onBeforeUnmount(() => {
  window.clearTimeout(toastTimer)
})
</script>

<template>
  <div class="page-view contacts-page">
    <header class="page-header">
        <div>
          <p class="page-kicker">LOCAL RECORDS</p>
          <h1>联系人台账</h1>
          <p class="page-subtitle">维护本地联系人、沟通状态与备注信息</p>
        </div>

        <div class="header-actions">
          <button
            class="button secondary icon-only-mobile"
            type="button"
            title="刷新数据"
            aria-label="刷新数据"
            :disabled="loading"
            @click="loadRecords()"
          >
            <RefreshCw :size="17" :class="{ spinning: loading }" />
            <span class="action-label">刷新</span>
          </button>
          <button class="button primary" type="button" @click="openCreateModal">
            <Plus :size="18" />
            <span>新建联系人</span>
          </button>
        </div>
      </header>

      <section class="metrics-grid" aria-label="数据概览">
        <article class="metric-card">
          <div class="metric-icon tone-green">
            <Users :size="21" />
          </div>
          <div>
            <span class="metric-label">全部联系人</span>
            <strong>{{ records.length }}</strong>
            <small>最近更新 {{ latestUpdate }}</small>
          </div>
        </article>

        <article class="metric-card">
          <div class="metric-icon tone-blue">
            <CheckCircle2 :size="21" />
          </div>
          <div>
            <span class="metric-label">已联系</span>
            <strong>{{ activeCount }}</strong>
            <small>保持沟通中的联系人</small>
          </div>
        </article>

        <article class="metric-card">
          <div class="metric-icon tone-amber">
            <UserRound :size="21" />
          </div>
          <div>
            <span class="metric-label">待跟进</span>
            <strong>{{ leadCount }}</strong>
            <small>需要安排下一次沟通</small>
          </div>
        </article>
      </section>

      <section class="records-panel">
        <div class="panel-toolbar">
          <label class="search-box">
            <Search :size="18" />
            <input
              v-model="searchQuery"
              type="search"
              placeholder="搜索姓名、公司、电话或备注"
              aria-label="搜索联系人"
            />
          </label>

          <div class="toolbar-controls">
            <label class="select-control">
              <span>状态</span>
              <select v-model="statusFilter">
                <option value="all">全部</option>
                <option value="active">已联系</option>
                <option value="lead">待跟进</option>
                <option value="inactive">已归档</option>
              </select>
            </label>

            <label class="select-control">
              <span>排序</span>
              <select v-model="sortBy">
                <option value="updated-desc">最近更新</option>
                <option value="name-asc">姓名</option>
                <option value="company-asc">公司</option>
              </select>
            </label>
          </div>
        </div>

        <div class="panel-meta">
          <span>{{ resultSummary }}</span>
          <span class="api-indicator">
            <span class="live-dot"></span>
            API {{ API_BASE_URL.replace('http://', '') }}
          </span>
        </div>

        <div v-if="loading" class="loading-state">
          <span class="spinner"></span>
          <p>正在读取本地记录</p>
        </div>

        <div v-else-if="loadError" class="state-message error-state">
          <AlertCircle :size="28" />
          <h2>数据读取失败</h2>
          <p>{{ loadError }}</p>
          <button class="button secondary" type="button" @click="loadRecords()">
            <RefreshCw :size="17" />
            重新连接
          </button>
        </div>

        <div v-else-if="filteredRecords.length === 0" class="state-message empty-state">
          <div class="empty-icon">
            <Users :size="27" />
          </div>
          <h2>{{ records.length ? '没有匹配的记录' : '还没有联系人' }}</h2>
          <p>
            {{
              records.length
                ? '调整搜索关键词或筛选条件后再试。'
                : '创建第一条联系人记录，数据会写入本地 JSON 文件。'
            }}
          </p>
          <button
            v-if="!records.length"
            class="button primary"
            type="button"
            @click="openCreateModal"
          >
            <Plus :size="18" />
            新建联系人
          </button>
        </div>

        <div v-else class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>联系人</th>
                <th>公司 / 组织</th>
                <th>联系方式</th>
                <th>状态</th>
                <th>更新时间</th>
                <th class="actions-heading">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="record in filteredRecords" :key="record.id">
                <td>
                  <div class="person-cell">
                    <span class="avatar">
                      {{ getInitial(record.fullName) }}
                      <img
                        v-if="record.image?.path"
                        :src="getMediaUrl(record.image.path)"
                        :alt="`${record.fullName} 的图片`"
                        @error="$event.currentTarget.remove()"
                      />
                    </span>
                    <div>
                      <strong>{{ record.fullName }}</strong>
                      <span>{{ record.notes || '暂无备注' }}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <div class="company-cell">
                    <Building2 :size="15" />
                    <span>{{ record.company || '—' }}</span>
                  </div>
                </td>
                <td>
                  <div class="contact-lines">
                    <span><Phone :size="14" />{{ record.phone }}</span>
                    <span><Mail :size="14" />{{ record.email || '未填写邮箱' }}</span>
                  </div>
                </td>
                <td>
                  <span
                    class="status-badge"
                    :class="statusMeta[record.status]?.className"
                  >
                    <span class="status-dot" :class="`status-${record.status}`"></span>
                    {{ statusMeta[record.status]?.label || record.status }}
                  </span>
                </td>
                <td>
                  <time class="date-cell" :datetime="record.updatedAt">
                    {{ formatDate(record.updatedAt) }}
                  </time>
                </td>
                <td>
                  <div class="row-actions">
                    <button
                      class="icon-button"
                      type="button"
                      title="编辑联系人"
                      aria-label="编辑联系人"
                      @click="openEditModal(record)"
                    >
                      <Pencil :size="16" />
                    </button>
                    <button
                      class="icon-button danger-icon-button"
                      type="button"
                      title="删除联系人"
                      aria-label="删除联系人"
                      @click="deleteTarget = record"
                    >
                      <Trash2 :size="16" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
  </div>

  <RecordModal
    v-if="modalOpen"
    :record="editingRecord"
    :saving="saving"
    @close="closeModal"
    @submit="saveRecord"
  />

  <ConfirmDialog
    v-if="deleteTarget"
    :record="deleteTarget"
    :deleting="deleting"
    @cancel="deleteTarget = null"
    @confirm="confirmDelete"
  />

  <Transition name="toast">
    <div v-if="toast" class="toast" :class="`toast-${toast.type}`" role="status">
      <CheckCircle2 v-if="toast.type === 'success'" :size="19" />
      <AlertCircle v-else :size="19" />
      <span>{{ toast.message }}</span>
    </div>
  </Transition>
</template>
