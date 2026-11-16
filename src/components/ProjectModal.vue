<script setup>
import { Save, X } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'

const props = defineProps({
  project: {
    type: Object,
    default: null,
  },
  saving: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'submit'])

const form = reactive({
  name: props.project?.name || '',
  category: props.project?.category || '设计',
  status: props.project?.status || 'planning',
  priority: props.project?.priority || 'medium',
  owner: props.project?.owner || '',
  dueDate: props.project?.dueDate || '',
  notes: props.project?.notes || '',
})

const errors = reactive({})
const nameInput = ref(null)
const title = computed(() => (props.project ? '编辑项目' : '新建项目'))

function validate() {
  Object.keys(errors).forEach((key) => delete errors[key])
  if (!form.name.trim()) errors.name = '请输入项目名称'
  return Object.keys(errors).length === 0
}

function handleSubmit() {
  if (props.saving || !validate()) return

  emit('submit', {
    name: form.name.trim(),
    category: form.category,
    status: form.status,
    priority: form.priority,
    owner: form.owner.trim(),
    dueDate: form.dueDate,
    notes: form.notes.trim(),
  })
}

function requestClose() {
  if (!props.saving) emit('close')
}

function handleKeydown(event) {
  if (event.key === 'Escape') requestClose()
}

onMounted(async () => {
  document.body.style.overflow = 'hidden'
  document.addEventListener('keydown', handleKeydown)
  await nextTick()
  nameInput.value?.focus()
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop" @mousedown.self="requestClose">
      <section
        class="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-modal-title"
        @mousedown.stop
      >
        <header class="modal-header">
          <div>
            <p class="modal-kicker">PROJECTS COLLECTION</p>
            <h2 id="project-modal-title">{{ title }}</h2>
          </div>
          <button
            class="icon-button"
            type="button"
            title="关闭"
            aria-label="关闭"
            :disabled="saving"
            @click="requestClose"
          >
            <X :size="19" />
          </button>
        </header>

        <form class="record-form" novalidate @submit.prevent="handleSubmit">
          <div class="form-grid">
            <label class="field project-name-field">
              <span>项目名称 <b>*</b></span>
              <input
                ref="nameInput"
                v-model="form.name"
                type="text"
                maxlength="80"
                placeholder="例如：品牌官网升级"
                :class="{ invalid: errors.name }"
              />
              <small v-if="errors.name" class="field-error">{{ errors.name }}</small>
            </label>

            <label class="field">
              <span>负责人</span>
              <input
                v-model="form.owner"
                type="text"
                maxlength="40"
                placeholder="项目负责人"
              />
            </label>

            <label class="field">
              <span>分类</span>
              <select v-model="form.category">
                <option value="设计">设计</option>
                <option value="开发">开发</option>
                <option value="运营">运营</option>
                <option value="销售">销售</option>
                <option value="其他">其他</option>
              </select>
            </label>

            <label class="field">
              <span>优先级</span>
              <select v-model="form.priority">
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
              </select>
            </label>

            <label class="field">
              <span>状态</span>
              <select v-model="form.status">
                <option value="planning">规划中</option>
                <option value="in_progress">进行中</option>
                <option value="paused">已暂停</option>
                <option value="done">已完成</option>
              </select>
            </label>

            <label class="field">
              <span>计划完成日期</span>
              <input v-model="form.dueDate" type="date" />
            </label>
          </div>

          <label class="field">
            <span>备注</span>
            <textarea
              v-model="form.notes"
              rows="4"
              maxlength="500"
              placeholder="记录项目范围、进度或下一步计划"
            ></textarea>
          </label>

          <footer class="modal-actions">
            <button class="button secondary" type="button" :disabled="saving" @click="requestClose">
              取消
            </button>
            <button class="button primary" type="submit" :disabled="saving">
              <Save :size="17" />
              {{ saving ? '保存中...' : props.project ? '保存修改' : '创建项目' }}
            </button>
          </footer>
        </form>
      </section>
    </div>
  </Teleport>
</template>
