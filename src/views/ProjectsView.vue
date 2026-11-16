<script setup>
import {
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  FolderKanban,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  createProject,
  deleteProject,
  listProjects,
  updateProject,
} from '../api/projects'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import ProjectModal from '../components/ProjectModal.vue'

const projects = ref([])
const loading = ref(true)
const loadError = ref('')
const searchQuery = ref('')
const statusFilter = ref('all')
const modalOpen = ref(false)
const editingProject = ref(null)
const saving = ref(false)
const deleteTarget = ref(null)
const deleting = ref(false)
const toast = ref(null)
let toastTimer = null

const statusMeta = {
  planning: { label: '规划中', className: 'project-planning' },
  in_progress: { label: '进行中', className: 'project-progress' },
  paused: { label: '已暂停', className: 'project-paused' },
  done: { label: '已完成', className: 'project-done' },
}
const priorityLabels = { low: '低', medium: '中', high: '高' }
const filteredProjects = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase()
  return projects.value
    .filter((project) => {
      const matchesStatus =
        statusFilter.value === 'all' || project.status === statusFilter.value
      const searchable = [
        project.name,
        project.category,
        project.owner,
        project.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return matchesStatus && (!keyword || searchable.includes(keyword))
    })
    .sort(
      (first, second) =>
        new Date(second.updatedAt || 0) - new Date(first.updatedAt || 0),
    )
})
const activeCount = computed(
  () => projects.value.filter((project) => project.status === 'in_progress').length,
)
const doneCount = computed(
  () => projects.value.filter((project) => project.status === 'done').length,
)

function showToast(message, type = 'success') {
  toast.value = { message, type }
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.value = null
  }, 2800)
}

function formatDate(value) {
  if (!value) return '未设置'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(`${value}T00:00:00`))
}

async function loadProjects() {
  loading.value = true
  loadError.value = ''

  try {
    projects.value = await listProjects()
  } catch (error) {
    loadError.value = `无法读取 projects 集合：${error.message}`
  } finally {
    loading.value = false
  }
}

function openCreateModal() {
  editingProject.value = null
  modalOpen.value = true
}

function openEditModal(project) {
  editingProject.value = project
  modalOpen.value = true
}

function closeModal() {
  if (saving.value) return
  modalOpen.value = false
  editingProject.value = null
}

async function saveProject(payload) {
  saving.value = true
  const now = new Date().toISOString()

  try {
    if (editingProject.value) {
      await updateProject(editingProject.value.id, {
        ...payload,
        updatedAt: now,
      })
      showToast('项目已更新')
    } else {
      await createProject({
        ...payload,
        createdAt: now,
        updatedAt: now,
      })
      showToast('项目已创建')
    }

    modalOpen.value = false
    editingProject.value = null
    await loadProjects()
  } catch (error) {
    showToast(`保存失败：${error.message}`, 'error')
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true

  try {
    await deleteProject(deleteTarget.value.id)
    deleteTarget.value = null
    await loadProjects()
    showToast('项目已删除')
  } catch (error) {
    showToast(`删除失败：${error.message}`, 'error')
  } finally {
    deleting.value = false
  }
}

onMounted(loadProjects)
onBeforeUnmount(() => window.clearTimeout(toastTimer))
</script>

<template>
  <div class="page-view projects-page">
    <header class="page-header">
      <div>
        <p class="page-kicker">PROJECTS COLLECTION</p>
        <h1>项目记录</h1>
        <p class="page-subtitle">
          projects 是 records 的同级顶层集合，用于演示不同业务实体分开存储
        </p>
      </div>

      <div class="page-actions">
        <button class="button secondary" type="button" :disabled="loading" @click="loadProjects">
          <RefreshCw :size="17" :class="{ spinning: loading }" />
          刷新
        </button>
        <button class="button primary" type="button" @click="openCreateModal">
          <Plus :size="18" />
          新建项目
        </button>
      </div>
    </header>

    <section class="metrics-grid">
      <article class="metric-card">
        <div class="metric-icon tone-green">
          <FolderKanban :size="21" />
        </div>
        <div>
          <span class="metric-label">全部项目</span>
          <strong>{{ projects.length }}</strong>
          <small>存储在 projects 数组</small>
        </div>
      </article>
      <article class="metric-card">
        <div class="metric-icon tone-blue">
          <CircleDashed :size="21" />
        </div>
        <div>
          <span class="metric-label">进行中</span>
          <strong>{{ activeCount }}</strong>
          <small>当前执行中的项目</small>
        </div>
      </article>
      <article class="metric-card">
        <div class="metric-icon tone-amber">
          <CheckCircle2 :size="21" />
        </div>
        <div>
          <span class="metric-label">已完成</span>
          <strong>{{ doneCount }}</strong>
          <small>已归档的完成项目</small>
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
            placeholder="搜索项目、分类、负责人"
            aria-label="搜索项目"
          />
        </label>

        <label class="select-control">
          <span>状态</span>
          <select v-model="statusFilter">
            <option value="all">全部</option>
            <option value="planning">规划中</option>
            <option value="in_progress">进行中</option>
            <option value="paused">已暂停</option>
            <option value="done">已完成</option>
          </select>
        </label>
      </div>

      <div class="panel-meta">
        <span>共 {{ filteredProjects.length }} 个项目</span>
        <span class="api-indicator">JSON 路径 /projects</span>
      </div>

      <div v-if="loading" class="loading-state">
        <span class="spinner"></span>
        <p>正在读取项目集合</p>
      </div>

      <div v-else-if="loadError" class="state-message error-state">
        <h2>项目数据读取失败</h2>
        <p>{{ loadError }}</p>
      </div>

      <div v-else-if="filteredProjects.length === 0" class="state-message empty-state">
        <div class="empty-icon"><FolderKanban :size="27" /></div>
        <h2>没有项目记录</h2>
        <p>创建第一个项目，它会作为 projects 顶层数组中的一个对象保存。</p>
        <button class="button primary" type="button" @click="openCreateModal">
          <Plus :size="18" />
          新建项目
        </button>
      </div>

      <div v-else class="table-scroll">
        <table class="data-table project-table">
          <thead>
            <tr>
              <th>项目</th>
              <th>分类 / 负责人</th>
              <th>状态</th>
              <th>优先级</th>
              <th>计划完成</th>
              <th class="actions-heading">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="project in filteredProjects" :key="project.id">
              <td>
                <div class="project-name-cell">
                  <strong>{{ project.name }}</strong>
                  <span>{{ project.notes || '暂无备注' }}</span>
                </div>
              </td>
              <td>
                <div class="project-meta-cell">
                  <span>{{ project.category }}</span>
                  <small><UserRound :size="13" />{{ project.owner || '未指定' }}</small>
                </div>
              </td>
              <td>
                <span
                  class="status-badge"
                  :class="statusMeta[project.status]?.className"
                >
                  {{ statusMeta[project.status]?.label || project.status }}
                </span>
              </td>
              <td>
                <span class="priority-tag" :class="`priority-${project.priority}`">
                  {{ priorityLabels[project.priority] || '中' }}
                </span>
              </td>
              <td>
                <span class="project-date">
                  <CalendarDays :size="14" />
                  {{ formatDate(project.dueDate) }}
                </span>
              </td>
              <td>
                <div class="row-actions">
                  <button
                    class="icon-button"
                    type="button"
                    title="编辑项目"
                    aria-label="编辑项目"
                    @click="openEditModal(project)"
                  >
                    <Pencil :size="16" />
                  </button>
                  <button
                    class="icon-button danger-icon-button"
                    type="button"
                    title="删除项目"
                    aria-label="删除项目"
                    @click="deleteTarget = project"
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

  <ProjectModal
    v-if="modalOpen"
    :project="editingProject"
    :saving="saving"
    @close="closeModal"
    @submit="saveProject"
  />

  <ConfirmDialog
    v-if="deleteTarget"
    :record="{ fullName: deleteTarget.name }"
    :deleting="deleting"
    @cancel="deleteTarget = null"
    @confirm="confirmDelete"
  />

  <Transition name="toast">
    <div v-if="toast" class="toast" :class="`toast-${toast.type}`" role="status">
      <CheckCircle2 v-if="toast.type === 'success'" :size="19" />
      <span>{{ toast.message }}</span>
    </div>
  </Transition>
</template>
