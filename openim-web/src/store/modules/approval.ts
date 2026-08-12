import { defineStore } from 'pinia'
import store from '../index'
import { getIMUserID } from '@/utils/storage'
import { v4 as uuidV4 } from 'uuid'
import { IMSDK } from '@/utils/imCommon'
import type { MessageItem } from '@openim/wasm-client-sdk/lib/types/entity'

export interface ApprovalApprover {
  userID: string
  nickname: string
  faceURL: string
}

export interface ApprovalNode {
  level: number
  stepName?: string
  approver: ApprovalApprover | null
  status: 'pending' | 'approved' | 'rejected' | 'transferred' | 'withdrawn'
  comment?: string
  time?: number
  transferTo?: ApprovalApprover
}

export interface ApprovalInstance {
  id: string
  title: string
  type: string
  applicant: ApprovalApprover
  content: Record<string, any>
  nodes: ApprovalNode[]
  status: 'pending' | 'approved' | 'rejected' | 'transferred' | 'withdrawn'
  createTime: number
  updateTime: number
  adjustments?: string[]
}

import { getApprovalInstances, setApprovalInstances } from '@/utils/storage'
import { getAdjustedSteps } from '@/utils/approvalTemplate'
import type { ApprovalStepTemplate } from '@/utils/approvalTemplate'

const loadInstances = (): ApprovalInstance[] => getApprovalInstances()

const saveInstances = (list: ApprovalInstance[]) => {
  setApprovalInstances(list)
}

import { CustomMessageType } from '@/constants/enum'

const sendApprovalNotification = async (
  recvID: string,
  text: string,
  instance: ApprovalInstance,
) => {
  if (!recvID) return
  try {
    const customData = JSON.stringify({
      customType: CustomMessageType.ApprovalMessage,
      data: {
        text,
        approvalId: instance.id,
        instance,
      },
    })
    const { data: message } = await IMSDK.createCustomMessage({
      data: customData,
      extension: '',
      description: '',
    })
    await IMSDK.sendMessage({ recvID, groupID: '', message: message as MessageItem })
  } catch (error) {
    console.error('send approval notification failed', error)
  }
}

interface StateType {
  instances: ApprovalInstance[]
}

const useStore = defineStore('approval', {
  state: (): StateType => ({
    instances: loadInstances(),
  }),
  getters: {
    storeInstances: (state) => state.instances,
    storeMyApplications: (state) => {
      const uid = getIMUserID()
      return state.instances.filter((i) => i.applicant.userID === uid)
    },
    storePendingApprovals: (state) => {
      const uid = getIMUserID()
      return state.instances.filter((i) => {
        if (i.status !== 'pending') return false
        const currentNode = i.nodes.find((n) => n.status === 'pending')
        return currentNode?.approver?.userID === uid
      })
    },
    storeProcessedApprovals: (state) => {
      const uid = getIMUserID()
      return state.instances.filter((i) => {
        const hasProcessed = i.nodes.some(
          (n) => n.status !== 'pending' && n.approver?.userID === uid,
        )
        return hasProcessed || i.applicant.userID === uid
      })
    },
  },
  actions: {
    syncStorage() {
      saveInstances(this.instances)
    },
    async createApproval(payload: {
      title: string
      type: string
      applicant: ApprovalApprover
      content: Record<string, any>
      approvers: Array<ApprovalApprover | null>
      steps?: ApprovalStepTemplate[]
      adjustments?: string[]
    }) {
      const now = Date.now()
      // 步骤模板（优先使用传入的，否则按类型规则生成）
      let steps: ApprovalStepTemplate[] = payload.steps || []
      let adjustments = payload.adjustments || []
      if (!steps.length) {
        const adjusted = getAdjustedSteps(payload.type, payload.content)
        steps = adjusted.steps
        adjustments = adjusted.adjustments.map((a) => a.message)
      }
      // 步骤与审批人一一对应；未指定审批人的环节自动跳过（auto-pass），不阻塞流程
      const nodes: ApprovalNode[] = steps.map((s, idx) => {
        const approver = payload.approvers[idx] ?? null
        return {
          level: idx + 1,
          stepName: s.stepName,
          approver,
          status: approver ? 'pending' : 'approved',
          comment: approver ? '' : '未指定审批人，自动跳过',
          time: approver ? undefined : now,
        }
      })
      const instance: ApprovalInstance = {
        id: uuidV4(),
        title: payload.title,
        type: payload.type,
        applicant: payload.applicant,
        content: payload.content,
        nodes,
        status: 'pending',
        createTime: now,
        updateTime: now,
        adjustments,
      }
      this.instances.unshift(instance)
      this.syncStorage()

      // 通知第一个真正待审批的环节（自动跳过未指定审批人的环节）
      const firstPendingNode = nodes.find((n) => n.status === 'pending')
      if (firstPendingNode?.approver) {
        await sendApprovalNotification(
          firstPendingNode.approver.userID,
          `您有一条新的审批待处理：《${payload.title}》，来自 ${payload.applicant.nickname}`,
          instance,
        )
      } else {
        // 所有环节都未指定审批人，自动全部通过
        instance.status = 'approved'
        this.syncStorage()
      }

      return instance
    },
    async processApproval(payload: {
      id: string
      action: 'approved' | 'rejected' | 'transferred'
      comment?: string
      transferTo?: ApprovalApprover
    }) {
      const instance = this.instances.find((i) => i.id === payload.id)
      if (!instance) return false

      const currentNode = instance.nodes.find((n) => n.status === 'pending')
      if (!currentNode) return false

      const uid = getIMUserID()
      if (!currentNode.approver || currentNode.approver.userID !== uid) return false

      currentNode.status = payload.action
      currentNode.comment = payload.comment || ''
      currentNode.time = Date.now()

      const approverNickname = currentNode.approver?.nickname || '审批人'

      if (payload.action === 'transferred' && payload.transferTo) {
        currentNode.transferTo = payload.transferTo
        instance.nodes.splice(currentNode.level, 0, {
          level: currentNode.level + 1,
          stepName: currentNode.stepName,
          approver: payload.transferTo,
          status: 'pending',
        })
        instance.nodes.forEach((n, idx) => {
          n.level = idx + 1
        })
        await sendApprovalNotification(
          payload.transferTo.userID,
          `您有一条新的审批待处理：《${instance.title}》已被 ${approverNickname} 转交给您审批`,
          instance,
        )
        await sendApprovalNotification(
          instance.applicant.userID,
          `您的审批《${instance.title}》已被 ${approverNickname} 转交给 ${payload.transferTo.nickname}`,
          instance,
        )
      }

      if (payload.action === 'rejected') {
        instance.status = 'rejected'
        await sendApprovalNotification(
          instance.applicant.userID,
          `您的审批《${instance.title}》已被 ${approverNickname} 驳回${payload.comment ? '，原因：' + payload.comment : ''}`,
          instance,
        )
      } else if (payload.action === 'approved') {
        // 跳过未指定审批人（自动通过）的环节，找到下一个真正待审批的环节
        const nextNode = instance.nodes.find(
          (n) => n.level > currentNode.level && n.status === 'pending',
        )
        if (nextNode && nextNode.approver) {
          // 通知下一级审批人
          await sendApprovalNotification(
            nextNode.approver.userID,
            `您有一条新的审批待处理：《${instance.title}》，来自 ${instance.applicant.nickname}（第${nextNode.level}级审批）`,
            instance,
          )
          // 同步最新状态给申请人
          await sendApprovalNotification(
            instance.applicant.userID,
            `您的审批《${instance.title}》已通过第${currentNode.level}级审批（${approverNickname}），当前第${nextNode.level}级审批中`,
            instance,
          )
        } else {
          instance.status = 'approved'
          await sendApprovalNotification(
            instance.applicant.userID,
            `您的审批《${instance.title}》已通过全部审批`,
            instance,
          )
        }
      }

      instance.updateTime = Date.now()
      this.syncStorage()
      return true
    },
    async withdrawApproval(id: string) {
      const instance = this.instances.find((i) => i.id === id)
      if (!instance) return false
      // 仅申请人可撤回，且仅审批中可撤回
      if (instance.applicant.userID !== getIMUserID()) return false
      if (instance.status !== 'pending') return false
      instance.status = 'withdrawn'
      instance.updateTime = Date.now()
      // 当前待审批节点同步标记为已撤回
      instance.nodes.forEach((n) => {
        if (n.status === 'pending') {
          n.status = 'withdrawn'
          n.time = Date.now()
        }
      })
      this.syncStorage()
      // 通知当前待审批环节
      const currentNode = instance.nodes.find((n) => n.status === 'withdrawn')
      if (currentNode?.approver) {
        await sendApprovalNotification(
          currentNode.approver.userID,
          `审批《${instance.title}》已被申请人 ${instance.applicant.nickname} 撤回`,
          instance,
        )
      }
      return true
    },
    getApprovalById(id: string) {
      return this.instances.find((i) => i.id === id)
    },
    syncRemoteInstance(remoteInstance: ApprovalInstance) {
      if (!remoteInstance || !remoteInstance.id) return
      const uid = getIMUserID()
      // 仅保留与当前用户相关的审批，避免无关数据污染本地视图
      const isRelated =
        remoteInstance.applicant.userID === uid ||
        remoteInstance.nodes.some(
          (n) => n.approver?.userID === uid && n.status !== 'pending',
        ) ||
        (remoteInstance.status === 'pending' &&
          remoteInstance.nodes.some((n) => n.approver?.userID === uid))
      if (!isRelated) return
      const idx = this.instances.findIndex((i) => i.id === remoteInstance.id)
      if (idx !== -1) {
        this.instances[idx] = remoteInstance
      } else {
        this.instances.unshift(remoteInstance)
      }
      this.syncStorage()
    },
    clearStore() {
      this.instances = []
      this.syncStorage()
    },
  },
})

export default function useApprovalStore() {
  return useStore(store)
}
