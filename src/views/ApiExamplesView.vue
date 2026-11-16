<script setup>
import { Code2, DatabaseBackup, Gauge, ShieldAlert } from 'lucide-vue-next'
import { ref } from 'vue'
import {
  createDraftWithSnapshot,
  createDraftWithoutSnapshot,
} from '../api/drafts'

const activeTab = ref('snapshot')
const demoRunning = ref('')
const demoResult = ref(null)
const demoError = ref('')

const snapshotExample = `import { http } from '../http/request'

await http.post('/records', {
  fullName: '新联系人',
  company: '示例公司',
  phone: '138 0000 0000',
  status: 'active',
}, {
  snapshot: true,
})

// snapshot 默认为 true
// 自动发送：X-Data-Snapshot: required`

const noSnapshotExample = `import { http } from '../http/request'

await http.patch('/records/record-001', {
  notes: '更新一条临时备注',
  updatedAt: new Date().toISOString(),
}, {
  snapshot: false,
})

// 自动发送：X-Data-Snapshot: skip`

const curlSnapshotExample = `curl -X POST http://127.0.0.1:3001/records \\
  -H "Content-Type: application/json" \\
  -H "X-Data-Snapshot: required" \\
  -d "{\\"fullName\\":\\"新联系人\\",\\"phone\\":\\"13800000000\\"}"`

const curlNoSnapshotExample = `curl -X PATCH http://127.0.0.1:3001/records/record-001 \\
  -H "Content-Type: application/json" \\
  -H "X-Data-Snapshot: skip" \\
  -d "{\\"notes\\":\\"临时备注\\"}"`

const rules = [
  {
    icon: DatabaseBackup,
    title: '默认使用快照写入',
    description:
      '联系人、项目、公司、沟通记录等用户数据写入时应保持 snapshot: true。写入前会向所有备份目标生成数据库快照。',
  },
  {
    icon: Gauge,
    title: '高频可恢复数据可跳过',
    description:
      '草稿自动保存、临时筛选状态、可重新生成的缓存数据适合跳过历史快照，减少磁盘写入次数。',
  },
  {
    icon: ShieldAlert,
    title: '不是关闭备份',
    description:
      '跳过快照仍然采用原子写入，并在成功后更新 latest.json。只是不新增一个历史时间点快照。',
  },
]

async function runDraftDemo(snapshot) {
  demoRunning.value = snapshot ? 'snapshot' : 'skip'
  demoResult.value = null
  demoError.value = ''

  try {
    const before = window.desktopAPI
      ? await window.desktopAPI.getBackupStatus()
      : null
    const draft = {
      content: `${snapshot ? '生成快照' : '跳过快照'}演示 ${new Date().toLocaleTimeString('zh-CN')}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const saved = snapshot
      ? await createDraftWithSnapshot(draft)
      : await createDraftWithoutSnapshot(draft)
    const after = window.desktopAPI
      ? await window.desktopAPI.getBackupStatus()
      : null

    demoResult.value = {
      id: saved.id,
      snapshot,
      before: before?.[0]?.snapshotCount ?? null,
      after: after?.[0]?.snapshotCount ?? null,
    }
  } catch (error) {
    demoError.value = error.message
  } finally {
    demoRunning.value = ''
  }
}
</script>

<template>
  <div class="page-view api-examples-page">
    <header class="page-header">
      <div>
        <p class="page-kicker">WRAPPER EXAMPLES</p>
        <h1>请求示例</h1>
        <p class="page-subtitle">按数据重要性选择是否生成历史快照</p>
      </div>
    </header>

    <div class="api-policy-banner">
      <Code2 :size="20" />
      <div>
        <strong>默认策略：required</strong>
        <p>没有显式传递 <code>X-Data-Snapshot: skip</code> 的写请求都会创建快照。</p>
      </div>
    </div>

    <div class="schema-tabs" role="tablist" aria-label="请求示例类型">
      <button
        class="schema-tab"
        :class="{ active: activeTab === 'snapshot' }"
        type="button"
        role="tab"
        :aria-selected="activeTab === 'snapshot'"
        @click="activeTab = 'snapshot'"
      >
        生成快照
      </button>
      <button
        class="schema-tab"
        :class="{ active: activeTab === 'no-snapshot' }"
        type="button"
        role="tab"
        :aria-selected="activeTab === 'no-snapshot'"
        @click="activeTab = 'no-snapshot'"
      >
        不生成快照
      </button>
    </div>

    <section v-if="activeTab === 'snapshot'" class="schema-panel">
      <div class="api-example-heading">
        <div>
          <p class="section-kicker">SAFE DEFAULT</p>
          <h2>http.post(..., { snapshot: true })</h2>
        </div>
        <span class="api-policy-chip required">X-Data-Snapshot: required</span>
      </div>
      <p class="schema-description">
        建议用于联系人、正式项目、财务信息和其他不可轻易重建的数据。写入前备份失败时，请求会被拒绝。
      </p>
      <div class="schema-code-grid">
        <div>
          <h3>前端调用方法</h3>
          <pre class="code-block"><code>{{ snapshotExample }}</code></pre>
        </div>
        <div>
          <h3>HTTP 请求示例</h3>
          <pre class="code-block"><code>{{ curlSnapshotExample }}</code></pre>
        </div>
      </div>
    </section>

    <section v-else class="schema-panel">
      <div class="api-example-heading">
        <div>
          <p class="section-kicker">PERFORMANCE MODE</p>
          <h2>http.patch(..., { snapshot: false })</h2>
        </div>
        <span class="api-policy-chip skipped">X-Data-Snapshot: skip</span>
      </div>
      <p class="schema-description">
        建议用于临时草稿、可重新生成的数据和高频自动保存。请求仍然原子写入，并更新 latest.json，但不会增加新的历史快照。
      </p>
      <div class="schema-code-grid">
        <div>
          <h3>前端调用方法</h3>
          <pre class="code-block"><code>{{ noSnapshotExample }}</code></pre>
        </div>
        <div>
          <h3>HTTP 请求示例</h3>
          <pre class="code-block"><code>{{ curlNoSnapshotExample }}</code></pre>
        </div>
      </div>
    </section>

    <section class="rule-grid api-rule-grid">
      <article v-for="rule in rules" :key="rule.title" class="rule-card">
        <component :is="rule.icon" :size="22" />
        <h3>{{ rule.title }}</h3>
        <p>{{ rule.description }}</p>
      </article>
    </section>

    <section class="schema-panel demo-panel">
      <div class="api-example-heading">
        <div>
          <p class="section-kicker">REAL REQUEST</p>
          <h2>真实执行两种写入</h2>
        </div>
        <span class="code-tag">POST /drafts</span>
      </div>
      <p class="schema-description">
        点击后会向独立的 drafts 集合写入一条演示草稿。桌面模式下会读取主备份操作前后的快照数量。
      </p>
      <div class="demo-actions">
        <button
          class="button secondary"
          type="button"
          :disabled="Boolean(demoRunning)"
          @click="runDraftDemo(true)"
        >
          {{ demoRunning === 'snapshot' ? '写入中...' : '执行 snapshot: true' }}
        </button>
        <button
          class="button primary"
          type="button"
          :disabled="Boolean(demoRunning)"
          @click="runDraftDemo(false)"
        >
          {{ demoRunning === 'skip' ? '写入中...' : '执行 snapshot: false' }}
        </button>
      </div>
      <div v-if="demoError" class="inline-notice error">
        {{ demoError }}
      </div>
      <div v-if="demoResult" class="demo-result">
        <strong>写入成功</strong>
        <span>记录 ID：{{ demoResult.id }}</span>
        <span>snapshot：{{ demoResult.snapshot }}</span>
        <span v-if="demoResult.before !== null">
          主备份快照数：{{ demoResult.before }} → {{ demoResult.after }}
        </span>
      </div>
    </section>

    <section class="schema-callout">
      <strong>选择建议：</strong>
      所有 API 请求统一经过 src/http/request.js，snapshot 参数默认为 true。src/api 只负责业务资源方法。
    </section>
  </div>
</template>
