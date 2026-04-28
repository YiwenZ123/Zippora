<script setup lang="ts">
import { ref } from 'vue'
import { useProjectStore } from '../../stores/project'
import type { ProjectFilter } from '../../types/project'

const store = useProjectStore()
const showSettings = ref(false)
const profileName = ref(localStorage.getItem('zippora:profile-name') || 'Writer')
const profileEmail = ref(localStorage.getItem('zippora:profile-email') || 'xmrzsdioky76@hotmail.com')

const navItems: { key: ProjectFilter; label: string }[] = [
  { key: 'all', label: '所有项目' },
  { key: 'yours', label: '你的项目' },
  { key: 'shared', label: '与你共享' }
]

function saveProfile() {
  localStorage.setItem('zippora:profile-name', profileName.value.trim() || 'Writer')
  localStorage.setItem('zippora:profile-email', profileEmail.value.trim() || 'user@example.com')
  profileName.value = localStorage.getItem('zippora:profile-name') || 'Writer'
  profileEmail.value = localStorage.getItem('zippora:profile-email') || 'user@example.com'
  showSettings.value = false
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-top">
      <button class="plain-icon" title="设置" @click.stop="showSettings = !showSettings">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06A2 2 0 1 1 7.03 3.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.24.36.6.62 1 .72.17.04.35.06.53.05H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
        </svg>
      </button>
      <button class="plain-icon right" title="折叠侧边栏">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M9 4v16" />
        </svg>
      </button>

      <form v-if="showSettings" class="sidebar-settings" @submit.prevent="saveProfile" @click.stop>
        <strong>工作区设置</strong>
        <label for="dashboard-profile-name">作者名称</label>
        <input id="dashboard-profile-name" v-model="profileName" autocomplete="off" />
        <label for="dashboard-profile-email">邮箱</label>
        <input id="dashboard-profile-email" v-model="profileEmail" type="email" autocomplete="off" />
        <button type="submit">保存</button>
      </form>
    </div>

    <nav class="sidebar-nav">
      <button
        v-for="item in navItems"
        :key="item.key"
        :class="['nav-item', { active: store.activeFilter === item.key }]"
        @click="store.activeFilter = item.key"
      >
        {{ item.label }}
      </button>
    </nav>

    <div class="account-strip">
      <button class="avatar-btn" type="button">X</button>
      <span class="account-email">{{ profileEmail }}</span>
      <svg class="account-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 0 0 clamp(320px, 20vw, 416px);
  width: clamp(320px, 20vw, 416px);
  height: 100vh;
  overflow: hidden;
  background: #181819;
  border-right: 1px solid rgba(255, 255, 255, 0.035);
  color: #d6d6d6;
}

.sidebar-top {
  display: flex;
  align-items: center;
  height: 62px;
  padding: 0 22px;
}

.plain-icon {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #999;
  border-radius: 7px;
}

.plain-icon.right {
  margin-left: auto;
}

.plain-icon:hover {
  color: #f1f1f1;
  background: rgba(255, 255, 255, 0.06);
}

.sidebar-settings {
  position: absolute;
  z-index: 20;
  top: 48px;
  left: 18px;
  width: 240px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: 10px;
  background: #2a2a2b;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.42);
}

.sidebar-settings strong {
  color: #f1f1f1;
  font-size: 13px;
}

.sidebar-settings label {
  color: #9b9b9b;
  font-size: 11px;
}

.sidebar-settings input {
  width: 100%;
  height: 30px;
  padding: 0 8px;
  border-radius: 6px;
  background: #151515;
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #ededed;
  font-size: 12px;
}

.sidebar-settings button {
  height: 30px;
  margin-top: 2px;
  border-radius: 6px;
  background: #f3f3f3;
  color: #151515;
  font-size: 12px;
  font-weight: 700;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 18px 20px 0;
}

.nav-item {
  width: 100%;
  height: 38px;
  display: flex;
  align-items: center;
  padding: 0 14px;
  border-radius: 7px;
  color: #858585;
  font-size: 14px;
  text-align: left;
}

.nav-item:hover {
  color: #ededed;
  background: rgba(255, 255, 255, 0.045);
}

.nav-item.active {
  color: #efefef;
  background: #2c2c2d;
}

.account-strip {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: grid;
  grid-template-columns: 26px 1fr 14px;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.035);
  color: #d8d8d8;
}

.avatar-btn {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #3a3a3b;
  color: #f1f1f1;
  font-size: 11px;
  font-weight: 700;
}

.account-email {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 650;
}

.account-chevron {
  color: #808080;
}

@media (max-width: 760px) {
  .sidebar {
    width: 100%;
    height: auto;
    flex: 0 0 auto;
    border-right: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.045);
  }

  .sidebar-top {
    height: 46px;
  }

  .sidebar-nav {
    flex-direction: row;
    gap: 6px;
    padding: 0 14px 12px;
    overflow-x: auto;
  }

  .nav-item {
    width: auto;
    min-width: max-content;
    height: 32px;
    padding: 0 12px;
  }

  .account-strip {
    display: none;
  }
}
</style>
