<template>
  <div class="page_container">
    <NavBar :title="'审批'" />
    <div class="flex-1 overflow-y-auto bg-white">
      <!-- Tabs -->
      <div class="flex border-b border-[#eaeaea]">
        <div
          v-for="tab in tabs"
          :key="tab.key"
          class="flex-1 py-3 text-center text-sm cursor-pointer"
          :class="activeTab === tab.key ? 'text-primary font-medium border-b-2 border-primary' : 'text-[#666]'"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
          <span v-if="tab.badge" class="ml-1 text-xs text-primary">({{ tab.badge }})</span>
        </div>
      </div>

      <!-- List -->
      <div v-if="currentList.length > 0" class="divide-y divide-[#f5f5f5]">
        <div
          v-for="item in currentList"
          :key="item.id"
          class="px-4 py-3 cursor-pointer hover:bg-[#f5f7fa]"
          @click="toDetail(item.id)"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <Avatar :size="40" :src="item.applicant.faceURL" :desc="item.applicant.nickname" />
              <div>
                <div class="text-sm font-medium text-[#333]">{{ item.title }}</div>
                <div class="text-xs text-[#999] mt-0.5">{{ item.applicant.nickname }} · {{ formatTime(item.createTime) }}</div>
              </div>
            </div>
            <span
              class="text-xs px-2 py-0.5 rounded"
              :class="statusClass(item.status)"
            >
              {{ statusText(item.status) }}
            </span>
          </div>
          <div class="mt-2 text-xs text-[#666] line-clamp-1">
            <span v-for="(val, key) in item.content" :key="key" class="mr-3">{{ contentLabel(item.type, key) }}: {{ Array.isArray(val) ? (typeof val[0]==='object' ? `[${val.length}条明细]` : val.join(',')) : val }}</span>
          </div>
        </div>
      </div>
      <div v-else class="flex flex-col items-center justify-center py-20">
        <img class="w-32 h-32 opacity-50" src="@assets/images/common_empty.png" alt="empty" />
        <div class="text-sm text-[#999] mt-2">暂无数据</div>
      </div>
    </div>

    <!-- Create FAB -->
    <div
      class="fixed right-5 bottom-20 w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg cursor-pointer md:bottom-8"
      @click="router.push('/approval/create')"
    >
      <van-icon name="plus" color="#fff" size="24" />
    </div>
  </div>
</template>

<script setup lang="ts">
import Avatar from '@/components/Avatar/index.vue'
import useApprovalStore from '@/store/modules/approval'
import useConversationStore from '@/store/modules/conversation'
import { APPROVAL_TEMPLATES } from '@/utils/approvalTemplate'
import { formatMessageTime, IMSDK } from '@/utils/imCommon'
import { MessageType, ViewType } from '@openim/wasm-client-sdk'
import { CustomMessageType } from '@/constants/enum'

const router = useRouter()
const approvalStore = useApprovalStore()
const conversationStore = useConversationStore()

const activeTab = ref<'my' | 'pending' | 'processed'>('my')

// 从所有会话的最近历史消息中同步审批实例，解决离线/漏同步问题
const syncApprovalsFromHistory = async () => {
  const convs = conversationStore.storeConversationList
  for (const conv of convs) {
    try {
      const { data } = await IMSDK.getAdvancedHistoryMessageList({
        conversationID: conv.conversationID,
        count: 30,
        startClientMsgID: '',
        viewType: ViewType.History,
      })
      const messages = data?.messageList || []
      for (const msg of messages) {
        if (msg.contentType !== MessageType.CustomMessage) continue
        const customData = JSON.parse(msg.customElem?.data || '{}')
        if (customData.customType !== CustomMessageType.ApprovalMessage) continue
        if (customData.data?.instance) {
          approvalStore.syncRemoteInstance(customData.data.instance)
        }
      }
    } catch {}
  }
}

onMounted(() => {
  syncApprovalsFromHistory()
})

const tabs = computed(() => [
  { key: 'my' as const, label: '我发起的', badge: 0 },
  { key: 'pending' as const, label: '待我审批', badge: approvalStore.storePendingApprovals.length },
  { key: 'processed' as const, label: '已处理', badge: 0 },
])

const currentList = computed(() => {
  switch (activeTab.value) {
    case 'my':
      return approvalStore.storeMyApplications
    case 'pending':
      return approvalStore.storePendingApprovals
    case 'processed':
      return approvalStore.storeProcessedApprovals
    default:
      return []
  }
})

const contentLabel = (type: string, key: string) => {
  const tpl = APPROVAL_TEMPLATES[type]
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

const formatTime = (ts: number) => formatMessageTime(ts)

const toDetail = (id: string) => {
  router.push({ path: '/approval/detail', query: { id } })
}
</script>
