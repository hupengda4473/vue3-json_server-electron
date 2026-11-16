<script setup>
import { AlertTriangle, Trash2, X } from 'lucide-vue-next'
import { onBeforeUnmount, onMounted } from 'vue'

const props = defineProps({
  record: {
    type: Object,
    required: true,
  },
  deleting: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['cancel', 'confirm'])

function cancel() {
  if (!props.deleting) {
    emit('cancel')
  }
}

function handleKeydown(event) {
  if (event.key === 'Escape') {
    cancel()
  }
}

onMounted(() => {
  document.body.style.overflow = 'hidden'
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop" @mousedown.self="cancel">
      <section
        class="confirm-panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        @mousedown.stop
      >
        <button
          class="icon-button confirm-close"
          type="button"
          title="关闭"
          aria-label="关闭"
          :disabled="deleting"
          @click="cancel"
        >
          <X :size="18" />
        </button>

        <div class="danger-icon">
          <AlertTriangle :size="23" />
        </div>
        <h2 id="confirm-title">删除这条联系人记录？</h2>
        <p>
          “{{ record.fullName }}”将从本地 JSON 文件中永久删除，此操作无法撤销。
        </p>

        <footer class="modal-actions">
          <button class="button secondary" type="button" :disabled="deleting" @click="cancel">
            取消
          </button>
          <button class="button danger" type="button" :disabled="deleting" @click="emit('confirm')">
            <Trash2 :size="17" />
            {{ deleting ? '删除中...' : '确认删除' }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
