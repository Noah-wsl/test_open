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
            v-if="field.type === 'text' || field.type === 'date'"
            v-model="form.content[field.key]"
            :type="field.type"
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
          <div v-else-if="field.type === 'table' && field.columns" class="mt-1">
            <div
              v-for="(row, rIdx) in (form.content[field.key] || [])"
              :key="rIdx"
              class="mb-2 p-2 border border-[#eee] rounded-lg bg-[#fafafa]"
            >
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs text-[#999]">第{{ rIdx + 1 }}行</span>
                <van-icon
                  v-if="!field.presetRows"
                  name="cross"
                  class="text-[#999] cursor-pointer"
                  @click="removeTableRow(field.key, rIdx)"
                />
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div v-for="col in field.columns" :key="col">
                  <div class="text-[10px] text-[#999]">{{ col }}</div>
                  <span
                    v-if="field.readonlyColumns && field.readonlyColumns.includes(col)"
                    class="text-xs text-[#333] block py-1"
                  >{{ row[col] }}</span>
                  <select
                    v-else-if="col === '是否已核对'"
                    v-model="row[col]"
                    class="w-full px-2 py-1 border border-[#ddd] rounded text-xs focus:outline-none focus:border-primary bg-white"
                  >
                    <option value="">请选择</option>
                    <option value="是">是</option>
                    <option value="否">否</option>
                  </select>
                  <input
                    v-else
                    v-model="row[col]"
                    class="w-full px-2 py-1 border border-[#ddd] rounded text-xs focus:outline-none focus:border-primary"
                    placeholder="请输入"
                  />
                </div>
              </div>
            </div>
            <div
              v-if="!field.presetRows"
              class="flex items-center justify-center gap-1 py-2 border border-dashed border-[#ddd] rounded-lg cursor-pointer text-xs text-[#999]"
              @click="addTableRow(field.key, field.columns)"
            >
              <van-icon name="plus" /> 添加一行
            </div>
          </div>
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
    value: 'expense',
    label: '支出审批单',
    fields: [
      { key: 'applyDate', label: '申请日期', type: 'date', placeholder: '请选择申请日期' },
      { key: 'department', label: '科室', type: 'text', placeholder: '请输入科室' },
      { key: 'name', label: '姓名', type: 'text', placeholder: '请输入姓名' },
      { key: 'employeeId', label: '员工编号', type: 'text', placeholder: '请输入员工编号' },
      { key: 'docType', label: '单据类型', type: 'checkbox', options: ['借款', '报销', '提现', '预付', '还款/还票', '预算内', '预算外'] },
      { key: 'payMethod', label: '支付方式', type: 'checkbox', options: ['现金', '银行卡', '托收', '支票', '电汇'] },
      { key: 'receiverName', label: '收款单位名称', type: 'text', placeholder: '请输入收款单位名称' },
      { key: 'receiverBank', label: '收款单位开户银行', type: 'text', placeholder: '请输入开户银行' },
      { key: 'receiverAccount', label: '收款单位账号', type: 'text', placeholder: '请输入账号' },
      { key: 'contractNo', label: '合同书编号', type: 'text', placeholder: '请输入合同书编号' },
      { key: 'contractName', label: '合同书名称', type: 'text', placeholder: '请输入合同书名称' },
      { key: 'tripLocation', label: '出差地点', type: 'text', placeholder: '请输入出差地点' },
      { key: 'tripPeriod', label: '出差期间', type: 'text', placeholder: '请输入出差期间' },
      { key: 'items', label: '费用明细', type: 'table', columns: ['预算编号', '预算项目', '费用所属部门', '摘要', '金额'] },
      { key: 'totalAmount', label: '合计金额', type: 'text', placeholder: '0.00' },
      { key: 'totalAmountCn', label: '合计大写', type: 'text', placeholder: '请输入大写金额' },
    ],
  },
  {
    value: 'salary',
    label: '工资发放审批单',
    fields: [
      { key: 'department', label: '所属部门', type: 'text', placeholder: '请输入所属部门' },
      { key: 'salaryMonth', label: '工资发放月份', type: 'text', placeholder: '2025-01' },
      { key: 'applyDate', label: '申请日期', type: 'date', placeholder: '请选择申请日期' },
      { key: 'totalPeople', label: '发放总人数', type: 'text', placeholder: '0' },
      { key: 'shouldPay', label: '应发总金额（元）', type: 'text', placeholder: '0.00' },
      { key: 'actualPay', label: '实发总金额（元）', type: 'text', placeholder: '0.00' },
      { key: 'bankCount', label: '银行代发总笔数', type: 'text', placeholder: '0' },
      { key: 'bankAmount', label: '代发总金额（元）', type: 'text', placeholder: '0.00' },
      { key: 'cashAmount', label: '现金发放总金额（元）', type: 'text', placeholder: '0.00' },
      {
        key: 'attachments',
        label: '附件明细清单',
        type: 'table',
        columns: ['序号', '附件名称', '是否已核对', '备注'],
        presetRows: [
          { '序号': '1', '附件名称': '月度工资核算表', '是否已核对': '', '备注': '含考勤、绩效、扣款明细' },
          { '序号': '2', '附件名称': '绩效工资核算表', '是否已核对': '', '备注': '含考核打分、绩效标准' },
          { '序号': '3', '附件名称': '社保公积金扣款明细表', '是否已核对': '', '备注': '个人+单位部分核对' },
          { '序号': '4', '附件名称': '个税计算表', '是否已核对': '', '备注': '累计预扣法核对' },
          { '序号': '5', '附件名称': '考勤请假扣款明细表', '是否已核对': '', '备注': '事假、病假、旷工扣款' },
          { '序号': '6', '附件名称': '补贴发放明细表', '是否已核对': '', '备注': '交通、餐补、通讯补等' },
          { '序号': '7', '附件名称': '离职人员薪资结算表', '是否已核对': '', '备注': '含离职交接单、扣款说明' },
          { '序号': '8', '附件名称': '薪资异动审批单（补发/追扣）', '是否已核对': '', '备注': '单独审批附件' },
          { '序号': '9', '附件名称': '外聘专家劳务费审批表', '是否已核对': '', '备注': '单独劳务发放附件' },
          { '序号': '10', '附件名称': '其他附件', '是否已核对': '', '备注': '' },
        ],
        readonlyColumns: ['序号', '附件名称'],
      },
      { key: 'notes', label: '备注说明', type: 'textarea', placeholder: '1. 所有附件必须随审批单一并提交，无附件的审批申请一律不予受理；\n2. 薪资发放必须完成全流程审批签字，严禁口头同意、事后补签；\n3. 离职人员薪资、补发/追扣工资、劳务费必须单独标注，额外附审批附件；\n4. 审批完成后，审批单、工资表、附件统一归档留存，保存期限不低于3年；\n5. 财务付款前必须核对审批手续完整性，手续不全严禁付款。' },
    ],
  },
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

const currentTemplate = computed(() => templates.find((t) => t.value === form.type) || templates[0])

const form = reactive({
  type: 'expense',
  title: '',
  content: {} as Record<string, any>,
  approvers: [] as { userID: string; nickname: string; faceURL: string }[],
})

const showPicker = ref(false)

const selectTemplate = (t: typeof templates[0]) => {
  form.type = t.value
  form.content = {}
  t.fields.forEach((f: any) => {
    if (f.type === 'checkbox') {
      form.content[f.key] = []
    } else if (f.type === 'table') {
      if (f.presetRows) {
        form.content[f.key] = JSON.parse(JSON.stringify(f.presetRows))
      } else {
        form.content[f.key] = []
      }
    }
  })
  form.title = t.label
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

const toggleCheckbox = (key: string, opt: string) => {
  const arr = (form.content[key] as string[]) || []
  const idx = arr.indexOf(opt)
  if (idx > -1) {
    arr.splice(idx, 1)
  } else {
    arr.push(opt)
  }
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

const canSubmit = computed(() => {
  if (!form.title.trim() || form.approvers.length === 0) return false
  const vals = Object.values(form.content)
  return vals.some((v) => {
    if (Array.isArray(v)) return v.length > 0
    if (typeof v === 'string') return v.trim()
    return false
  })
})

const submit = async () => {
  await approvalStore.createApproval({
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
  selectTemplate(templates[0])
})
</script>
