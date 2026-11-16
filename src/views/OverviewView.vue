<script setup>
import {
  ArrowRight,
  Building2,
  Clock3,
  Image as ImageIcon,
  RefreshCw,
  Users,
} from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { listRecords } from '../api/records'
import { getMediaUrl } from '../utils/media'

const records = ref([])
const loading = ref(true)
const errorMessage = ref('')

const imageCount = computed(
  () => records.value.filter((record) => record.image?.path).length,
)
const companyCount = computed(
  () =>
    new Set(
      records.value.map((record) => record.company?.trim()).filter(Boolean),
    ).size,
)
const latestUpdate = computed(() => {
  const latest = records.value.reduce((value, record) => {
    return Math.max(value, new Date(record.updatedAt || 0).getTime())
  }, 0)
  return latest ? formatDate(new Date(latest).toISOString()) : '暂无记录'
})
const statusBuckets = computed(() => {
  const definitions = [
    { key: 'active', label: '已联系' },
    { key: 'lead', label: '待跟进' },
    { key: 'inactive', label: '已归档' },
  ]
  const total = Math.max(records.value.length, 1)

  return definitions.map((item) => {
    const count = records.value.filter(
      (record) => record.status === item.key,
    ).length
    return {
      ...item,
      count,
      percent: Math.round((count / total) * 100),
    }
  })
})
const recentRecords = computed(() =>
  [...records.value]
    .sort(
      (first, second) =>
        new Date(second.updatedAt || 0) - new Date(first.updatedAt || 0),
    )
    .slice(0, 5),
)

function formatDate(value) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

async function loadOverview() {
  loading.value = true
  errorMessage.value = ''

  try {
    records.value = await listRecords()
  } catch (error) {
    errorMessage.value = `读取数据失败：${error.message}`
  } finally {
    loading.value = false
  }
}

onMounted(loadOverview)
</script>

<template>
  <div class="page-view overview-page">
    <header class="page-header">
      <div>
        <p class="page-kicker">DATA OVERVIEW</p>
        <h1>数据概览</h1>
        <p class="page-subtitle">查看联系人结构、状态分布与最近更新</p>
      </div>

      <div class="page-actions">
        <button
          class="button secondary"
          type="button"
          :disabled="loading"
          @click="loadOverview"
        >
          <RefreshCw :size="17" :class="{ spinning: loading }" />
          刷新
        </button>
        <RouterLink class="button primary" to="/">
          联系人台账
          <ArrowRight :size="17" />
        </RouterLink>
      </div>
    </header>

    <div v-if="errorMessage" class="state-message error-state page-state">
      <h2>无法加载概览</h2>
      <p>{{ errorMessage }}</p>
    </div>

    <template v-else>
      <section class="metrics-grid overview-metrics" aria-label="数据指标">
        <article class="metric-card">
          <div class="metric-icon tone-green">
            <Users :size="21" />
          </div>
          <div>
            <span class="metric-label">联系人</span>
            <strong>{{ loading ? '—' : records.length }}</strong>
            <small>最近更新 {{ latestUpdate }}</small>
          </div>
        </article>

        <article class="metric-card">
          <div class="metric-icon tone-blue">
            <ImageIcon :size="21" />
          </div>
          <div>
            <span class="metric-label">已上传图片</span>
            <strong>{{ loading ? '—' : imageCount }}</strong>
            <small>图片文件单独存储在 media 目录</small>
          </div>
        </article>

        <article class="metric-card">
          <div class="metric-icon tone-amber">
            <Building2 :size="21" />
          </div>
          <div>
            <span class="metric-label">公司 / 组织</span>
            <strong>{{ loading ? '—' : companyCount }}</strong>
            <small>根据联系人记录去重统计</small>
          </div>
        </article>
      </section>

      <section class="overview-grid">
        <article class="overview-panel">
          <div class="panel-section-heading">
            <div>
              <p class="section-kicker">STATUS</p>
              <h2>联系状态分布</h2>
            </div>
            <span>{{ records.length }} 条记录</span>
          </div>

          <div class="status-distribution">
            <div
              v-for="bucket in statusBuckets"
              :key="bucket.key"
              class="status-bar-row"
            >
              <div class="status-bar-label">
                <span>{{ bucket.label }}</span>
                <strong>{{ bucket.count }}</strong>
              </div>
              <div class="status-track">
                <span
                  :class="`bar-${bucket.key}`"
                  :style="{ width: `${bucket.percent}%` }"
                ></span>
              </div>
              <small>{{ bucket.percent }}%</small>
            </div>
          </div>
        </article>

        <article class="overview-panel recent-panel">
          <div class="panel-section-heading">
            <div>
              <p class="section-kicker">RECENT</p>
              <h2>最近更新</h2>
            </div>
            <Clock3 :size="18" />
          </div>

          <div v-if="recentRecords.length" class="recent-list">
            <RouterLink
              v-for="record in recentRecords"
              :key="record.id"
              to="/"
              class="recent-row"
            >
              <span class="recent-avatar">
                {{ record.fullName?.charAt(0) || '?' }}
                <img
                  v-if="record.image?.path"
                  :src="getMediaUrl(record.image.path)"
                  :alt="`${record.fullName} 的图片`"
                  @error="$event.currentTarget.remove()"
                />
              </span>
              <span class="recent-person">
                <strong>{{ record.fullName }}</strong>
                <small>{{ record.company || '未填写公司' }}</small>
              </span>
              <time :datetime="record.updatedAt">
                {{ formatDate(record.updatedAt) }}
              </time>
            </RouterLink>
          </div>

          <div v-else class="compact-empty">暂无联系人记录</div>
        </article>
      </section>

      <section class="schema-shortcut">
        <div>
          <p class="section-kicker">JSON STRUCTURE</p>
          <h2>理解 records 的结构与分类方式</h2>
          <p>
            当前所有联系人都存放在 `records` 数组中。查看字段示例、推荐的多集合结构和分类原则。
          </p>
        </div>
        <RouterLink class="button secondary" to="/schema">
          查看数据结构
          <ArrowRight :size="17" />
        </RouterLink>
      </section>
    </template>
  </div>
</template>
