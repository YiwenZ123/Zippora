import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('../components/dashboard/DashboardView.vue')
    },
    {
      path: '/editor/:id',
      name: 'editor',
      component: () => import('../components/editor/EditorView.vue')
    }
  ]
})

export default router
