// 审批工作流模板定义与动态规则引擎
// 依据《审批工作流开发文档》实现：
// - 两类审批单：工资发放审批（4级）、支出审批（5级 + 特殊规则）
// - 支出特殊规则：金额阈值跳过、大额借款追加、预算外追加

export interface ApprovalStepTemplate {
  stepName: string
  role: string
  desc?: string
}

export interface TemplateField {
  key: string
  label: string
  type: 'text' | 'date' | 'month' | 'textarea' | 'select' | 'checkbox' | 'table' | 'readonly'
  placeholder?: string
  options?: string[]
  columns?: string[]
  columnsType?: Record<string, 'text' | 'number'>
  required?: boolean
  autoFill?: boolean
  fullRow?: boolean
  // 条件必填：返回 true 表示必填
  requiredWhen?: (content: Record<string, any>) => boolean
  // 条件显示：返回 false 表示隐藏
  visibleWhen?: (content: Record<string, any>) => boolean
  // 金额列 key（用于表格金额合计）
  amountColumn?: string
}

export interface ApprovalFormTemplate {
  type: string
  typeName: string
  description: string
  steps: ApprovalStepTemplate[]
  fields: TemplateField[]
}

// 费用明细列（支出审批）
const EXPENSE_ITEM_COLUMNS = ['预算编号', '项目', '部门', '摘要', '金额']
const EXPENSE_ITEM_COLUMNS_TYPE: Record<string, 'text' | 'number'> = {
  金额: 'number',
}

export const APPROVAL_TEMPLATES: Record<string, ApprovalFormTemplate> = {
  // ============ 支出审批单 ============
  expense: {
    type: 'expense',
    typeName: '支出审批单',
    description: '适用于借款、报销、提现、预付、还款还票等支出事项',
    steps: [
      { stepName: '科室负责人审批', role: 'dept_head', desc: '基础环节' },
      { stepName: '上级科室负责人审批', role: 'superior_dept_head', desc: '总金额≤5000元时自动跳过' },
      { stepName: '财务主管审核', role: 'finance_supervisor', desc: '基础环节' },
      { stepName: '财务负责人审批', role: 'finance_manager', desc: '基础环节' },
      { stepName: '院长审批', role: 'dean', desc: '基础环节' },
    ],
    fields: [
      {
        key: 'applyDate',
        label: '申请日期',
        type: 'date',
        autoFill: true,
        required: true,
      },
      {
        key: 'department',
        label: '科室',
        type: 'select',
        required: true,
        placeholder: '请选择科室',
        options: [
          '财务科',
          '人事科',
          '信息科',
          '医务科',
          '护理部',
          '后勤保障科',
          '门诊部',
          '急诊科',
          '内科',
          '外科',
        ],
      },
      {
        key: 'name',
        label: '姓名',
        type: 'readonly',
        autoFill: true,
        required: true,
      },
      {
        key: 'employeeId',
        label: '员工编号',
        type: 'readonly',
        autoFill: true,
        required: true,
      },
      {
        key: 'docType',
        label: '单据类型',
        type: 'select',
        required: true,
        options: ['借款', '报销', '提现', '预付', '还款还票'],
      },
      {
        key: 'budgetType',
        label: '预算类型',
        type: 'select',
        required: true,
        options: ['预算内', '预算外'],
      },
      {
        key: 'payMethod',
        label: '支付方式',
        type: 'select',
        required: true,
        options: ['现金', '银行卡', '托收', '支票', '电汇'],
      },
      {
        key: 'receiverName',
        label: '收款单位名称',
        type: 'text',
        required: true,
        requiredWhen: (c) => c.payMethod && c.payMethod !== '现金',
        visibleWhen: (c) => c.payMethod && c.payMethod !== '现金',
      },
      {
        key: 'receiverBank',
        label: '开户银行',
        type: 'text',
        required: true,
        requiredWhen: (c) => c.payMethod && c.payMethod !== '现金',
        visibleWhen: (c) => c.payMethod && c.payMethod !== '现金',
      },
      {
        key: 'receiverAccount',
        label: '银行账号',
        type: 'text',
        required: true,
        requiredWhen: (c) => c.payMethod && c.payMethod !== '现金',
        visibleWhen: (c) => c.payMethod && c.payMethod !== '现金',
      },
      {
        key: 'contractNo',
        label: '合同书编号',
        type: 'text',
      },
      {
        key: 'contractName',
        label: '合同书名称',
        type: 'text',
      },
      {
        key: 'tripLocation',
        label: '出差地点',
        type: 'text',
        requiredWhen: (c) => c.docType === '报销',
        visibleWhen: (c) => c.docType === '报销',
      },
      {
        key: 'tripPeriod',
        label: '出差期间',
        type: 'text',
        placeholder: '如：2026-08-01 ~ 2026-08-05',
        requiredWhen: (c) => c.docType === '报销',
        visibleWhen: (c) => c.docType === '报销',
      },
      {
        key: 'items',
        label: '费用明细',
        type: 'table',
        required: true,
        columns: EXPENSE_ITEM_COLUMNS,
        columnsType: EXPENSE_ITEM_COLUMNS_TYPE,
        amountColumn: '金额',
      },
      {
        key: 'totalAmount',
        label: '合计金额(元)',
        type: 'readonly',
        autoFill: true,
      },
      {
        key: 'budgetAttachment',
        label: '预算追加说明',
        type: 'text',
        placeholder: '预算外支出必填，请填写预算追加说明',
        required: true,
        requiredWhen: (c) => c.budgetType === '预算外',
        visibleWhen: (c) => c.budgetType === '预算外',
      },
    ],
  },

  // ============ 工资发放审批单 ============
  salary: {
    type: 'salary',
    typeName: '工资发放审批单',
    description: '适用于医院月度工资发放审批',
    steps: [
      { stepName: '人事核算人', role: 'hr_calculator', desc: '基础环节' },
      { stepName: '财务会计复核', role: 'finance_accountant', desc: '基础环节' },
      { stepName: '财务负责人审批', role: 'finance_manager', desc: '基础环节' },
      { stepName: '院长审批', role: 'dean', desc: '基础环节' },
    ],
    fields: [
      {
        key: 'department',
        label: '所属部门',
        type: 'text',
        required: true,
      },
      {
        key: 'salaryMonth',
        label: '工资发放月份',
        type: 'month',
        required: true,
        placeholder: '如 2026-08',
      },
      {
        key: 'applyDate',
        label: '申请日期',
        type: 'date',
        autoFill: true,
        required: true,
      },
      {
        key: 'totalPeople',
        label: '发放总人数',
        type: 'text',
        required: true,
      },
      {
        key: 'shouldPay',
        label: '应发总金额(元)',
        type: 'text',
        required: true,
      },
      {
        key: 'actualPay',
        label: '实发总金额(元)',
        type: 'text',
        required: true,
      },
      {
        key: 'bankCount',
        label: '银行代发总笔数',
        type: 'text',
      },
      {
        key: 'bankAmount',
        label: '代发总金额(元)',
        type: 'text',
      },
      {
        key: 'cashAmount',
        label: '现金发放总金额(元)',
        type: 'text',
      },
      {
        key: 'attachments',
        label: '附件明细清单',
        type: 'checkbox',
        required: true,
        options: [
          '工资发放明细表',
          '考勤统计表',
          '社保公积金扣缴明细表',
          '个税代扣代缴明细表',
          '绩效奖金核算表',
          '银行代发清单',
          '现金发放签收表',
          '加班补贴明细表',
          '人员增减变动表',
          '其他相关附件',
        ],
      },
    ],
  },
}

// ============ 支出审批动态规则引擎 ============
// 依据文档 3.2 支出审批流程特殊规则
export interface StepAdjustment {
  message: string
  level?: 'info' | 'warning'
}

export interface AdjustedSteps {
  steps: ApprovalStepTemplate[]
  adjustments: StepAdjustment[]
  totalAmount: number
}

export const EXPENSE_TOTAL_THRESHOLD = 5000
export const EXPENSE_LOAN_LARGE_THRESHOLD = 10000

export const adjustExpenseSteps = (
  baseSteps: ApprovalStepTemplate[],
  content: Record<string, any>,
): AdjustedSteps => {
  const steps = [...baseSteps]
  const adjustments: StepAdjustment[] = []
  const items = Array.isArray(content.items) ? content.items : []
  const totalAmount = items.reduce((sum, item) => {
    const amount = parseFloat(item?.['金额']) || 0
    return sum + amount
  }, 0)
  const docType = content.docType
  const budgetType = content.budgetType

  // 规则1：总金额 ≤ 5000 元 → 跳过"上级科室负责人审批"环节
  if (totalAmount > 0 && totalAmount <= EXPENSE_TOTAL_THRESHOLD) {
    const idx = steps.findIndex((s) => s.stepName === '上级科室负责人审批')
    if (idx !== -1) {
      steps.splice(idx, 1)
      adjustments.push({
        message: `总金额 ${totalAmount} 元 ≤ ${EXPENSE_TOTAL_THRESHOLD} 元，已自动跳过"上级科室负责人审批"环节`,
      })
    }
  }

  // 规则2：单据类型=借款 且 总金额 > 10000 元 → 在"院长审批"前增加"分管副院长审批"环节
  if (docType === '借款' && totalAmount > EXPENSE_LOAN_LARGE_THRESHOLD) {
    const deanIdx = steps.findIndex((s) => s.stepName === '院长审批')
    if (deanIdx !== -1) {
      steps.splice(deanIdx, 0, { stepName: '分管副院长审批', role: 'vice_dean', desc: '大额借款追加环节' })
      adjustments.push({
        message: `借款金额 ${totalAmount} 元 > ${EXPENSE_LOAN_LARGE_THRESHOLD} 元，已增加"分管副院长审批"环节`,
        level: 'warning',
      })
    }
  }

  // 规则3：预算类型=预算外 → 在"院长审批"后追加"预算管理委员会审批"环节
  if (budgetType === '预算外') {
    steps.push({ stepName: '预算管理委员会审批', role: 'budget_committee', desc: '预算外追加环节' })
    adjustments.push({
      message: '预算外支出，已追加"预算管理委员会审批"环节（必须附预算追加说明）',
      level: 'warning',
    })
  }

  return { steps, adjustments, totalAmount }
}

// 通用：获取某类型的最终审批步骤（含动态规则）
export const getAdjustedSteps = (
  type: string,
  content: Record<string, any>,
): AdjustedSteps => {
  const template = APPROVAL_TEMPLATES[type]
  if (!template) {
    return { steps: [], adjustments: [], totalAmount: 0 }
  }
  if (type === 'expense') {
    return adjustExpenseSteps(template.steps, content)
  }
  return { steps: [...template.steps], adjustments: [], totalAmount: 0 }
}

// 计算表格合计金额
export const calcTableTotal = (
  items: Record<string, any>[],
  amountColumn: string,
): number => {
  return (items || []).reduce((sum, item) => {
    return sum + (parseFloat(item?.[amountColumn]) || 0)
  }, 0)
}
