<template>
  <div class="approval-card" @click="toDetail">
    <div class="approval-card-header">
      <van-icon name="orders-o" size="18" color="var(--primary)" />
      <span class="approval-title">{{ data.title || '审批通知' }}</span>
    </div>
    <div class="approval-card-body">
      <div class="approval-row">
        <span class="approval-label">申请人</span>
        <span class="approval-value">{{ data.applicant?.nickname || '' }}</span>
      </div>
      <div class="approval-row">
        <span class="approval-label">状态</span>
        <span class="approval-value" :style="{ color: statusColor }">{{ statusText }}</span>
      </div>
      <div class="approval-row">
        <span class="approval-label">当前节点</span>
        <span class="approval-value">{{ currentNode || '待审批' }}</span>
      </div>
    </div>
    <div class="approval-card-footer">点击查看详情</div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  message: any
  isSelfMsg: boolean
  disabled: boolean
}>()

const router = useRouter()

const data = computed<Record<string, any>>(() => {
  try {
    const raw = JSON.parse(props.message.customElem?.data || '{}')
    const msgData = raw.data || {}
    // 兼容新旧格式：优先使用 instance 数据
    if (msgData.instance) {
      return msgData.instance
    }
    return msgData
  } catch {
    return {}
  }
})

const statusText = computed(() => {
  const map: Record<string, string> = {
    pending: '审批中',
    approved: '已通过',
    rejected: '已驳回',
    transferred: '已转交',
    withdrawn: '已撤回',
  }
  return map[data.value.status] || '审批中'
})

const statusColor = computed(() => {
  const map: Record<string, string> = {
    pending: '#faad14',
    approved: '#52c41a',
    rejected: '#ff4d4f',
    transferred: '#1890ff',
    withdrawn: '#999999',
  }
  return map[data.value.status] || '#faad14'
})

// 当前待审批环节（含环节名称）
const currentNode = computed(() => {
  const d = data.value
  if (!d?.nodes?.length) return ''
  const node = d.nodes.find((n: any) => n.status === 'pending') || d.nodes.find((n: any) => n.status === 'withdrawn')
  if (!node) return d.status === 'approved' ? '全部通过' : ''
  const step = node.stepName ? `${node.stepName} · ` : ''
  return `${step}${node.approver?.nickname || ''}`
})

const toDetail = () => {
  if (props.disabled) return
  if (data.value.id) {
    router.push({ path: '/approval/detail', query: { id: data.value.id } })
  }
}
</script>

<style lang="scss" scoped>
.approval-card {
  width: 240px;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);

  .approval-card-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 12px;
    border-bottom: 1px solid #f0f0f0;
    background: #f5f7fa;

    .approval-title {
      font-size: 14px;
      font-weight: 500;
      color: #333;
    }
  }

  .approval-card-body {
    padding: 10px 12px;

    .approval-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;

      &:last-child {
        margin-bottom: 0;
      }

      .approval-label {
        font-size: 12px;
        color: #999;
      }

      .approval-value {
        font-size: 12px;
        color: #333;
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }

  .approval-card-footer {
    padding: 8px 12px;
    text-align: center;
    font-size: 12px;
    color: var(--primary);
    border-top: 1px solid #f0f0f0;
    background: #fafafa;
  }
}
</style>
