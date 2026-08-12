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
          <div
            v-for="(val, key) in instance.content"
            :key="key"
            class="flex"
            :class="Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' ? 'flex-col' : ''"
          >
            <span class="text-xs text-[#999] w-20 flex-shrink-0 mb-1">{{ contentLabel(key) }}</span>
            <div v-if="Array.isArray(val) && val.length > 0 && typeof val[0] === 'string'" class="flex flex-wrap gap-1">
              <span v-for="(item, i) in val" :key="i" class="text-xs px-1.5 py-0.5 bg-[#f0f7ff] text-primary rounded">{{ item }}</span>
            </div>
            <div v-else-if="Array.isArray(val) && val.length > 0 && typeof val[0] === 'object'" class="w-full overflow-x-auto">
              <table class="w-full text-xs border border-[#eee]">
                <thead>
                  <tr class="bg-[#f5f7fa]">
                    <th v-for="(col, ci) in Object.keys(val[0])" :key="ci" class="px-2 py-1 border border-[#eee] text-[#666]">{{ col }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, ri) in val" :key="ri">
                    <td v-for="(col, ci) in Object.keys(val[0])" :key="ci" class="px-2 py-1 border border-[#eee] text-[#333]">{{ row[col] || '-' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <span v-else class="text-sm text-[#333] flex-1 break-all">{{ val }}</span>
          </div>
        </div>
      </div>

      <!-- Process Timeline -->
      <div class="px-4 py-4">
        <div class="text-sm font-medium text-[#333] mb-3">审批流程</div>
        <div v-if="instance.adjustments && instance.adjustments.length" class="mb-3">
          <div
            v-for="(adj, i) in instance.adjustments"
            :key="i"
            class="text-xs mb-1 px-2 py-1 rounded bg-[#fff7e6] text-[#faad14]"
          >
            <van-icon name="info-o" class="mr-1" />{{ adj }}
          </div>
        </div>
        <div class="relative pl-2">
          <!-- line -->
          <div class="absolute left-[15px] top-2 bottom-2 w-px bg-[#e8e8e8]"></div>

          <template v-for="(node, idx) in instance.nodes" :key="idx">
            <div
              v-if="node.approver"
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
                    第{{ node.level }}级 · <span v-if="node.stepName">{{ node.stepName }} · </span>{{ node.approver?.nickname }}
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
          </template>
        </div>
      </div>

      <!-- Withdraw -->
      <div v-if="canWithdraw" class="px-4 py-4 border-t border-[#f5f5f5]">
        <van-button type="warning" block round plain @click="handleWithdraw">
          撤回审批
        </van-button>
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
import { APPROVAL_TEMPLATES } from '@/utils/approvalTemplate'
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
  return node.approver?.userID === userStore.selfInfo.userID
})

// 申请人可在审批中撤回
const canWithdraw = computed(() => {
  if (!instance.value || instance.value.status !== 'pending') return false
  return instance.value.applicant.userID === userStore.selfInfo.userID
})

// 内容字段中文标签
const contentLabel = (key: string) => {
  const tpl = instance.value ? APPROVAL_TEMPLATES[instance.value.type] : undefined
  const field = tpl?.fields.find((f) => f.key === key)
  return field?.label || key
}

const statusText = (status: string) => {
  const map: Record<string, string> = {
    pending: '审批中',
    approved: '已通过',
    rejected: '已驳回',
    transferred: '已转交',
    withdrawn: '已撤回',
  }
  return map[status] || status
}

const statusClass = (status: string) => {
  const map: Record<string, string> = {
    pending: 'bg-[#fff7e6] text-[#faad14]',
    approved: 'bg-[#f6ffed] text-[#52c41a]',
    rejected: 'bg-[#fff1f0] text-[#ff4d4f]',
    transferred: 'bg-[#e6f7ff] text-[#1890ff]',
    withdrawn: 'bg-[#f5f5f5] text-[#999]',
  }
  return map[status] || ''
}

const dotClass = (status: string) => {
  const map: Record<string, string> = {
    pending: 'bg-[#faad14]',
    approved: 'bg-[#52c41a]',
    rejected: 'bg-[#ff4d4f]',
    transferred: 'bg-[#1890ff]',
    withdrawn: 'bg-[#d9d9d9]',
  }
  return map[status] || 'bg-[#d9d9d9]'
}

const formatTime = (ts: number) => formatMessageTime(ts)

const handleWithdraw = async () => {
  if (!instance.value) return
  const ok = await approvalStore.withdrawApproval(instance.value.id)
  if (ok) {
    feedbackToast({ message: '审批已撤回' })
    setTimeout(() => router.back(), 500)
  } else {
    feedbackToast({ error: '撤回失败' })
  }
}

const handleAction = async (action: 'approved' | 'rejected') => {
  if (!instance.value) return
  const ok = await approvalStore.processApproval({
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
