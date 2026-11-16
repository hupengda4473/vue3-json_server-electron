import { createRouter, createWebHashHistory } from 'vue-router'
import ContactsView from '../views/ContactsView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'contacts',
      component: ContactsView,
      meta: { title: '联系人台账' },
    },
    {
      path: '/projects',
      name: 'projects',
      component: () => import('../views/ProjectsView.vue'),
      meta: { title: '项目记录' },
    },
    {
      path: '/overview',
      name: 'overview',
      component: () => import('../views/OverviewView.vue'),
      meta: { title: '数据概览' },
    },
    {
      path: '/schema',
      name: 'schema',
      component: () => import('../views/DataStructureView.vue'),
      meta: { title: '数据结构' },
    },
    {
      path: '/backups',
      name: 'backups',
      component: () => import('../views/BackupView.vue'),
      meta: { title: '备份中心' },
    },
    {
      path: '/api-examples',
      name: 'api-examples',
      component: () => import('../views/ApiExamplesView.vue'),
      meta: { title: '请求示例' },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

router.afterEach((to) => {
  document.title = `${to.meta.title || '本地数据台'} | 本地数据台`
})

export default router
