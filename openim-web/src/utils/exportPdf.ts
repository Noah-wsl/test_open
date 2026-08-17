import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import dayjs from 'dayjs'
import type { ApprovalInstance } from '@/store/modules/approval'
import { APPROVAL_TEMPLATES } from '@/utils/approvalTemplate'

// 完整时间：2026年08月17日 14:30:25
const formatFullTime = (ts?: number): string =>
  ts ? dayjs(ts).format('YYYY年MM月DD日 HH:mm:ss') : ''

const escapeHtml = (s: unknown): string => {
  if (s === null || s === undefined) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const NODE_STATUS_TEXT: Record<string, string> = {
  pending: '待审批',
  approved: '已通过',
  rejected: '已驳回',
  transferred: '已转交',
  withdrawn: '已撤回',
}

const INSTANCE_STATUS_TEXT: Record<string, string> = {
  pending: '审批中',
  approved: '已通过',
  rejected: '已驳回',
  withdrawn: '已撤回',
}

// 审批内容字段渲染（字符串 / 字符串数组 / 对象数组表格）
const renderContent = (instance: ApprovalInstance): string => {
  const tpl = APPROVAL_TEMPLATES[instance.type]
  const rows: string[] = []
  for (const [key, val] of Object.entries(instance.content || {})) {
    const label = tpl?.fields.find((f) => f.key === key)?.label || key
    let valueHtml = ''
    if (Array.isArray(val) && val.length && typeof val[0] === 'string') {
      valueHtml = val
        .map((v) => `<span style="display:inline-block;padding:2px 8px;margin:2px 4px 2px 0;border:1px solid #d9e6f2;border-radius:3px;background:#f0f7ff;color:#1677ff;font-size:12px;">${escapeHtml(v)}</span>`)
        .join('')
    } else if (Array.isArray(val) && val.length && typeof val[0] === 'object') {
      const cols = Object.keys(val[0] as Record<string, any>)
      const head = cols.map((c) => `<th style="padding:5px 8px;border:1px solid #d9d9d9;background:#f5f7fa;font-weight:500;">${escapeHtml(c)}</th>`).join('')
      const body = (val as Record<string, any>[])
        .map(
          (row) =>
            `<tr>${cols.map((c) => `<td style="padding:5px 8px;border:1px solid #d9d9d9;">${escapeHtml(row[c] ?? '-')}</td>`).join('')}</tr>`,
        )
        .join('')
      valueHtml = `<table style="width:100%;border-collapse:collapse;font-size:12px;">${head ? `<thead><tr>${head}</tr></thead>` : ''}<tbody>${body}</tbody></table>`
    } else {
      valueHtml = `<span>${escapeHtml(val)}</span>`
    }
    rows.push(
      `<div style="display:flex;margin-bottom:8px;line-height:20px;">
        <div style="width:90px;flex-shrink:0;color:#999;font-size:12px;">${escapeHtml(label)}</div>
        <div style="flex:1;font-size:13px;color:#333;word-break:break-all;">${valueHtml}</div>
      </div>`,
    )
  }
  return rows.join('')
}

// 审批流程节点渲染
const renderNodes = (instance: ApprovalInstance): string => {
  return instance.nodes
    .filter((n) => n.approver)
    .map((n) => {
      const status = NODE_STATUS_TEXT[n.status] || n.status
      const statusColor =
        n.status === 'approved'
          ? '#52c41a'
          : n.status === 'rejected'
            ? '#ff4d4f'
            : n.status === 'pending'
              ? '#faad14'
              : '#999'
      return `<div style="padding:10px 12px;margin-bottom:10px;border:1px solid #eee;border-radius:6px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:13px;color:#333;">第${n.level}级 · ${escapeHtml(n.stepName || '')} · ${escapeHtml(n.approver?.nickname || '')}</span>
          <span style="font-size:12px;color:${statusColor};flex-shrink:0;margin-left:8px;">${escapeHtml(status)}</span>
        </div>
        ${n.time ? `<div style="margin-top:4px;font-size:12px;color:#999;">${escapeHtml(formatFullTime(n.time))}</div>` : ''}
        ${n.comment ? `<div style="margin-top:4px;font-size:12px;color:#666;">意见：${escapeHtml(n.comment)}</div>` : ''}
        ${n.transferTo ? `<div style="margin-top:4px;font-size:12px;color:#999;">转交给：${escapeHtml(n.transferTo.nickname)}</div>` : ''}
      </div>`
    })
    .join('')
}

const buildHtml = (instance: ApprovalInstance): string => {
  const adjustmentsHtml = (instance.adjustments || [])
    .map(
      (a) =>
        `<div style="padding:6px 10px;margin-bottom:6px;border-radius:4px;background:#fff7e6;color:#faad14;font-size:12px;">${escapeHtml(a)}</div>`,
    )
    .join('')

  return `
    <div style="width:794px;padding:32px 40px;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;box-sizing:border-box;">
      <div style="text-align:center;font-size:22px;font-weight:600;color:#333;margin-bottom:24px;">审 批 单</div>

      <div style="margin-bottom:20px;font-size:13px;color:#333;line-height:26px;">
        <div style="display:flex;"><div style="width:90px;color:#999;flex-shrink:0;">申请人</div><div>${escapeHtml(instance.applicant.nickname)}</div></div>
        <div style="display:flex;"><div style="width:90px;color:#999;flex-shrink:0;">提交时间</div><div>${escapeHtml(formatFullTime(instance.createTime))}</div></div>
        <div style="display:flex;"><div style="width:90px;color:#999;flex-shrink:0;">当前状态</div><div>${escapeHtml(INSTANCE_STATUS_TEXT[instance.status] || instance.status)}</div></div>
      </div>

      <div style="font-size:16px;font-weight:600;color:#333;margin-bottom:12px;">${escapeHtml(instance.title)}</div>

      <div style="font-size:14px;font-weight:600;color:#333;margin:20px 0 12px;padding-bottom:8px;border-bottom:1px solid #eee;">审批内容</div>
      ${renderContent(instance)}

      ${adjustmentsHtml ? `<div style="font-size:14px;font-weight:600;color:#333;margin:20px 0 12px;padding-bottom:8px;border-bottom:1px solid #eee;">审批规则说明</div>${adjustmentsHtml}` : ''}

      <div style="font-size:14px;font-weight:600;color:#333;margin:20px 0 12px;padding-bottom:8px;border-bottom:1px solid #eee;">审批流程</div>
      ${renderNodes(instance)}
    </div>
  `
}

// 导出审批单为 PDF（A4，内容过长自动分页）
export const exportApprovalToPdf = async (instance: ApprovalInstance) => {
  const container = document.createElement('div')
  container.style.cssText =
    'position:fixed;left:-9999px;top:0;width:794px;z-index:-9999;pointer-events:none;'
  container.innerHTML = buildHtml(instance)
  document.body.appendChild(container)
  try {
    // 等待字体加载完成，避免中文渲染为方块
    try {
      await document.fonts?.ready
    } catch {}

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    })

    const imgData = canvas.toDataURL('image/jpeg', 0.95)
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = 210
    const pageHeight = 297
    const imgHeight = (canvas.height * pageWidth) / canvas.width

    let heightLeft = imgHeight
    let position = 0
    pdf.addImage(imgData, 'JPEG', 0, position, pageWidth, imgHeight)
    heightLeft -= pageHeight
    while (heightLeft > 0) {
      position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(imgData, 'JPEG', 0, position, pageWidth, imgHeight)
      heightLeft -= pageHeight
    }

    const safeTitle = (instance.title || '审批单').replace(/[\\/:*?"<>|]/g, '_')
    const dateStr = new Date(instance.createTime).toISOString().slice(0, 10)
    pdf.save(`审批单_${safeTitle}_${dateStr}.pdf`)
  } finally {
    container.remove()
  }
}
