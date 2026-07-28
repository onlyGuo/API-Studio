<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { Box, Check, ChevronDown, Copy, Download, FileCode2, FileJson2, FolderKanban, Gauge, Globe2, Import, Info, Moon, Pencil, Plus, Search, Settings, SlidersHorizontal, Sun, Trash2, X } from 'lucide-vue-next'
import type { Project, Workspace } from './types'
import { createProject, deepClone, initialWorkspace, uid } from './lib'
import InterfacePanel from './components/InterfacePanel.vue'
import EnvironmentPanel from './components/EnvironmentPanel.vue'
import ScriptPanel from './components/ScriptPanel.vue'
import OverviewPanel from './components/OverviewPanel.vue'
import UiNumber from './components/ui/UiNumber.vue'
import UiRange from './components/ui/UiRange.vue'
import UiSwitch from './components/ui/UiSwitch.vue'

const workspace = ref<Workspace>(initialWorkspace())
const ready = ref(false)
const section = ref<'interfaces'|'environment'|'scripts'|'overview'>('interfaces')
const projectMenu = ref(false)
const createDialog = ref(false)
const settingsDialog = ref(false)
const newProjectName = ref('')
const toast = ref('')
const projectDialog = ref<'rename'|'delete'|null>(null)
const projectNameDraft = ref('')
const searchDialog = ref(false)
const searchText = ref('')
const searchIndex = ref(0)
const aboutDialog = ref(false)
const focusNodeId = ref('')
const focusEnvironmentId = ref('')
const focusScriptId = ref('')
const activeProject = computed(() => workspace.value.projects.find(p=>p.id===workspace.value.activeProjectId) || workspace.value.projects[0])
const activeEnvironment = computed(() => activeProject.value.environments.find(e=>e.id===activeProject.value.activeEnvironmentId) || activeProject.value.environments[0])
const preferences = computed(() => workspace.value.preferences || { editorFontSize: 12, defaultTimeout: 30000, compactMode: false })
const searchResults = computed(() => {
  const query=searchText.value.trim().toLowerCase();if(!query)return []
  const project=activeProject.value
  return [
    ...project.nodes.filter(n=>n.name.toLowerCase().includes(query)||n.request?.url.toLowerCase().includes(query)).map(n=>({id:n.id,type:'node' as const,title:n.name,meta:n.type==='folder'?'接口目录':`${n.request?.method} · ${n.request?.url||'未设置 URL'}`})),
    ...project.environments.filter(e=>e.name.toLowerCase().includes(query)||e.variables.some(v=>v.key.toLowerCase().includes(query))).map(e=>({id:e.id,type:'environment' as const,title:e.name,meta:'项目环境'})),
    ...project.scripts.filter(s=>s.name.toLowerCase().includes(query)||s.outputVariable.toLowerCase().includes(query)).map(s=>({id:s.id,type:'script' as const,title:s.name,meta:`自动化脚本 · ${s.outputVariable||'未设置输出变量'}`})),
  ].slice(0,30)
})
provide('appPreferences', preferences)

onMounted(async()=>{
  const saved=window.desktop ? await window.desktop.load() as Workspace|null : JSON.parse(localStorage.getItem('api-studio-workspace')||localStorage.getItem('apiforge-workspace')||'null')
  if(saved?.projects?.length)workspace.value={...saved,preferences:saved.preferences || {editorFontSize:12,defaultTimeout:30000,compactMode:false}}
  applyTheme();ready.value=true;document.addEventListener('keydown',globalKeydown)
})
onBeforeUnmount(()=>document.removeEventListener('keydown',globalKeydown))
let saveTimer:number|undefined
watch(workspace,()=>{if(!ready.value)return;clearTimeout(saveTimer);saveTimer=window.setTimeout(()=>{if(window.desktop)void window.desktop.save(workspace.value);else localStorage.setItem('api-studio-workspace',JSON.stringify(workspace.value))},350)},{deep:true})
function applyTheme(){document.documentElement.dataset.theme=workspace.value.theme;window.desktop?.setTheme(workspace.value.theme)}
function toggleTheme(){workspace.value.theme=workspace.value.theme==='dark'?'light':'dark';applyTheme()}
function updateProject(project:Project){workspace.value.projects=workspace.value.projects.map(p=>p.id===project.id?project:p)}
function uniqueName(name:string, excludeId=''){let next=name;let i=1;const names=new Set(workspace.value.projects.filter(p=>p.id!==excludeId).map(p=>p.name));while(names.has(next))next=`${name} (${i++})`;return next}
function create(){const name=newProjectName.value.trim()||'未命名项目';const p=createProject(uniqueName(name),preferences.value.defaultTimeout);workspace.value.projects.push(p);workspace.value.activeProjectId=p.id;newProjectName.value='';createDialog.value=false;section.value='interfaces';notify('项目已创建')}
function switchProject(id:string){workspace.value.activeProjectId=id;projectMenu.value=false;section.value='interfaces'}
function openProjectRename(){projectNameDraft.value=activeProject.value.name;projectDialog.value='rename';projectMenu.value=false}
function duplicateProject(){const source=deepClone(activeProject.value);const copy={...source,id:uid(),name:uniqueName(`${source.name} 副本`),createdAt:Date.now(),updatedAt:Date.now()};workspace.value.projects.push(copy);workspace.value.activeProjectId=copy.id;projectMenu.value=false;section.value='interfaces';notify('项目已复制')}
function removeProject(){if(workspace.value.projects.length===1){notify('至少保留一个项目');return}projectDialog.value='delete';projectMenu.value=false}
function confirmProjectDialog(){if(projectDialog.value==='rename'){const name=projectNameDraft.value.trim();if(!name)return;activeProject.value.name=uniqueName(name,activeProject.value.id);activeProject.value.updatedAt=Date.now();notify('项目已重命名')}else if(projectDialog.value==='delete'){const index=workspace.value.projects.findIndex(p=>p.id===activeProject.value.id);workspace.value.projects.splice(index,1);workspace.value.activeProjectId=workspace.value.projects[Math.max(0,index-1)].id;notify('项目已删除')}projectDialog.value=null}
async function exportProject(){let exported=true;if(window.desktop)exported=await window.desktop.exportProject(activeProject.value);else{const blob=new Blob([JSON.stringify(activeProject.value,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${activeProject.value.name}.api-studio.json`;a.click();URL.revokeObjectURL(a.href)}if(exported)notify('项目已导出');projectMenu.value=false}
async function importProject(){let list:any[]=[];if(window.desktop)list=await window.desktop.importProject();else{const input=document.createElement('input');input.type='file';input.accept='.json';input.multiple=true;input.click();await new Promise<void>(resolve=>{input.onchange=async()=>{for(const file of Array.from(input.files||[]))list.push(JSON.parse(await file.text()));resolve()}})}
  for(const raw of list){if(!raw?.name)continue;const p={...raw,id:uid(),name:uniqueName(String(raw.name)),createdAt:Date.now(),updatedAt:Date.now()};workspace.value.projects.push(p);workspace.value.activeProjectId=p.id}
  if(list.length){section.value='interfaces';notify(`已导入 ${list.length} 个项目`)}projectMenu.value=false
}
function notify(message:string){toast.value=message;setTimeout(()=>{if(toast.value===message)toast.value=''},1800)}
async function saveNow(){if(window.desktop)await window.desktop.save(workspace.value);else localStorage.setItem('api-studio-workspace',JSON.stringify(workspace.value));notify('接口已保存')}
function globalKeydown(event:KeyboardEvent){
  if(searchDialog.value&&['ArrowDown','ArrowUp','Enter'].includes(event.key)){event.preventDefault();if(event.key==='ArrowDown')searchIndex.value=Math.min(searchResults.value.length-1,searchIndex.value+1);else if(event.key==='ArrowUp')searchIndex.value=Math.max(0,searchIndex.value-1);else if(searchResults.value[searchIndex.value])activateSearchResult(searchResults.value[searchIndex.value]);return}
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();openSearch()}else if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='n'&&!searchDialog.value){event.preventDefault();createDialog.value=true}else if(event.key==='Escape'){searchDialog.value=false;projectMenu.value=false}
}
function openSearch(){searchText.value='';searchIndex.value=0;searchDialog.value=true}
function activateSearchResult(result:{id:string;type:'node'|'environment'|'script'}){if(result.type==='node'){section.value='interfaces';focusNodeId.value=result.id}else if(result.type==='environment'){section.value='environment';focusEnvironmentId.value=result.id}else{section.value='scripts';focusScriptId.value=result.id}searchDialog.value=false}
watch(searchText,()=>searchIndex.value=0)
</script>

<template>
  <div v-if="ready" class="app-shell" :class="{compact:preferences.compactMode}" @click="projectMenu=false">
    <header class="topbar">
      <div class="drag-region"></div>
      <div class="brand"><div class="brand-mark"><img src="/api-studio-icon.png" alt="" /></div><strong>API Studio</strong></div>
      <div class="project-switcher" @click.stop="projectMenu=!projectMenu">
        <FolderKanban :size="16"/><span><small>当前项目</small><b>{{ activeProject.name }}</b></span><ChevronDown :size="14"/>
        <div v-if="projectMenu" class="project-menu" @click.stop>
          <div class="menu-label">切换项目</div>
          <button v-for="project in workspace.projects" :key="project.id" @click="switchProject(project.id)"><span class="project-avatar">{{ project.name.slice(0,1).toUpperCase() }}</span><span><b>{{ project.name }}</b><small>{{ project.nodes.filter(n=>n.type==='request').length }} 个接口 · {{ project.environments.length }} 个环境</small></span><Check v-if="project.id===activeProject.id" :size="15"/></button>
          <div class="menu-separator"></div>
          <button @click="createDialog=true;projectMenu=false"><Plus :size="16"/>新建项目</button>
          <button @click="importProject"><Import :size="16"/>导入项目</button>
          <button @click="openProjectRename"><Pencil :size="16"/>重命名当前项目</button>
          <button @click="duplicateProject"><Copy :size="16"/>复制当前项目</button>
          <button @click="exportProject"><Download :size="16"/>导出当前项目</button>
          <button class="danger" @click="removeProject"><Trash2 :size="16"/>删除当前项目</button>
        </div>
      </div>
      <button class="global-search" @click="openSearch"><Search :size="15"/><span>搜索接口、变量或脚本</span><kbd>⌘ K</kbd></button>
      <div class="top-actions"><div class="env-pill"><span></span>{{ activeEnvironment.name }}</div><button class="icon-btn" title="切换主题" @click="toggleTheme"><Sun v-if="workspace.theme==='dark'" :size="17"/><Moon v-else :size="17"/></button><button class="icon-btn" title="应用设置" @click="settingsDialog=true"><Settings :size="17"/></button><button class="avatar" title="关于 API Studio" @click="aboutDialog=true">AS</button></div>
    </header>

    <div class="app-body">
      <nav class="rail">
        <button :class="{active:section==='interfaces'}" @click="section='interfaces'"><Box :size="20"/><span>接口</span></button>
        <button :class="{active:section==='environment'}" @click="section='environment'"><Globe2 :size="20"/><span>环境</span></button>
        <button :class="{active:section==='scripts'}" @click="section='scripts'"><FileCode2 :size="20"/><span>脚本</span></button>
        <span class="rail-fill"></span><button :class="{active:section==='overview'}" @click="section='overview'"><Gauge :size="20"/><span>概览</span></button>
      </nav>
      <InterfacePanel v-if="section==='interfaces'" :key="activeProject.id" :project="activeProject" :environment="activeEnvironment" :default-timeout="preferences.defaultTimeout" :focus-node-id="focusNodeId" @update:project="updateProject" @notify="notify" @save="saveNow"/>
      <EnvironmentPanel v-else-if="section==='environment'" :key="activeProject.id" :project="activeProject" :focus-id="focusEnvironmentId" @update:project="updateProject" @notify="notify"/>
      <ScriptPanel v-else-if="section==='scripts'" :key="activeProject.id" :project="activeProject" :default-timeout="preferences.defaultTimeout" :focus-id="focusScriptId" @update:project="updateProject" @notify="notify"/>
      <OverviewPanel v-else :project="activeProject" :environment="activeEnvironment" @navigate="section=$event"/>
    </div>

    <footer class="statusbar"><span><i></i>就绪</span><span class="status-spacer"></span><span>项目 UUID: {{ activeProject.id }}</span><span>UTF-8</span><span>Electron + Vue 3</span></footer>
    <transition name="toast"><div v-if="toast" class="toast"><Check :size="15"/>{{ toast }}</div></transition>

    <div v-if="createDialog" class="modal-backdrop" @click.self="createDialog=false">
      <form class="modal" @submit.prevent="create"><div class="modal-icon"><FolderKanban :size="23"/></div><h2>新建项目</h2><p>项目之间的数据、环境、脚本和接口完全独立。</p><label>项目名称<input v-model="newProjectName" autofocus placeholder="例如：订单服务" /></label><div class="modal-actions"><button type="button" class="soft-btn" @click="createDialog=false">取消</button><button class="primary-btn" type="submit">创建项目</button></div></form>
    </div>
    <div v-if="settingsDialog" class="modal-backdrop" @click.self="settingsDialog=false">
      <section class="modal settings-modal"><div class="modal-icon"><SlidersHorizontal :size="23"/></div><h2>应用设置</h2><p>设置会自动保存，并应用到所有项目。</p>
        <div class="settings-list">
          <div class="setting-row"><span><b>外观主题</b><small>切换整个工作区和 Monaco 编辑器主题</small></span><div class="theme-choice"><button :class="{active:workspace.theme==='light'}" @click="workspace.theme='light';applyTheme()"><Sun :size="14"/>明色</button><button :class="{active:workspace.theme==='dark'}" @click="workspace.theme='dark';applyTheme()"><Moon :size="14"/>暗色</button></div></div>
          <div class="setting-row"><span><b>编辑器字号</b><small>请求和响应 Monaco Editor 的字体大小</small></span><div class="range-value"><UiRange v-model="workspace.preferences.editorFontSize" :min="11" :max="17" :step="1"/><b>{{ workspace.preferences.editorFontSize }} px</b></div></div>
          <div class="setting-row"><span><b>默认请求超时</b><small>新建接口和脚本采用的默认值；0 表示不超时</small></span><UiNumber v-model="workspace.preferences.defaultTimeout" :min="0" :step="1000" suffix="ms"/></div>
          <div class="setting-row"><span><b>紧凑模式</b><small>缩小顶部栏和导航栏，获得更多编辑空间</small></span><UiSwitch v-model="workspace.preferences.compactMode"/></div>
        </div>
        <div class="modal-actions"><button class="primary-btn" @click="settingsDialog=false">完成</button></div>
      </section>
    </div>
    <div v-if="projectDialog" class="modal-backdrop" @click.self="projectDialog=null"><form class="modal" @submit.prevent="confirmProjectDialog"><h2>{{ projectDialog==='rename'?'重命名项目':'删除项目' }}</h2><p v-if="projectDialog==='delete'">将删除“{{ activeProject.name }}”及其全部接口、环境和脚本。此操作无法撤销。</p><label v-else>项目名称<input v-model="projectNameDraft" autofocus /></label><div class="modal-actions"><button type="button" class="soft-btn" @click="projectDialog=null">取消</button><button class="primary-btn" :class="{danger:projectDialog==='delete'}" type="submit">{{ projectDialog==='delete'?'删除':'确定' }}</button></div></form></div>
    <div v-if="searchDialog" class="modal-backdrop search-backdrop" @click.self="searchDialog=false"><section class="search-dialog"><header><Search :size="17"/><input v-model="searchText" autofocus placeholder="搜索当前项目…"/><button title="关闭" @click="searchDialog=false"><X :size="15"/></button></header><div class="search-results"><button v-for="(result,index) in searchResults" :key="`${result.type}:${result.id}`" :class="{active:index===searchIndex}" @pointerenter="searchIndex=index" @click="activateSearchResult(result)"><component :is="result.type==='node'?FileJson2:result.type==='environment'?Globe2:FileCode2" :size="16"/><span><b>{{ result.title }}</b><small>{{ result.meta }}</small></span></button><div v-if="searchText&&!searchResults.length" class="search-empty">没有找到匹配内容</div><div v-else-if="!searchText" class="search-empty">可搜索接口名称、URL、环境变量和脚本输出</div></div><footer><kbd>↑↓</kbd> 选择 <kbd>Enter</kbd> 打开 <kbd>Esc</kbd> 关闭</footer></section></div>
    <div v-if="aboutDialog" class="modal-backdrop" @click.self="aboutDialog=false"><section class="modal about-modal"><div class="modal-icon"><Info :size="23"/></div><h2>API Studio</h2><p>IDEA 风格的本地接口调试工作台</p><div class="about-grid"><span>版本</span><b>0.1.0</b><span>当前项目</span><b>{{ activeProject.name }}</b><span>数据存储</span><b>本机独立存储</b></div><div class="modal-actions"><button class="primary-btn" @click="aboutDialog=false">完成</button></div></section></div>
  </div>
</template>
