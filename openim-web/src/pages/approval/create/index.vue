<template>
  <div class="page_container">
    <NavBar :title="'发起审批'" />
    <div class="flex-1 overflow-y-auto bg-white px-4 py-4">
      <!-- Template selector -->
      <div class="mb-4">
        <div class="text-sm text-[#666] mb-2">审批类型</div>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="tpl in templates"
            :key="tpl.type"
            class="px-3 py-1.5 text-sm rounded-full border cursor-pointer"
            :class="form.type === tpl.type ? 'border-primary bg-[#f0f7ff] text-primary' : 'border-[#ddd] text-[#666]'"
            @click="selectTemplate(tpl.type)"
          >
            {{ tpl.typeName }}
          </div>
        </div>
        <div class="text-xs text-[#999] mt-1.5">{{ currentTemplate.description }}</div>
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
        <div v-for="field in visibleFields" :key="field.key" class="mb-3">
          <!-- readonly / auto-filled -->
          <div v-if="field.type === 'readonly'">
            <div class="text-xs text-[#999] mb-1">{{ field.label }}</div>
            <div class="w-full px-3 py-2 bg-[#f5f7fa] rounded-lg text-sm text-[#333]">
              {{ form.content[field.key] || '-' }}
            </div>
          </div>

          <!-- text / date / month -->
          <input
            v-else-if="field.type === 'text' || field.type === 'date' || field.type === 'month'"
            v-model="form.content[field.key]"
            :type="field.type"
            class="w-full px-3 py-2 border border-[#ddd] rounded-lg text-sm focus:outline-none focus:border-primary"
            :placeholder="field.placeholder"
          />

          <!-- textarea -->
          <textarea
            v-else-if="field.type === 'textarea'"
            v-model="form.content[field.key]"
            rows="3"
            class="w-full px-3 py-2 border border-[#ddd] rounded-lg text-sm focus:outline-none focus:border-primary"
            :placeholder="field.placeholder"
          />

          <!-- select -->
          <select
            v-else-if="field.type === 'select' && field.options"
            v-model="form.content[field.key]"
            class="w-full px-3 py-2 border border-[#ddd] rounded-lg text-sm focus:outline-none focus:border-primary bg-white"
          >
            <option value="">请选择</option>
            <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
          </select>

          <!-- checkbox -->
          <div v-else-if="field.type === 'checkbox' && field.options" class="flex flex-wrap gap-2 mt-1">
            <label
              v-for="opt in field.options"
              :key="opt"
              class="flex items-center gap-1 px-2 py-1 border border-[#ddd] rounded cursor-pointer text-xs"
              :class="(form.content[field.key] || []).includes(opt) ? 'border-primary bg-[#f0f7ff] text-primary' : 'text-[#666]'"
            >
              <input
                type="checkbox"
                class="accent-primary"
                :value="opt"
                :checked="(form.content[field.key] || []).includes(opt)"
                @change="toggleCheckbox(field.key, opt)"
              />
              {{ opt }}
            </label>
          </div>

          <!-- table -->
          <div v-else-if="field.type === 'table' && field.columns" class="mt-1">
            <div
              v-for="(row, rIdx) in (form.content[field.key] || [])"
              :key="rIdx"
              class="mb-2 p-2 border border-[#eee] rounded-lg bg-[#fafafa]"
            >
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs text-[#999]">第{{ rIdx + 1 }}行</span>
                <van-icon
                  v-if="(form.content[field.key] || []).length > 1"
                  name="cross"
                  class="text-[#999] cursor-pointer"
                  @click="removeTableRow(field.key, rIdx)"
                />
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div v-for="col in field.columns" :key="col">
                  <div class="text-[10px] text-[#999]">{{ col }}</div>
                  <input
                    v-model="row[col]"
                    :type="field.columnsType && field.columnsType[col] === 'number' ? 'number' : 'text'"
                    class="w-full px-2 py-1 border border-[#ddd] rounded text-xs focus:outline-none focus:border-primary"
                    placeholder="请输入"
                  />
                </div>
              </div>
            </div>
            <div
              class="flex items-center justify-center gap-1 py-2 border border-dashed border-[#ddd] rounded-lg cursor-pointer text-xs text-[#999]"
              @click="addTableRow(field.key, field.columns!)"
            >
              <van-icon name="plus" /> 添加一行
            </div>
          </div>

          <!-- required marker -->
          <div v-if="isFieldRequired(field)" class="text-[10px] text-[#ff4d4f] mt-0.5">* 必填</div>
        </div>
      </div>

      <!-- Dynamic approval flow -->
      <div class="mb-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm text-[#666]">审批流程</span>
          <span class="text-xs text-[#999]">未指定审批人的环节将自动跳过</span>
        </div>

        <!-- rule adjustments -->
        <div
          v-for="(adj, i) in approvalSteps.adjustments"
          :key="i"
          class="mb-2 text-xs px-2.5 py-1.5 rounded"
          :class="adj.level === 'warning' ? 'bg-[#fff7e6] text-[#faad14]' : 'bg-[#f0f7ff] text-primary'"
        >
          <van-icon name="info-o" class="mr-1" />{{ adj.message }}
        </div>

        <!-- steps -->
        <div
          v-for="(step, idx) in approvalSteps.steps"
          :key="idx"
          class="mb-3 border border-[#eee] rounded-lg p-3"
        >
          <div class="flex items-center justify-between mb-2">
            <div>
              <span class="text-sm text-[#333] font-medium">第{{ idx + 1 }}级 · {{ step.stepName }}</span>
              <span v-if="step.desc" class="text-xs text-[#999] ml-2">{{ step.desc }}</span>
            </div>
          </div>
          <div v-if="form.stepApprovers[idx]" class="flex items-center gap-2 mb-2">
            <Avatar
              :size="28"
              :src="form.stepApprovers[idx]?.faceURL"
              :desc="form.stepApprovers[idx]?.nickname"
            />
            <span class="text-xs text-[#333]">{{ form.stepApprovers[idx]?.nickname }}</span>
            <van-icon name="cross" class="text-[#999] cursor-pointer" @click="removeStepApprover(idx)" />
          </div>
          <div v-else class="text-xs text-[#faad14] mb-2">未指定审批人</div>
          <van-button size="small" type="primary" plain round @click="openPicker(idx)">
            选择审批人
          </van-button>
        </div>
      </div>

      <!-- Submit -->
      <van-button
        type="primary"
        block
        round
        :disabled="!canSubmit"
        :class="{ 'opacity-50 grayscale': !canSubmit }"
        @click="submit"
      >
        提交审批
      </van-button>
    </div>

    <!-- Approver picker modal -->
    <van-popup v-model:show="showPicker" position="bottom" round>
      <div class="p-4">
        <div class="text-center text-sm font-medium mb-1">
          选择审批人
        </div>
        <div v-if="pickerStep !== null" class="text-center text-xs text-[#999] mb-3">
          当前环节：{{ approvalSteps.steps[pickerStep]?.stepName }}
        </div>
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
import {
  APPROVAL_TEMPLATES,
  getAdjustedSteps,
  calcTableTotal,
} from '@/utils/approvalTemplate'
import type { TemplateField } from '@/utils/approvalTemplate'
import { feedbackToast } from '@/utils/common'

const router = useRouter()
const approvalStore = useApprovalStore()
const contactStore = useContactStore()
const userStore = useUserStore()

const templates = Object.values(APPROVAL_TEMPLATES)
const currentTemplate = computed(
  () => APPROVAL_TEMPLATES[form.type] || APPROVAL_TEMPLATES.expense,
)

const form = reactive({
  type: 'expense' as string,
  title: '',
  content: {} as Record<string, any>,
  stepApprovers: [] as Array<{ userID: string; nickname: string; faceURL: string } | null>,
})

const showPicker = ref(false)
const pickerStep = ref<number | null>(null)

const todayStr = () => {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

const initContent = (tplType: string) => {
  const tpl = APPROVAL_TEMPLATES[tplType]
  if (!tpl) return
  const content: Record<string, any> = {}
  tpl.fields.forEach((f) => {
    if (f.type === 'checkbox') {
      content[f.key] = []
    } else if (f.type === 'table') {
      // 费用明细：初始保留一行空行
      content[f.key] = []
    } else if (f.autoFill) {
      if (f.key === 'applyDate') content[f.key] = todayStr()
      else if (f.key === 'name') content[f.key] = userStore.selfInfo?.nickname || ''
      else if (f.key === 'employeeId') content[f.key] = userStore.selfInfo?.userID || ''
    } else {
      content[f.key] = ''
    }
  })
  // 支出费用明细至少一行
  if (tplType === 'expense') {
    content.items = [{ '预算编号': '', '项目': '', '部门': '', '摘要': '', '金额': '' }]
  }
  return content
}

const selectTemplate = (type: string) => {
  form.type = type
  form.content = initContent(type) || {}
  form.title = APPROVAL_TEMPLATES[type].typeName
}

// 当前模板的可见字段
const visibleFields = computed<TemplateField[]>(() => {
  return currentTemplate.value.fields.filter((f) => {
    if (f.visibleWhen) return f.visibleWhen(form.content)
    return true
  })
})

// 动态审批流程（含规则调整）
const approvalSteps = computed(() => {
  return getAdjustedSteps(form.type, form.content)
})

// 步骤变化时同步审批人槽位（按环节名对齐，避免动态规则导致审批人错位）
watch(
  () => approvalSteps.value.steps.map((s) => s.stepName),
  (newStepNames, oldStepNames) => {
    const oldApprovers = [...form.stepApprovers]
    form.stepApprovers = newStepNames.map((name) => {
      const oldIdx = oldStepNames?.indexOf(name)
      if (oldIdx !== undefined && oldIdx > -1 && oldApprovers[oldIdx]) {
        return oldApprovers[oldIdx]
      }
      return null
    })
  },
  { immediate: true },
)

// 费用明细金额合计自动计算
watch(
  () => form.content.items,
  (items) => {
    const total = calcTableTotal(items || [], '金额')
    form.content.totalAmount = total ? total.toFixed(2) : ''
  },
  { deep: true },
)

const isFieldRequired = (field: TemplateField) => {
  if (field.required) return true
  if (field.requiredWhen) return field.requiredWhen(form.content)
  return false
}

const toggleCheckbox = (key: string, opt: string) => {
  const arr = (form.content[key] as string[]) || []
  const idx = arr.indexOf(opt)
  if (idx > -1) arr.splice(idx, 1)
  else arr.push(opt)
}

const addTableRow = (key: string, columns: string[]) => {
  if (!form.content[key]) form.content[key] = []
  const row: Record<string, string> = {}
  columns.forEach((c) => (row[c] = ''))
  form.content[key].push(row)
}

const removeTableRow = (key: string, idx: number) => {
  form.content[key].splice(idx, 1)
}

const openPicker = (idx: number) => {
  pickerStep.value = idx
  showPicker.value = true
}

const pickApprover = (friend: any) => {
  if (pickerStep.value === null) return
  const idx = pickerStep.value
  // 同一人不能重复选择到其他环节
  const duplicated = form.stepApprovers.some(
    (a, i) => i !== idx && a && a.userID === friend.userID,
  )
  if (duplicated) {
    feedbackToast({ message: '该审批人已被其他环节选择' })
    return
  }
  form.stepApprovers[idx] = {
    userID: friend.userID,
    nickname: friend.nickname,
    faceURL: friend.faceURL,
  }
  showPicker.value = false
}

const removeStepApprover = (idx: number) => {
  form.stepApprovers[idx] = null
}

const canSubmit = computed(() => {
  if (!form.title.trim()) return false
  // 必填字段校验
  for (const field of visibleFields.value) {
    if (!isFieldRequired(field)) continue
    const val = form.content[field.key]
    if (Array.isArray(val)) {
      if (val.length === 0) return false
    } else if (val === undefined || val === null || String(val).trim() === '') {
      return false
    }
  }
  return true
})

const submit = async () => {
  const steps = approvalSteps.value.steps
  const approvers = steps.map((_, idx) => form.stepApprovers[idx] || null)
  await approvalStore.createApproval({
    title: form.title,
    type: form.type,
    applicant: {
      userID: userStore.selfInfo?.userID || '',
      nickname: userStore.selfInfo?.nickname || '',
      faceURL: userStore.selfInfo?.faceURL || '',
    },
    content: JSON.parse(JSON.stringify(form.content)),
    approvers,
    steps,
    adjustments: approvalSteps.value.adjustments.map((a) => a.message),
  })
  feedbackToast({ message: '审批已提交' })
  router.back()
}

onMounted(() => {
  if (contactStore.storeFriendList.length === 0) {
    contactStore.getFriendListFromReq()
  }
  selectTemplate('expense')
})
</script>
