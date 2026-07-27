import { RouteRecordRaw } from 'vue-router'

const approvalRouters: Array<RouteRecordRaw> = [
  {
    path: '/approval',
    name: 'Approval',
    component: () => import('@pages/approval/index/index.vue'),
  },
  {
    path: '/approval/create',
    name: 'ApprovalCreate',
    component: () => import('@pages/approval/create/index.vue'),
  },
  {
    path: '/approval/detail',
    name: 'ApprovalDetail',
    component: () => import('@pages/approval/detail/index.vue'),
    props: ({ query }) => ({
      id: query.id as string,
    }),
  },
]

export default approvalRouters
