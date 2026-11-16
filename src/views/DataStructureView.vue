<script setup>
import {
  Braces,
  Database,
  GitBranch,
  Layers3,
  RefreshCw,
} from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { listRecords } from '../api/records'
import { listProjects } from '../api/projects'

const activeTab = ref('records')
const records = ref([])
const projects = ref([])
const loading = ref(true)
const errorMessage = ref('')

const tabs = [
  { id: 'records', label: '当前 records' },
  { id: 'recommended', label: '推荐结构' },
  { id: 'rules', label: '分类原则' },
]

const sampleRecord = computed(
  () =>
    records.value[0] || {
      id: 'record-001',
      fullName: '林晓',
      company: '远山设计',
      phone: '138 0000 1201',
      email: 'lin.xiao@example.com',
      status: 'active',
      notes: '联系人备注',
      image: {
        path: 'media/<UUID>.png',
        mimeType: 'image/png',
        size: 127,
        originalName: 'avatar.png',
      },
      createdAt: '2026-11-16T03:00:00.000Z',
      updatedAt: '2026-11-16T03:10:00.000Z',
    },
)
const currentRecordJson = computed(() =>
  JSON.stringify(sampleRecord.value, null, 2),
)
const currentRootJson = computed(() =>
  JSON.stringify(
    {
      records: records.value.slice(0, 2),
      projects: projects.value.slice(0, 2),
    },
    null,
    2,
  ),
)
const recommendedJson = `{
  "_meta": {
    "schemaVersion": 1,
    "appName": "本地数据台"
  },
  "records": [
    {
      "id": "record-001",
      "fullName": "林晓",
      "companyId": "company-001",
      "categoryId": "customer",
      "status": "active",
      "createdAt": "2026-11-16T03:00:00.000Z",
      "updatedAt": "2026-11-16T03:10:00.000Z"
    }
  ],
  "companies": [
    {
      "id": "company-001",
      "name": "远山设计"
    }
  ],
  "categories": [
    {
      "id": "customer",
      "name": "客户",
      "color": "#237b59"
    }
  ],
  "activities": [
    {
      "id": "activity-001",
      "recordId": "record-001",
      "type": "meeting",
      "content": "已完成需求沟通",
      "createdAt": "2026-11-16T04:00:00.000Z"
    }
  ]
}`

const rules = [
  {
    icon: Layers3,
    title: '不同业务实体使用不同集合',
    description:
      '联系人、公司、沟通记录、分类选项含义不同，应分别放在 records、companies、activities、categories 等顶层数组中。',
  },
  {
    icon: GitBranch,
    title: '同一实体的不同状态不要拆集合',
    description:
      '已联系、待跟进、已归档仍然是联系人，不应该创建 activeRecords、leadRecords 等数组。使用 status 字段区分。',
  },
  {
    icon: Database,
    title: '用 ID 建立关系',
    description:
      '联系人通过 companyId 关联公司，通过 categoryId 关联分类。沟通记录通过 recordId 关联联系人，避免重复复制整条数据。',
  },
  {
    icon: Braces,
    title: '集中管理枚举和元数据',
    description:
      '分类名称、颜色和元数据放在 categories 或 _meta 中，比在每个联系人中重复保存更易维护。',
  },
]

async function loadRecords() {
  loading.value = true
  errorMessage.value = ''

  try {
    const [contactData, projectData] = await Promise.all([
      listRecords(),
      listProjects(),
    ])
    records.value = contactData
    projects.value = projectData
  } catch (error) {
    errorMessage.value = `读取数据库失败：${error.message}`
  } finally {
    loading.value = false
  }
}

onMounted(loadRecords)
</script>

<template>
  <div class="page-view schema-page">
    <header class="page-header">
      <div>
        <p class="page-kicker">JSON SCHEMA</p>
        <h1>数据结构</h1>
        <p class="page-subtitle">查看 records 的真实格式和推荐的分类方式</p>
      </div>

      <div class="page-actions">
        <button
          class="button secondary"
          type="button"
          :disabled="loading"
          @click="loadRecords"
        >
          <RefreshCw :size="17" :class="{ spinning: loading }" />
          刷新数据
        </button>
        <RouterLink class="button primary" to="/">返回联系人</RouterLink>
      </div>
    </header>

    <section class="schema-summary">
      <div>
        <span>联系人集合</span>
        <strong>records · {{ loading ? '—' : records.length }}</strong>
      </div>
      <div>
        <span>项目集合</span>
        <strong>projects · {{ loading ? '—' : projects.length }}</strong>
      </div>
      <div>
        <span>数据库类型</span>
        <strong>JSON</strong>
      </div>
      <div>
        <span>图片存储</span>
        <strong>media 文件目录</strong>
      </div>
    </section>

    <div class="schema-tabs" role="tablist" aria-label="数据结构视图">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="schema-tab"
        :class="{ active: activeTab === tab.id }"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab.id"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <div v-if="errorMessage" class="state-message error-state page-state">
      <h2>数据库读取失败</h2>
      <p>{{ errorMessage }}</p>
    </div>

    <section v-else-if="activeTab === 'records'" class="schema-panel">
      <div class="schema-panel-heading">
        <div>
          <p class="section-kicker">CURRENT FORMAT</p>
          <h2>records 和 projects 是同级顶层集合</h2>
        </div>
        <span class="code-tag">db.json</span>
      </div>
      <p class="schema-description">
        新增项目集合后，`db.json` 根对象会多出一个 `projects` 数组，同时保留原有
        `records`。JSON Server 会自动生成 `/projects` 接口。不同实体并列存放，不会把项目对象塞进联系人记录。
      </p>
      <div class="schema-code-grid">
        <div>
          <h3>当前顶层结构</h3>
          <pre class="code-block"><code>{{ currentRootJson }}</code></pre>
        </div>
        <div>
          <h3>records 中的单条联系人</h3>
          <pre class="code-block"><code>{{ currentRecordJson }}</code></pre>
        </div>
      </div>
    </section>

    <section v-else-if="activeTab === 'recommended'" class="schema-panel">
      <div class="schema-panel-heading">
        <div>
          <p class="section-kicker">RECOMMENDED</p>
          <h2>扩展业务时使用多个顶层集合</h2>
        </div>
        <span class="code-tag">JSON Server resources</span>
      </div>
      <p class="schema-description">
        联系人、公司、沟通记录和分类是不同业务实体。JSON Server 会自动为每个顶层数组生成
        REST 路由，例如 `/records`、`/companies`、`/activities` 和
        `/categories`。
      </p>
      <pre class="code-block recommended-code"><code>{{ recommendedJson }}</code></pre>
    </section>

    <section v-else class="schema-panel">
      <div class="schema-panel-heading">
        <div>
          <p class="section-kicker">RULES</p>
          <h2>什么时候拆分，什么时候使用字段</h2>
        </div>
      </div>
      <div class="rule-grid">
        <article v-for="rule in rules" :key="rule.title" class="rule-card">
          <component :is="rule.icon" :size="22" />
          <h3>{{ rule.title }}</h3>
          <p>{{ rule.description }}</p>
        </article>
      </div>
      <div class="schema-callout">
        <strong>当前项目建议：</strong>
        暂时保留 `records`，避免破坏已有数据。后续新增公司、沟通记录等实体时，再增加新的顶层集合。若要把
        `records` 改名为 `contacts`，应先备份数据库并编写迁移脚本。
      </div>
    </section>
  </div>
</template>
