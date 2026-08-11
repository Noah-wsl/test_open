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

const STORAGE_KEY = (uid: string) => `${uid}_approval_instances`

const loadInstances = (): ApprovalInstance[] => {
  const uid = getIMUserID()
  if (!uid) return []
  const raw = localStorage.getItem(STORAGE_KEY(uid))
  return raw ? JSON.parse(raw) : []
}

const saveInstances = (list: ApprovalInstance[]) => {
  const uid = getIMUserID()
  if (!uid) return
  localStorage.setItem(STORAGE_KEY(uid), JSON.stringify(list))
}

const sendApprovalNotification = async (recvID: string, text: string) => {
  if (!recvID) return
  try {
    const { data: message } = await IMSDK.createTextMessage(text)
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
          `您有一条新的审批待处理：《${payload.title}》，来自 ${payload.applicant.nickname}`
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
          `您有一条新的审批待处理：《${instance.title}》已被 ${approverNickname} 转交给您审批`
        )
      }

      if (payload.action === 'rejected') {
        instance.status = 'rejected'
        await sendApprovalNotification(
          instance.applicant.userID,
          `您的审批《${instance.title}》已被 ${approverNickname} 驳回${payload.comment ? '，原因：' + payload.comment : ''}`
        )
      } else if (payload.action === 'approved') {
        const nextNode = instance.nodes.find((n) => n.level === currentNode.level + 1)
        if (nextNode) {
          await sendApprovalNotification(
            nextNode.approver.userID,
            `您有一条新的审批待处理：《${instance.title}》，来自 ${instance.applicant.nickname}（第${nextNode.level}级审批）`
          )
        } else {
          instance.status = 'approved'
          await sendApprovalNotification(
            instance.applicant.userID,
            `您的审批《${instance.title}》已通过全部审批`
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
    clearStore() {
      this.instances = []
      this.syncStorage()
    },
  },
})

export default function useApprovalStore() {
  return useStore(store)
}
