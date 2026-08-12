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
  approver: ApprovalApprover
  status: 'pending' | 'approved' | 'rejected' | 'transferred'
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
  status: 'pending' | 'approved' | 'rejected' | 'transferred'
  createTime: number
  updateTime: number
}

const STORAGE_KEY = 'global_approval_instances'

const loadInstances = (): ApprovalInstance[] => {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? JSON.parse(raw) : []
}

const saveInstances = (list: ApprovalInstance[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
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
    const { data: message } = await IMSDK.createCustomMessage(customData, '', '')
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
        return currentNode?.approver.userID === uid
      })
    },
    storeProcessedApprovals: (state) => {
      const uid = getIMUserID()
      return state.instances.filter((i) => {
        const hasProcessed = i.nodes.some(
          (n) => n.status !== 'pending' && n.approver.userID === uid,
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
      approvers: ApprovalApprover[]
    }) {
      const now = Date.now()
      const instance: ApprovalInstance = {
        id: uuidV4(),
        title: payload.title,
        type: payload.type,
        applicant: payload.applicant,
        content: payload.content,
        nodes: payload.approvers.map((a, idx) => ({
          level: idx + 1,
          approver: a,
          status: idx === 0 ? 'pending' : 'pending',
        })),
        status: 'pending',
        createTime: now,
        updateTime: now,
      }
      this.instances.unshift(instance)
      this.syncStorage()

      const firstApprover = payload.approvers[0]
      if (firstApprover) {
        await sendApprovalNotification(
          firstApprover.userID,
          `您有一条新的审批待处理：《${payload.title}》，来自 ${payload.applicant.nickname}`,
          instance,
        )
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
      if (currentNode.approver.userID !== uid) return false

      currentNode.status = payload.action
      currentNode.comment = payload.comment || ''
      currentNode.time = Date.now()

      const approverNickname = currentNode.approver.nickname

      if (payload.action === 'transferred' && payload.transferTo) {
        currentNode.transferTo = payload.transferTo
        instance.nodes.splice(currentNode.level, 0, {
          level: currentNode.level + 1,
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
        const nextNode = instance.nodes.find((n) => n.level === currentNode.level + 1)
        if (nextNode) {
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
    getApprovalById(id: string) {
      return this.instances.find((i) => i.id === id)
    },
    syncRemoteInstance(remoteInstance: ApprovalInstance) {
      if (!remoteInstance || !remoteInstance.id) return
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
