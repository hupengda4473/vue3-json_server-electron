<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ImagePlus, LoaderCircle, Save, Trash2, X } from 'lucide-vue-next'
import { getMediaUrl, uploadContactImage } from '../api/records'

const props = defineProps({
  record: {
    type: Object,
    default: null,
  },
  saving: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'submit'])

const statusOptions = [
  { value: 'active', label: '已联系' },
  { value: 'lead', label: '待跟进' },
  { value: 'inactive', label: '已归档' },
]

const form = reactive({
  fullName: props.record?.fullName || '',
  company: props.record?.company || '',
  phone: props.record?.phone || '',
  email: props.record?.email || '',
  status: props.record?.status || 'active',
  notes: props.record?.notes || '',
  image: props.record?.image || null,
})

const errors = reactive({})
const nameInput = ref(null)
const fileInput = ref(null)
const uploading = ref(false)
const uploadError = ref('')

const title = computed(() => (props.record ? '编辑联系人' : '新建联系人'))
const submitLabel = computed(() => (props.record ? '保存修改' : '创建联系人'))
const isBusy = computed(() => props.saving || uploading.value)

function validate() {
  Object.keys(errors).forEach((key) => delete errors[key])

  if (!form.fullName.trim()) {
    errors.fullName = '请输入姓名'
  }

  if (!/^[+\d\s-]{6,20}$/.test(form.phone.trim())) {
    errors.phone = '请输入有效的联系电话'
  }

  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = '邮箱格式不正确'
  }

  return Object.keys(errors).length === 0
}

function handleSubmit() {
  if (isBusy.value || !validate()) return

  emit('submit', {
    fullName: form.fullName.trim(),
    company: form.company.trim(),
    phone: form.phone.trim(),
    email: form.email.trim(),
    status: form.status,
    notes: form.notes.trim(),
    image: form.image,
  })
}

function requestClose() {
  if (!isBusy.value) {
    emit('close')
  }
}

function openFilePicker() {
  fileInput.value?.click()
}

async function handleFileChange(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  uploadError.value = ''

  if (!file) return

  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    uploadError.value = '仅支持 PNG、JPEG、WebP 或 GIF 图片'
    return
  }

  if (file.size > 8 * 1024 * 1024) {
    uploadError.value = '图片不能超过 8 MB'
    return
  }

  uploading.value = true
  try {
    const result = await uploadContactImage(file)
    form.image = result.image
  } catch (error) {
    uploadError.value = `图片上传失败：${error.message}`
  } finally {
    uploading.value = false
  }
}

function removeImage() {
  if (!isBusy.value) {
    form.image = null
    uploadError.value = ''
  }
}

function handleKeydown(event) {
  if (event.key === 'Escape') {
    requestClose()
  }
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
        :aria-labelledby="'record-modal-title'"
        @mousedown.stop
      >
        <header class="modal-header">
          <div>
            <p class="modal-kicker">联系人台账</p>
            <h2 id="record-modal-title">{{ title }}</h2>
          </div>
          <button
            class="icon-button"
            type="button"
            title="关闭"
            aria-label="关闭"
            :disabled="isBusy"
            @click="requestClose"
          >
            <X :size="19" />
          </button>
        </header>

        <form class="record-form" novalidate @submit.prevent="handleSubmit">
          <div class="form-grid">
            <label class="field">
              <span>姓名 <b>*</b></span>
              <input
                ref="nameInput"
                v-model="form.fullName"
                type="text"
                maxlength="40"
                placeholder="例如：林晓"
                :class="{ invalid: errors.fullName }"
              />
              <small v-if="errors.fullName" class="field-error">{{ errors.fullName }}</small>
            </label>

            <label class="field">
              <span>公司 / 组织</span>
              <input
                v-model="form.company"
                type="text"
                maxlength="80"
                placeholder="例如：远山设计"
              />
            </label>

            <label class="field">
              <span>联系电话 <b>*</b></span>
              <input
                v-model="form.phone"
                type="tel"
                maxlength="20"
                placeholder="例如：138 0000 1201"
                :class="{ invalid: errors.phone }"
              />
              <small v-if="errors.phone" class="field-error">{{ errors.phone }}</small>
            </label>

            <label class="field">
              <span>邮箱</span>
              <input
                v-model="form.email"
                type="email"
                maxlength="120"
                placeholder="name@example.com"
                :class="{ invalid: errors.email }"
              />
              <small v-if="errors.email" class="field-error">{{ errors.email }}</small>
            </label>
          </div>

          <div class="contact-image-field">
            <div class="image-preview" :class="{ empty: !form.image?.path }">
              <img
                v-if="form.image?.path"
                :src="getMediaUrl(form.image.path)"
                alt="联系人图片预览"
              />
              <ImagePlus v-else :size="25" />
            </div>

            <div class="image-actions">
              <span class="image-label">联系人图片</span>
              <div class="image-action-row">
                <input
                  ref="fileInput"
                  class="visually-hidden"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  @change="handleFileChange"
                />
                <button
                  class="button secondary"
                  type="button"
                  :disabled="isBusy"
                  @click="openFilePicker"
                >
                  <LoaderCircle v-if="uploading" :size="17" class="spinning" />
                  <ImagePlus v-else :size="17" />
                  {{ uploading ? '上传中...' : form.image ? '更换图片' : '选择图片' }}
                </button>
                <button
                  v-if="form.image?.path"
                  class="button secondary image-remove-button"
                  type="button"
                  :disabled="isBusy"
                  @click="removeImage"
                >
                  <Trash2 :size="16" />
                  移除
                </button>
              </div>
              <small class="image-hint">PNG、JPEG、WebP 或 GIF，最大 8 MB</small>
              <small v-if="uploadError" class="field-error">{{ uploadError }}</small>
            </div>
          </div>

          <fieldset class="field status-field">
            <legend>联系状态</legend>
            <div class="status-options">
              <label
                v-for="option in statusOptions"
                :key="option.value"
                class="status-option"
                :class="{ selected: form.status === option.value }"
              >
                <input v-model="form.status" type="radio" :value="option.value" />
                <span class="status-dot" :class="`status-${option.value}`"></span>
                {{ option.label }}
              </label>
            </div>
          </fieldset>

          <label class="field">
            <span>备注</span>
            <textarea
              v-model="form.notes"
              rows="4"
              maxlength="500"
              placeholder="记录沟通背景、下一步计划等"
            ></textarea>
          </label>

          <footer class="modal-actions">
            <button
              class="button secondary"
              type="button"
              :disabled="isBusy"
              @click="requestClose"
            >
              取消
            </button>
            <button class="button primary" type="submit" :disabled="isBusy">
              <Save :size="17" />
              {{ saving ? '保存中...' : uploading ? '图片上传中...' : submitLabel }}
            </button>
          </footer>
        </form>
      </section>
    </div>
  </Teleport>
</template>
