import './styles/index.css'
import { isSupabaseConfigured, supabase } from './supabase.js'

const todoForm = document.querySelector('.todo-form')

function isTaskTitleField(el) {
  return el instanceof HTMLInputElement && (el.id === 'todo-input' || el.name === 'task_title')
}

function getTaskTitleInput(form) {
  const byId = document.getElementById('todo-input')
  if (byId instanceof HTMLInputElement) return byId
  if (!form) return null
  const el = form.elements.namedItem('task_title')
  if (el instanceof HTMLInputElement) return el
  const scoped = form.querySelector('#todo-input')
  return scoped instanceof HTMLInputElement ? scoped : null
}

const todoAddButton = document.querySelector('.todo-add-button')
const todoList = document.querySelector('.todo-list')
const statusEl = document.querySelector('.todo-status')
const loadingEl = document.querySelector('.todo-loading')
const retryButton = document.querySelector('.todo-retry-button')
const categorySelect = document.querySelector('.todo-category-select')
const dueDateInput = document.querySelector('.todo-due-date')
const prioritySelect = document.querySelector('.todo-priority-select')
const sortSelect = document.querySelector('.todo-sort-select')
const filterButtons = document.querySelectorAll('.todo-filter-btn')
const authSignedIn = document.querySelector('.todo-auth-signed-in')
const authGuest = document.querySelector('.todo-auth-guest')
const authEmailEl = document.querySelector('.todo-auth-email')
const authSignOutBtn = document.querySelector('.todo-auth-sign-out')
const authTabs = document.querySelectorAll('.todo-auth-tab')
const authSignupForm = document.querySelector('.todo-auth-signup-form')
const authSigninForm = document.querySelector('.todo-auth-signin-form')
const authSignupEmail = document.querySelector('#todo-auth-signup-email')
const authSignupPassword = document.querySelector('#todo-auth-signup-password')
const authSigninEmail = document.querySelector('#todo-auth-signin-email')
const authSigninPassword = document.querySelector('#todo-auth-signin-password')

const authDialog = document.querySelector('#todo-auth-dialog')
const authOpenBtns = document.querySelectorAll('[data-open-auth]')
const authDialogClose = document.querySelector('.todo-auth-dialog-close')

let todos = []
let currentUserId = null
let loadFailed = false
let isLoadingList = false
let addTodoInFlight = false
let taskTitleDraft = ''
let editingTodoId = null
let filterCategory = 'all'
let sortBy = 'due'
let lastAddedTodoId = null
let touchLongPressTimer = null
let touchLongPressStamp = null

const TODO_SELECT_FULL = 'id, text, is_complete, created_at, category, due_date, priority'
const TODO_SELECT_BASE = 'id, text, is_complete, created_at'

function isMissingColumnError(error) {
  const msg = error?.message ?? ''
  return /\bcolumn\b[\s\S]*\bdoes not exist\b/i.test(msg)
}

function setStatus(message, variant = 'error') {
  if (!statusEl) return
  if (!message) {
    statusEl.classList.add('todo-status--hidden')
    statusEl.classList.remove('todo-status--notice')
    statusEl.textContent = ''
    return
  }
  statusEl.classList.remove('todo-status--hidden')
  statusEl.classList.toggle('todo-status--notice', variant === 'notice')
  statusEl.textContent = message
}

function refreshUiLock() {
  const busy = !isSupabaseConfigured || isLoadingList || loadFailed || addTodoInFlight
  if (todoForm) {
    todoForm.querySelectorAll('input, button, select').forEach((el) => {
      el.disabled = busy
    })
  }
}

function setLoading(loading) {
  isLoadingList = loading
  if (loadingEl) {
    loadingEl.classList.toggle('todo-loading--hidden', !loading)
  }
  refreshUiLock()
}

function setLoadError(message) {
  loadFailed = Boolean(message)
  if (retryButton) {
    retryButton.classList.toggle('todo-retry-button--hidden', !loadFailed)
  }
  if (message) {
    setStatus(
      `Could not load tasks. ${message} Check your connection or Supabase setup.${deploySetupHint()}`,
    )
  }
  refreshUiLock()
}

function deploySetupHint() {
  const origin = typeof location !== 'undefined' ? location.origin : ''
  return ` Add ${origin} to Supabase → Authentication → URL Configuration (redirect URLs). In Netlify → Site configuration → Environment variables, set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (then redeploy). Enable Anonymous under Authentication → Providers.`
}

function isEmailAccountUser(user) {
  if (!user?.email) return false
  if (user.is_anonymous) return false
  return true
}

function updateAuthUi(user) {
  const emailUser = isEmailAccountUser(user)
  if (authSignedIn) {
    authSignedIn.classList.toggle('todo-auth-signed-in--hidden', !emailUser)
    if (authEmailEl) authEmailEl.textContent = emailUser && user.email ? user.email : ''
  }
  if (authGuest) {
    authGuest.classList.toggle('todo-auth-guest--hidden', emailUser)
  }
}

function setActiveAuthPanel(panel) {
  authTabs.forEach((tab) => {
    const isActive = tab.dataset.panel === panel
    tab.classList.toggle('todo-auth-tab--active', isActive)
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false')
  })
  if (authSignupForm) authSignupForm.classList.toggle('todo-auth-form--hidden', panel !== 'signup')
  if (authSigninForm) authSigninForm.classList.toggle('todo-auth-form--hidden', panel !== 'signin')
}

function openAuthDialog(panel) {
  if (!authDialog || (panel !== 'signin' && panel !== 'signup')) return
  setActiveAuthPanel(panel)
  authDialog.showModal()
  const input = panel === 'signup' ? authSignupEmail : authSigninEmail
  queueMicrotask(() => input?.focus())
}

async function completeAuthCodeFromUrl() {
  if (!supabase || typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  if (!code) return
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error('Auth code exchange failed:', error.message)
    setStatus(`Could not complete sign-in. ${error.message}.${deploySetupHint()}`)
    return
  }
  const url = new URL(window.location.href)
  url.searchParams.delete('code')
  const next = `${url.pathname}${url.search}${url.hash}`
  window.history.replaceState({}, '', next)
}

async function ensureSession() {
  if (!supabase) return null

  try {
    await completeAuthCodeFromUrl()

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (session?.user) return session.user

    const { data, error } = await supabase.auth.signInAnonymously()

    if (error) {
      console.error('Failed to sign in anonymously:', error.message)
      setStatus(`Could not sign in anonymously. ${error.message}.${deploySetupHint()}`)
      return null
    }

    return data.session?.user ?? data.user ?? null
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('ensureSession failed:', err)
    setStatus(`Authentication error: ${msg}.${deploySetupHint()}`)
    return null
  }
}

function normalizeCategory(cat) {
  if (cat == null || cat === '' || cat === 'general') return 'work'
  if (cat === 'errands') return 'groceries'
  return cat
}

function rowToTodo(row) {
  return {
    id: String(row.id),
    text: row.text,
    completed: row.is_complete,
    createdAt: row.created_at,
    category: normalizeCategory(row.category),
    dueDate: row.due_date ?? null,
    priority: row.priority ?? 'medium',
  }
}

function compareTodosByCreated(a, b) {
  const ta = new Date(a.createdAt || 0).getTime()
  const tb = new Date(b.createdAt || 0).getTime()
  if (ta !== tb) return ta - tb
  return Number(a.id) - Number(b.id)
}

function priorityRank(p) {
  if (p === 'high') return 0
  if (p === 'low') return 2
  return 1
}

function compareTodosByPriority(a, b) {
  const ra = priorityRank(a.priority)
  const rb = priorityRank(b.priority)
  if (ra !== rb) return ra - rb
  return compareTodosByCreated(a, b)
}

function compareTodosByDue(a, b) {
  const da = a.dueDate && String(a.dueDate).trim() ? a.dueDate : null
  const db = b.dueDate && String(b.dueDate).trim() ? b.dueDate : null
  if (!da && !db) return compareTodosByCreated(a, b)
  if (!da) return 1
  if (!db) return -1
  if (da !== db) return da < db ? -1 : 1
  return compareTodosByCreated(a, b)
}

function getVisibleTodos() {
  let list = [...todos]
  if (filterCategory !== 'all') {
    list = list.filter((t) => normalizeCategory(t.category) === filterCategory)
  }
  if (sortBy === 'due') list.sort(compareTodosByDue)
  else if (sortBy === 'priority') list.sort(compareTodosByPriority)
  else list.sort(compareTodosByCreated)
  return list
}

function updateFilterButtonsUi() {
  filterButtons.forEach((btn) => {
    const v = btn.dataset.filter
    btn.classList.toggle('todo-filter-btn--active', v === filterCategory)
  })
}

const CATEGORY_LABELS = {
  work: 'Work',
  personal: 'Personal',
  groceries: 'Groceries',
}

const CATEGORY_POSTMARK = {
  work: 'WORK',
  personal: 'PERSONAL',
  groceries: 'GROCERIES',
}

function stampRotationDeg(id) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  const n = (h % 5) - 2
  return n * 0.45
}

function formatDueDate(isoDate) {
  if (!isoDate) return ''
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return isoDate
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Denomination style e.g. 10-MAY */
function formatDenomDate(isoDate) {
  if (!isoDate) return '—'
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return isoDate
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  return `${d}-${months[m - 1] ?? '—'}`
}

function todayIsoDate() {
  const t = new Date()
  const y = t.getFullYear()
  const m = String(t.getMonth() + 1).padStart(2, '0')
  const d = String(t.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

if (dueDateInput && !dueDateInput.value) {
  dueDateInput.value = todayIsoDate()
}

if (sortSelect) sortSelect.value = sortBy

function populateCategoryEditSelect(select, current) {
  const cur = normalizeCategory(current)
  const order = ['work', 'personal', 'groceries']
  for (const value of order) {
    const opt = document.createElement('option')
    opt.value = value
    opt.textContent = CATEGORY_LABELS[value]
    if (value === cur) opt.selected = true
    select.append(opt)
  }
  if (!order.includes(cur)) {
    const opt = document.createElement('option')
    opt.value = cur
    opt.textContent = CATEGORY_LABELS[cur] ?? cur
    opt.selected = true
    select.append(opt)
  }
}

function populatePriorityEditSelect(select, current) {
  const cur = current === 'high' || current === 'low' ? current : 'medium'
  const levels = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
  ]
  for (const { value, label } of levels) {
    const opt = document.createElement('option')
    opt.value = value
    opt.textContent = label
    if (value === cur) opt.selected = true
    select.append(opt)
  }
}

const SVG_ICON_PENCIL = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`

const SVG_ICON_TRASH = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>`

const SVG_POSTMARK_RING = `<svg viewBox="0 0 64 44" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="20" cy="22" r="18" stroke="currentColor" stroke-width="1.8" opacity="0.88"/><circle cx="20" cy="22" r="15" stroke="currentColor" stroke-width="0.8" stroke-dasharray="3 2" opacity="0.76"/><path d="M34 11c8 .5 16 1.8 24 4M35 18c7.5.2 15.2 1.2 22.8 3.4M34 25c7.7.1 15.2 1 22.5 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.65"/></svg>`

function appendSvgIcon(button, svgMarkup) {
  const t = document.createElement('template')
  t.innerHTML = svgMarkup.trim()
  const svg = t.content.firstElementChild
  if (svg) {
    svg.setAttribute('aria-hidden', 'true')
    button.append(svg)
  }
}

function clearTouchLongPress() {
  if (touchLongPressTimer != null) {
    clearTimeout(touchLongPressTimer)
    touchLongPressTimer = null
  }
  touchLongPressStamp = null
}

function bindStampInteractions(li) {
  const onPointerDown = (e) => {
    if (e.pointerType !== 'touch') return
    if (li.classList.contains('todo-stamp--editing')) return
    if (e.target.closest('.todo-stamp-actions')) return
    clearTouchLongPress()
    touchLongPressStamp = li
    touchLongPressTimer = window.setTimeout(() => {
      touchLongPressTimer = null
      touchLongPressStamp = null
      li.classList.add('todo-stamp--menu-open')
    }, 550)
  }
  const onPointerEnd = () => {
    clearTouchLongPress()
  }
  li.addEventListener('pointerdown', onPointerDown)
  li.addEventListener('pointerup', onPointerEnd)
  li.addEventListener('pointercancel', onPointerEnd)
}

async function toggleTodoComplete(idStr, nextCompleted) {
  if (!supabase) return
  if (!(await ensureSession())) return

  const id = Number(idStr)
  const { error } = await supabase.from('todos').update({ is_complete: nextCompleted }).eq('id', id)

  if (error) {
    console.error('Failed to update todo:', error.message)
    setStatus(`Could not update task: ${error.message}`)
    return
  }

  setStatus('')
  todos = todos.map((todo) => (todo.id === idStr ? { ...todo, completed: nextCompleted } : todo))
  renderTodos()
}

function createSkeletonStamps(count) {
  const frag = document.createDocumentFragment()
  for (let i = 0; i < count; i++) {
    const li = document.createElement('li')
    li.className = 'todo-stamp todo-stamp--skeleton'
    const box = document.createElement('div')
    box.className = 'todo-stamp-skel'
    li.append(box)
    frag.append(li)
  }
  return frag
}

function createEmptyState() {
  const li = document.createElement('li')
  li.className = 'todo-stamp-empty'
  const p = document.createElement('p')
  if (todos.length === 0) {
    p.textContent =
      'No stamps in the album yet. Press a new task into the collection with the stamp press above.'
  } else {
    p.textContent = 'No stamps match this filter. Try another category or choose “All stamps.”'
  }
  li.append(p)
  return li
}

function createTodoItem(todo, visibleIndex) {
  const isEditing = editingTodoId === todo.id
  const item = document.createElement('li')
  item.className = 'todo-stamp'
  item.dataset.id = todo.id
  item.style.setProperty('--stamp-rot', `${stampRotationDeg(todo.id)}deg`)

  if (isEditing) item.classList.add('todo-stamp--editing')
  if (todo.completed) item.classList.add('todo-stamp--completed')
  if (todo.id === lastAddedTodoId) item.classList.add('todo-stamp--enter')

  const pri = todo.priority === 'high' || todo.priority === 'low' ? todo.priority : 'medium'
  if (todo.dueDate && !todo.completed && todo.dueDate < todayIsoDate()) {
    item.classList.add('todo-stamp--overdue')
  }

  if (isEditing) {
    const wrap = document.createElement('div')
    wrap.className = 'todo-stamp-edit'

    const editWrap = document.createElement('div')
    editWrap.className = 'todo-item-edit'

    const taskField = document.createElement('div')
    taskField.className = 'todo-field todo-item-edit-task-field'
    const taskLabel = document.createElement('label')
    taskLabel.className = 'todo-label'
    taskLabel.htmlFor = `todo-edit-text-${todo.id}`
    taskLabel.textContent = 'Task'
    const taskInput = document.createElement('input')
    taskInput.type = 'text'
    taskInput.className = 'todo-edit-control todo-edit-text'
    taskInput.id = `todo-edit-text-${todo.id}`
    taskInput.maxLength = 500
    taskInput.autocomplete = 'off'
    taskInput.value = todo.text
    taskField.append(taskLabel, taskInput)

    const editRow = document.createElement('div')
    editRow.className = 'todo-item-edit-row'

    const catField = document.createElement('div')
    catField.className = 'todo-field'
    const catLabel = document.createElement('label')
    catLabel.className = 'todo-label'
    catLabel.htmlFor = `todo-edit-cat-${todo.id}`
    catLabel.textContent = 'Category'
    const catSelect = document.createElement('select')
    catSelect.className = 'todo-edit-control todo-edit-category'
    catSelect.id = `todo-edit-cat-${todo.id}`
    populateCategoryEditSelect(catSelect, todo.category)
    catField.append(catLabel, catSelect)

    const priField = document.createElement('div')
    priField.className = 'todo-field'
    const priLabel = document.createElement('label')
    priLabel.className = 'todo-label'
    priLabel.htmlFor = `todo-edit-pri-${todo.id}`
    priLabel.textContent = 'Priority'
    const priSelect = document.createElement('select')
    priSelect.className = 'todo-edit-control todo-edit-priority'
    priSelect.id = `todo-edit-pri-${todo.id}`
    populatePriorityEditSelect(priSelect, todo.priority)
    priField.append(priLabel, priSelect)

    const dueField = document.createElement('div')
    dueField.className = 'todo-field'
    const dueLabel = document.createElement('label')
    dueLabel.className = 'todo-label'
    dueLabel.htmlFor = `todo-edit-due-${todo.id}`
    dueLabel.textContent = 'Due date'
    const dueInput = document.createElement('input')
    dueInput.className = 'todo-edit-control todo-edit-due'
    dueInput.id = `todo-edit-due-${todo.id}`
    dueInput.type = 'date'
    dueInput.required = true
    dueInput.value = todo.dueDate ?? ''
    dueField.append(dueLabel, dueInput)

    editRow.append(catField, priField, dueField)

    const editActions = document.createElement('div')
    editActions.className = 'todo-item-edit-actions'
    const saveBtn = document.createElement('button')
    saveBtn.type = 'button'
    saveBtn.className = 'todo-edit-save'
    saveBtn.dataset.id = todo.id
    saveBtn.textContent = 'Save'
    const cancelBtn = document.createElement('button')
    cancelBtn.type = 'button'
    cancelBtn.className = 'todo-edit-cancel'
    cancelBtn.textContent = 'Cancel'
    editActions.append(saveBtn, cancelBtn)

    editWrap.append(taskField, editRow, editActions)
    wrap.append(editWrap)
    item.append(wrap)
    return item
  }

  const catKey = normalizeCategory(todo.category)
  item.classList.add(`todo-stamp--category-${catKey}`)

  const face = document.createElement('button')
  face.type = 'button'
  face.className = 'todo-stamp-face'
  face.dataset.id = todo.id
  face.setAttribute('aria-pressed', todo.completed ? 'true' : 'false')
  const toggleLabel = todo.completed
    ? `Mark stamp "${todo.text}" as not done`
    : `Mark stamp "${todo.text}" as done`
  face.setAttribute('aria-label', toggleLabel)

  const serrated = document.createElement('div')
  serrated.className = `todo-stamp-serrated todo-stamp-serrated--${pri} todo-stamp-serrated--${catKey}`

  const paper = document.createElement('div')
  paper.className = 'todo-stamp-paper'

  const priSr = document.createElement('span')
  priSr.className = 'todo-sr-only'
  priSr.textContent =
    todo.priority === 'high'
      ? 'High priority'
      : todo.priority === 'low'
        ? 'Low priority'
        : 'Medium priority'

  const postmark = document.createElement('div')
  postmark.className = `todo-stamp-postmark todo-stamp-postmark--${catKey}`
  postmark.innerHTML = SVG_POSTMARK_RING
  const pmText = document.createElement('span')
  pmText.textContent = CATEGORY_POSTMARK[catKey] ?? catKey
  postmark.append(pmText)

  const serial = document.createElement('span')
  serial.className = 'todo-stamp-serial'
  serial.textContent = `No.\n${String(visibleIndex + 1).padStart(3, '0')}`

  const title = document.createElement('p')
  title.className = 'todo-stamp-title'
  title.textContent = todo.text

  const denom = document.createElement('time')
  denom.className = 'todo-stamp-denom'
  if (todo.dueDate) denom.dateTime = todo.dueDate
  denom.textContent = todo.dueDate ? formatDenomDate(todo.dueDate) : '—'

  paper.append(priSr, postmark, serial, title, denom)

  if (todo.completed) {
    const done = document.createElement('div')
    done.className = 'todo-stamp-done'
    const doneText = document.createElement('span')
    doneText.textContent = 'Done'
    done.append(doneText)
    paper.append(done)
  }

  serrated.append(paper)
  face.append(serrated)

  const actions = document.createElement('div')
  actions.className = 'todo-stamp-actions'

  const inner = document.createElement('div')
  inner.className = 'todo-stamp-actions-inner'

  const menuBtn = document.createElement('button')
  menuBtn.type = 'button'
  menuBtn.className = 'todo-stamp-menu'
  menuBtn.setAttribute('aria-label', 'More options')
  menuBtn.setAttribute('aria-expanded', 'false')
  menuBtn.textContent = '⋯'

  const editButton = document.createElement('button')
  editButton.className = 'todo-edit-button todo-icon-button'
  editButton.type = 'button'
  editButton.dataset.id = todo.id
  editButton.setAttribute(
    'aria-label',
    `Edit task, category, priority, and due date for "${todo.text}"`,
  )
  appendSvgIcon(editButton, SVG_ICON_PENCIL)

  const deleteButton = document.createElement('button')
  deleteButton.className = 'todo-delete-button todo-icon-button'
  deleteButton.type = 'button'
  deleteButton.dataset.id = todo.id
  deleteButton.setAttribute('aria-label', `Delete "${todo.text}"`)
  appendSvgIcon(deleteButton, SVG_ICON_TRASH)

  inner.append(menuBtn, editButton, deleteButton)
  actions.append(inner)

  item.append(face, actions)

  bindStampInteractions(item)

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    e.preventDefault()
    const open = item.classList.toggle('todo-stamp--menu-open')
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false')
  })

  return item
}

function renderTodos() {
  if (!todoList) return

  if (isLoadingList && todos.length === 0 && !loadFailed) {
    todoList.classList.add('todo-list--skeleton')
    todoList.replaceChildren(createSkeletonStamps(6))
    return
  }

  todoList.classList.remove('todo-list--skeleton')

  const visible = getVisibleTodos()
  updateFilterButtonsUi()

  if (visible.length === 0 && !isLoadingList) {
    todoList.replaceChildren(createEmptyState())
    return
  }

  todoList.replaceChildren(...visible.map((t, i) => createTodoItem(t, i)))

  if (lastAddedTodoId) {
    const id = lastAddedTodoId
    window.setTimeout(() => {
      if (lastAddedTodoId === id) lastAddedTodoId = null
    }, 700)
  }
}

async function loadTodos(userId) {
  currentUserId = userId
  loadFailed = false
  if (retryButton) retryButton.classList.add('todo-retry-button--hidden')
  setStatus('')
  setLoading(true)
  renderTodos()

  if (!supabase) {
    setLoading(false)
    todos = []
    renderTodos()
    setLoadError('Supabase is not configured for this deployment.')
    return
  }

  let data = null
  let error = null

  try {
    const full = await supabase
      .from('todos')
      .select(TODO_SELECT_FULL)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    data = full.data
    error = full.error

    if (error && isMissingColumnError(error)) {
      const fallback = await supabase
        .from('todos')
        .select(TODO_SELECT_BASE)
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
      data = fallback.data
      error = fallback.error
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('loadTodos failed:', err)
    error = { message: msg }
  } finally {
    setLoading(false)
  }

  if (error) {
    console.error('Failed to load todos:', error.message)
    todos = []
    renderTodos()
    setLoadError(error.message ?? 'Request failed')
    return
  }

  todos = (data ?? []).map(rowToTodo)
  renderTodos()
}

function readTaskTitleFromForm(form) {
  const input = getTaskTitleInput(form)
  let text = input ? String(input.value).trim() : ''
  if (!text) {
    text = String(form ? new FormData(form).get('task_title') ?? '' : '').trim()
  }
  if (!text) {
    text = String(taskTitleDraft).trim()
  }
  return text
}

function readTodoOptionsFromForm(form) {
  const fd = new FormData(form)
  const category = String(fd.get('category') ?? categorySelect?.value ?? 'work')
  const dueVal = fd.get('due_date')
  const due_date =
    dueVal && String(dueVal).trim()
      ? String(dueVal)
      : (dueDateInput?.value && String(dueDateInput.value).trim()) || null
  const priority = String(fd.get('priority') ?? prioritySelect?.value ?? 'medium')
  return { category, due_date, priority }
}

async function addTodoFromForm(form) {
  if (!form || addTodoInFlight) return

  addTodoInFlight = true

  if (!supabase) {
    addTodoInFlight = false
    refreshUiLock()
    setStatus(`Missing Supabase environment variables.${deploySetupHint()}`)
    return
  }

  const text = readTaskTitleFromForm(form)
  if (!text) {
    addTodoInFlight = false
    refreshUiLock()
    setStatus('Enter a task before adding.', 'notice')
    return
  }

  refreshUiLock()

  try {
    const user = await ensureSession()
    if (!user) {
      setStatus(`Could not sign in anonymously.${deploySetupHint()}`)
      return
    }

    setStatus('')

    const { category, due_date, priority } = readTodoOptionsFromForm(form)
    if (!due_date) {
      setStatus('Due date is required.')
      dueDateInput?.reportValidity()
      return
    }

    let { data, error } = await supabase
      .from('todos')
      .insert({
        text,
        user_id: user.id,
        category,
        due_date,
        priority,
      })
      .select(TODO_SELECT_FULL)
      .single()

    if (error && isMissingColumnError(error)) {
      const minimal = await supabase
        .from('todos')
        .insert({ text, user_id: user.id })
        .select(TODO_SELECT_BASE)
        .single()
      data = minimal.data
      error = minimal.error
    }

    if (error) {
      console.error('Failed to add todo:', error.message)
      setStatus(`${error.message}.${deploySetupHint()}`)
      return
    }

    const added = rowToTodo(data)
    todos = [...todos, added]
    lastAddedTodoId = added.id
    const titleInput = getTaskTitleInput(form)
    if (titleInput) {
      titleInput.value = ''
      taskTitleDraft = ''
    }
    if (dueDateInput) dueDateInput.value = todayIsoDate()
    titleInput?.focus()
    renderTodos()
  } finally {
    addTodoInFlight = false
    refreshUiLock()
  }
}

if (isSupabaseConfigured) {
  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.filter
      if (!v) return
      filterCategory = v
      renderTodos()
    })
  })

  sortSelect?.addEventListener('change', () => {
    sortBy = sortSelect.value === 'priority' || sortSelect.value === 'created' ? sortSelect.value : 'due'
    renderTodos()
  })

  document.addEventListener('click', (e) => {
    const t = e.target
    if (!(t instanceof Element)) return
    if (t.closest('.todo-stamp-actions')) return
    document.querySelectorAll('.todo-stamp--menu-open').forEach((el) => {
      el.classList.remove('todo-stamp--menu-open')
      el.querySelector('.todo-stamp-menu')?.setAttribute('aria-expanded', 'false')
    })
  })

  if (todoForm) {
    todoForm.addEventListener('input', (event) => {
      const t = event.target
      if (isTaskTitleField(t)) {
        taskTitleDraft = t.value
        setStatus('')
      }
    })

    todoForm.addEventListener('change', (event) => {
      const t = event.target
      if (isTaskTitleField(t)) {
        taskTitleDraft = t.value
      }
    })

    todoForm.addEventListener('keydown', (event) => {
      const t = event.target
      if (!isTaskTitleField(t)) return
      if (event.key !== 'Enter' || event.isComposing) return
      event.preventDefault()
      void addTodoFromForm(todoForm)
    })

    todoForm.addEventListener('submit', (event) => {
      event.preventDefault()
    })

    todoAddButton?.addEventListener('click', () => {
      void addTodoFromForm(todoForm)
    })
  }

  if (todoList) {
    todoList.addEventListener('click', async (event) => {
      const face = event.target.closest('.todo-stamp-face')
      if (face && !event.target.closest('.todo-stamp-actions')) {
        event.preventDefault()
        const id = face.dataset.id
        if (!id) return
        const todo = todos.find((t) => t.id === id)
        if (!todo || editingTodoId === id) return
        void toggleTodoComplete(id, !todo.completed)
        return
      }

      const cancelBtn = event.target.closest('.todo-edit-cancel')
      if (cancelBtn) {
        editingTodoId = null
        setStatus('')
        renderTodos()
        return
      }

      const saveBtn = event.target.closest('.todo-edit-save')
      if (saveBtn) {
        const item = saveBtn.closest('.todo-stamp')
        const textInput = item?.querySelector('.todo-edit-text')
        const dueInput = item?.querySelector('.todo-edit-due')
        const categoryEl = item?.querySelector('.todo-edit-category')
        const priorityEl = item?.querySelector('.todo-edit-priority')
        const id = saveBtn.dataset.id
        const text = textInput ? String(textInput.value).trim() : ''
        if (!text) {
          setStatus('Enter a task before saving.', 'notice')
          textInput?.focus()
          return
        }
        const due = dueInput && String(dueInput.value).trim() ? String(dueInput.value) : ''
        if (!due) {
          setStatus('Due date is required.')
          dueInput?.reportValidity()
          return
        }
        const category = String(categoryEl?.value ?? 'work')
        const priority = String(priorityEl?.value ?? 'medium')

        if (!(await ensureSession())) return

        setStatus('')
        const { error } = await supabase
          .from('todos')
          .update({ text, category, due_date: due, priority })
          .eq('id', Number(id))

        if (error) {
          console.error('Failed to update todo:', error.message)
          setStatus(`Could not save changes: ${error.message}`)
          return
        }

        todos = todos.map((t) =>
          t.id === String(id)
            ? { ...t, text, category: normalizeCategory(category), dueDate: due, priority }
            : t,
        )
        editingTodoId = null
        renderTodos()
        return
      }

      const editButton = event.target.closest('.todo-edit-button')
      if (editButton) {
        editingTodoId = String(editButton.dataset.id)
        setStatus('')
        renderTodos()
        return
      }

      const deleteButton = event.target.closest('.todo-delete-button')
      if (!deleteButton) return

      if (!(await ensureSession())) return

      const id = Number(deleteButton.dataset.id)

      const { error } = await supabase.from('todos').delete().eq('id', id)

      if (error) {
        console.error('Failed to delete todo:', error.message)
        setStatus(`Could not delete task: ${error.message}`)
        return
      }

      setStatus('')
      if (editingTodoId === String(id)) editingTodoId = null
      todos = todos.filter((todo) => todo.id !== String(id))
      renderTodos()
    })
  }

  if (retryButton) {
    retryButton.addEventListener('click', () => {
      if (currentUserId) loadTodos(currentUserId)
    })
  }

  authTabs.forEach((tab) => {
    tab.addEventListener('click', () => setActiveAuthPanel(tab.dataset.panel))
  })

  authOpenBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const panel = btn.dataset.openAuth
      if (panel === 'signin' || panel === 'signup') openAuthDialog(panel)
    })
  })

  authDialogClose?.addEventListener('click', () => authDialog?.close())

  if (authSignupForm) {
    authSignupForm.addEventListener('submit', async (event) => {
      event.preventDefault()
      const email = authSignupEmail?.value.trim() ?? ''
      const password = authSignupPassword?.value ?? ''
      if (!email || !password) return

      setStatus('')
      const { data, error } = await supabase.auth.signUp({ email, password })

      if (error) {
        setStatus(error.message)
        return
      }

      if (data.session?.user) {
        if (authSignupPassword) authSignupPassword.value = ''
        await loadTodos(data.session.user.id)
        updateAuthUi(data.session.user)
        authDialog?.close()
        return
      }

      if (data.user) {
        setStatus('Check your email to confirm your account, then sign in.', 'notice')
        if (authSignupPassword) authSignupPassword.value = ''
        authDialog?.close()
      }
    })
  }

  if (authSigninForm) {
    authSigninForm.addEventListener('submit', async (event) => {
      event.preventDefault()
      const email = authSigninEmail?.value.trim() ?? ''
      const password = authSigninPassword?.value ?? ''
      if (!email || !password) return

      setStatus('')
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        setStatus(error.message)
        return
      }

      if (data.user) {
        if (authSigninPassword) authSigninPassword.value = ''
        await loadTodos(data.user.id)
        updateAuthUi(data.user)
        authDialog?.close()
      }
    })
  }

  if (authSignOutBtn) {
    authSignOutBtn.addEventListener('click', async () => {
      setStatus('')
      await supabase.auth.signOut()
      const user = await ensureSession()
      if (user) {
        await loadTodos(user.id)
      } else {
        todos = []
        renderTodos()
      }
      updateAuthUi(user)
    })
  }

  ;(async () => {
    try {
      const user = await ensureSession()
      if (!user) {
        setStatus(`Could not sign in anonymously.${deploySetupHint()}`)
        updateAuthUi(null)
        return
      }
      updateAuthUi(user)
      await loadTodos(user.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('Startup failed:', err)
      setLoading(false)
      renderTodos()
      setStatus(`Something went wrong on startup: ${msg}.${deploySetupHint()}`)
      updateAuthUi(null)
      refreshUiLock()
    }
  })()
} else {
  setStatus(
    'This deployment is missing Supabase settings. In Netlify open Site configuration → Environment variables and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (from Supabase → Project Settings → API), then redeploy.',
  )
  updateAuthUi(null)
  refreshUiLock()
}
