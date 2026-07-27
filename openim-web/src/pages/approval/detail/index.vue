<template>
  <div class="page_container">
    <NavBar :title="'审批详情'" />
    <div v-if="instance" class="flex-1 overflow-y-auto bg-white">
      <!-- Header -->
      <div class="px-4 py-4 border-b border-[#f5f5f5]">
        <div class="flex items-center gap-3 mb-3">
          <Avatar :size="48" :src="instance.applicant.faceURL" :desc="instance.applicant.nickname" />
          <div>
            <div class="text-base font-medium text-[#333]">{{ instance.applicant.nickname }}</div>
            <div class="text-xs text-[#999]">{{ formatTime(instance.createTime) }}</div>
          </div>
        </div>
        <div class="text-lg font-medium text-[#333] mb-2">{{ instance.title }}</div>
        <span
          class="inline-block text-xs px-2 py-0.5 rounded"
          :class="statusClass(instance.status)"
        >
          {{ statusText(instance.status) }}
        </span>
      </div>

      <!-- Content -->
      <div class="px-4 py-4 border-b border-[#f5f5f5]">
        <div class="text-sm font-medium text-[#333] mb-3">审批内容</div>
        <div class="space-y-2">
          <div v-for="(val, key) in instance.content" :key="key" class="flex">
            <span class="text-xs text-[#999] w-20 flex-shrink-0">{{ key }}</span>
            <span class="text-sm text-[#333] flex-1 break-all">{{ val }}</span>
          </div>
        </div>
      </div>

      <!-- Process Timeline -->
      <div class="px-4 py-4">
        <div class="text-sm font-medium text-[#333] mb-3">审批流程</div>
        <div class="relative pl-2">
          <!-- line -->
          <div class="absolute left-[15px] top-2 bottom-2 w-px bg-[#e8e8e8]"></div>

          <div
            v-for="(node, idx) in instance.nodes"
            :key="idx"
            class="relative flex items-start gap-3 mb-4"
          >
            <!-- dot -->
            <div
              class="relative z-10 w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
              :class="dotClass(node.status)"
            ></div>

            <div class="flex-1">
              <div class="flex items-center justify-between">
                <span class="text-sm text-[#333]">
                  第{{ node.level }}级审批 · {{ node.approver.nickname }}
                  <span v-if="node.transferTo" class="text-xs text-[#999]">（转交给 {{ node.transferTo.nickname }}）</span>
                </span>
                <span class="text-xs text-[#999]">{{ node.time ? formatTime(node.time) : '' }}</span>
              </div>
              <div v-if="node.status !== 'pending'" class="mt-1">
                <span
                  class="text-xs px-1.5 py-0.5 rounded"
                  :class="statusClass(node.status)"
                >
                  {{ statusText(node.status) }}
                </span>
                <span v-if="node.comment" class="text-xs text-[#666] ml-2">{{ node.comment }}</span>
              </div>
              <div v-else class="mt-1 text-xs text-[#faad14]">待审批</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div v-if="canAction" class="px-4 py-4 border-t border-[#f5f5f5]">
        <div class="text-sm text-[#666] mb-2">审批意见</div>
        <textarea
          v-model="comment"
          rows="2"
          class="w-full px-3 py-2 border border-[#ddd] rounded-lg text-sm focus:outline-none focus:border-primary mb-3"
          placeholder="请输入审批意见（可选）"
        />
        <div class="flex gap-3">
          <van-button type="danger" block round plain @click="handleAction('rejected')">
            驳回
          </van-button>
          <van-button type="primary" block round @click="handleAction('approved')">
            同意
          </van-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Avatar from '@/components/Avatar/index.vue'
import useApprovalStore from '@/store/modules/approval'
import useUserStore from '@/store/modules/user'
import { feedbackToast } from '@/utils/common'
import { formatMessageTime } from '@/utils/imCommon'

const props = defineProps<{ id: string }>()
const router = useRouter()
const approvalStore = useApprovalStore()
const userStore = useUserStore()

const instance = computed(() => approvalStore.getApprovalById(props.id))

const comment = ref('')

const currentNode = computed(() => {
  if (!instance.value) return null
  return instance.value.nodes.find((n) => n.status === 'pending')
})

const canAction = computed(() => {
  if (!instance.value || instance.value.status !== 'pending') return false
  const node = currentNode.value
  if (!node) return false
  return node.approver.userID === userStore.selfInfo.userID
})

const statusText = (status: string) => {
  const map: Record<string, string> = {
    pending: '审批中',
    approved: '已通过',
    rejected: '已驳回',
    transferred: '已转交',
  }
  return map[status] || status
}

const statusClass = (status: string) => {
  const map: Record<string, string> = {
    pending: 'bg-[#fff7e6] text-[#faad14]',
    approved: 'bg-[#f6ffed] text-[#52c41a]',
    rejected: 'bg-[#fff1f0] text-[#ff4d4f]',
    transferred: 'bg-[#e6f7ff] text-[#1890ff]',
  }
  return map[status] || ''
}

const dotClass = (status: string) => {
  const map: Record<string, string> = {
    pending: 'bg-[#faad14]',
    approved: 'bg-[#52c41a]',
    rejected: 'bg-[#ff4d4f]',
    transferred: 'bg-[#1890ff]',
  }
  return map[status] || 'bg-[#d9d9d9]'
}

const formatTime = (ts: number) => formatMessageTime(ts)

const handleAction = (action: 'approved' | 'rejected') => {
  if (!instance.value) return
  const ok = approvalStore.processApproval({
    id: instance.value.id,
    action,
    comment: comment.value,
  })
  if (ok) {
    feedbackToast({ message: action === 'approved' ? '已同意' : '已驳回' })
    if (instance.value?.status !== 'pending') {
      setTimeout(() => router.back(), 500)
    }
  } else {
    feedbackToast({ error: '操作失败' })
  }
}
</script>
