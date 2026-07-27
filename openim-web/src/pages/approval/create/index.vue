<template>
  <div class="page_container">
    <NavBar :title="'发起审批'" />
    <div class="flex-1 overflow-y-auto bg-white px-4 py-4">
      <!-- Template selector -->
      <div class="mb-4">
        <div class="text-sm text-[#666] mb-2">审批类型</div>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="t in templates"
            :key="t.value"
            class="px-3 py-1.5 text-sm rounded-full border cursor-pointer"
            :class="form.type === t.value ? 'border-primary bg-[#f0f7ff] text-primary' : 'border-[#ddd] text-[#666]'"
            @click="selectTemplate(t)"
          >
            {{ t.label }}
          </span>
        </div>
      </div>

      <!-- Title -->
      <div class="mb-4">
        <div class="text-sm text-[#666] mb-2">审批标题</div>
        <input
          v-model="form.title"
          class="w-full px-3 py-2 border border-[#ddd] rounded-lg text-sm focus:outline-none focus:border-primary"
          placeholder="请输入审批标题"
        />
      </div>

      <!-- Dynamic fields -->
      <div class="mb-4">
        <div class="text-sm text-[#666] mb-2">审批内容</div>
        <div
          v-for="(field, idx) in currentTemplate.fields"
          :key="idx"
          class="mb-3"
        >
          <div class="text-xs text-[#999] mb-1">{{ field.label }}</div>
          <input
            v-if="field.type === 'text'"
            v-model="form.content[field.key]"
            class="w-full px-3 py-2 border border-[#ddd] rounded-lg text-sm focus:outline-none focus:border-primary"
            :placeholder="field.placeholder"
          />
          <textarea
            v-else-if="field.type === 'textarea'"
            v-model="form.content[field.key]"
            rows="3"
            class="w-full px-3 py-2 border border-[#ddd] rounded-lg text-sm focus:outline-none focus:border-primary"
            :placeholder="field.placeholder"
          />
        </div>
      </div>

      <!-- Approvers -->
      <div class="mb-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm text-[#666]">审批人（按顺序逐级审批）</span>
          <span class="text-xs text-primary cursor-pointer" @click="addApprover">+ 添加</span>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <div
            v-for="(appr, idx) in form.approvers"
            :key="idx"
            class="flex items-center gap-2 bg-[#f5f7fa] rounded-lg px-3 py-2"
          >
            <Avatar :size="28" :src="appr.faceURL" :desc="appr.nickname" />
            <span class="text-xs text-[#333]">{{ appr.nickname }}</span>
            <van-icon name="cross" class="text-[#999] cursor-pointer" @click="removeApprover(idx)" />
          </div>
          <div v-if="form.approvers.length === 0" class="text-xs text-[#999]">请点击添加选择审批人</div>
        </div>
      </div>

      <!-- Submit -->
      <van-button type="primary" block round :disabled="!canSubmit" @click="submit">
        提交审批
      </van-button>
    </div>

    <!-- Approver picker modal -->
    <van-popup v-model:show="showPicker" position="bottom" round>
      <div class="p-4">
        <div class="text-center text-sm font-medium mb-3">选择审批人</div>
        <div class="max-h-[300px] overflow-y-auto">
          <div
            v-for="friend in contactStore.storeFriendList"
            :key="friend.userID"
            class="flex items-center gap-3 py-2 cursor-pointer hover:bg-[#f5f7fa] px-2 rounded"
            @click="pickApprover(friend)"
          >
            <Avatar :size="36" :src="friend.faceURL" :desc="friend.nickname" />
            <span class="text-sm text-[#333]">{{ friend.nickname }}</span>
          </div>
        </div>
        <van-button class="mt-3" block round @click="showPicker = false">取消</van-button>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import Avatar from '@/components/Avatar/index.vue'
import useApprovalStore from '@/store/modules/approval'
import useContactStore from '@/store/modules/contact'
import useUserStore from '@/store/modules/user'
import { feedbackToast } from '@/utils/common'

const router = useRouter()
const approvalStore = useApprovalStore()
const contactStore = useContactStore()
const userStore = useUserStore()

const templates = [
  {
    value: 'leave',
    label: '请假',
    fields: [
      { key: 'leaveType', label: '请假类型', type: 'text', placeholder: '事假 / 病假 / 年假' },
      { key: 'startDate', label: '开始时间', type: 'text', placeholder: '2025-01-01' },
      { key: 'endDate', label: '结束时间', type: 'text', placeholder: '2025-01-02' },
      { key: 'reason', label: '请假事由', type: 'textarea', placeholder: '请输入请假事由' },
    ],
  },
  {
    value: 'expense',
    label: '报销',
    fields: [
      { key: 'amount', label: '报销金额', type: 'text', placeholder: '0.00' },
      { key: 'category', label: '费用类型', type: 'text', placeholder: '交通 / 餐饮 / 住宿' },
      { key: 'desc', label: '费用说明', type: 'textarea', placeholder: '请输入费用说明' },
    ],
  },
  {
    value: 'business',
    label: '出差',
    fields: [
      { key: 'destination', label: '出差地点', type: 'text', placeholder: '目的地' },
      { key: 'startDate', label: '开始时间', type: 'text', placeholder: '2025-01-01' },
      { key: 'endDate', label: '结束时间', type: 'text', placeholder: '2025-01-02' },
      { key: 'reason', label: '出差事由', type: 'textarea', placeholder: '请输入出差事由' },
    ],
  },
  {
    value: 'general',
    label: '通用',
    fields: [
      { key: 'content', label: '申请内容', type: 'textarea', placeholder: '请输入申请内容' },
    ],
  },
]

const currentTemplate = computed(() => templates.find((t) => t.value === form.type) || templates[3])

const form = reactive({
  type: 'leave',
  title: '',
  content: {} as Record<string, string>,
  approvers: [] as { userID: string; nickname: string; faceURL: string }[],
})

const showPicker = ref(false)

const selectTemplate = (t: typeof templates[0]) => {
  form.type = t.value
  form.content = {}
  form.title = t.label + '申请'
}

const addApprover = () => {
  showPicker.value = true
}

const removeApprover = (idx: number) => {
  form.approvers.splice(idx, 1)
}

const pickApprover = (friend: any) => {
  if (form.approvers.some((a) => a.userID === friend.userID)) {
    feedbackToast({ message: '该审批人已存在' })
    return
  }
  form.approvers.push({
    userID: friend.userID,
    nickname: friend.nickname,
    faceURL: friend.faceURL,
  })
  showPicker.value = false
}

const canSubmit = computed(() => {
  return form.title.trim() && form.approvers.length > 0 && Object.values(form.content).some((v) => v.trim())
})

const submit = () => {
  approvalStore.createApproval({
    title: form.title,
    type: form.type,
    applicant: {
      userID: userStore.selfInfo.userID,
      nickname: userStore.selfInfo.nickname,
      faceURL: userStore.selfInfo.faceURL,
    },
    content: form.content,
    approvers: form.approvers,
  })
  feedbackToast({ message: '审批已提交' })
  router.back()
}

onMounted(() => {
  if (contactStore.storeFriendList.length === 0) {
    contactStore.getFriendListFromReq()
  }
  form.title = templates[0].label + '申请'
})
</script>
