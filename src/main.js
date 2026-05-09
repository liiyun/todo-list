import './styles/index.css'
import { supabase } from './supabase.js'

const todoForm = document.querySelector('.todo-form')
const todoInput = document.querySelector('.todo-input')
const todoList = document.querySelector('.todo-list')
const statusEl = document.querySelector('.todo-status')
const loadingEl = document.querySelector('.todo-loading')
const retryButton = document.querySelector('.todo-retry-button')
const categorySelect = document.querySelector('.todo-category-select')
const dueDateInput = document.querySelector('.todo-due-date')
const prioritySelect = document.querySelector('.todo-priority-select')
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

let todos = []
let currentUserId = null
let loadFailed = false
let isLoadingList = false

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
  const busy = isLoadingList || loadFailed
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

async function ensureSession() {
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
}

function normalizeCategory(cat) {
  if (cat == null || cat === '' || cat === 'general') return 'work'
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

function getVisibleTodos() {
  return [...todos].sort(compareTodosByCreated)
}

async function loadTodos(userId) {
  currentUserId = userId
  loadFailed = false
  if (retryButton) retryButton.classList.add('todo-retry-button--hidden')
  setStatus('')
  setLoading(true)

  let { data, error } = await supabase
    .from('todos')
    .select(TODO_SELECT_FULL)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error && isMissingColumnError(error)) {
    const fallback = await supabase
      .from('todos')
      .select(TODO_SELECT_BASE)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    data = fallback.data
    error = fallback.error
  }

  setLoading(false)

  if (error) {
    console.error('Failed to load todos:', error.message)
    todos = []
    renderTodos()
    setLoadError(error.message)
    return
  }

  todos = (data ?? []).map(rowToTodo)
  renderTodos()
}

if (todoForm) {
  todoForm.addEventListener('submit', async (event) => {
    event.preventDefault()

    const text = todoInput?.value.trim() ?? ''
    if (!text) {
      setStatus('Enter a task before adding.', 'notice')
      return
    }

    const user = await ensureSession()
    if (!user) {
      setStatus(`Could not sign in anonymously.${deploySetupHint()}`)
      return
    }

    setStatus('')

    const category = categorySelect?.value ?? 'work'
    const dueRaw = dueDateInput?.value
    const due_date = dueRaw || null
    const priority = prioritySelect?.value ?? 'medium'

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

    todos = [...todos, rowToTodo(data)]
    if (todoInput) todoInput.value = ''
    if (dueDateInput) dueDateInput.value = ''
    todoInput?.focus()
    renderTodos()
  })
}

if (todoList) {
  todoList.addEventListener('change', async (event) => {
    const checkbox = event.target.closest('.todo-checkbox')
    if (!checkbox) return

    if (!(await ensureSession())) return

    const id = Number(checkbox.dataset.id)
    const completed = checkbox.checked

    const { error } = await supabase.from('todos').update({ is_complete: completed }).eq('id', id)

    if (error) {
      console.error('Failed to update todo:', error.message)
      setStatus(`Could not update task: ${error.message}`)
      checkbox.checked = !completed
      return
    }

    setStatus('')
    todos = todos.map((todo) => (todo.id === String(id) ? { ...todo, completed } : todo))
    renderTodos()
  })

  todoList.addEventListener('click', async (event) => {
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
    todos = todos.filter((todo) => todo.id !== String(id))
    renderTodos()
  })
}

function renderTodos() {
  if (!todoList) return
  const visible = getVisibleTodos()
  todoList.replaceChildren(...visible.map(createTodoItem))
}

const CATEGORY_LABELS = {
  work: 'Work',
  personal: 'Personal',
  errands: 'Errands',
}

function categoryClass(cat) {
  const raw = normalizeCategory(cat).toLowerCase().replace(/\s+/g, '-')
  const key = raw.replace(/[^a-z0-9-]/g, '') || 'work'
  return `todo-category-badge todo-category-badge--${key}`
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

function todayIsoDate() {
  const t = new Date()
  const y = t.getFullYear()
  const m = String(t.getMonth() + 1).padStart(2, '0')
  const d = String(t.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function createTodoItem(todo) {
  const item = document.createElement('li')
  item.className = 'todo-item'
  if (todo.completed) item.classList.add('todo-item-completed')
  if (todo.priority === 'high') item.classList.add('todo-item-priority-high')
  if (todo.dueDate && !todo.completed && todo.dueDate < todayIsoDate()) {
    item.classList.add('todo-item-overdue')
  }

  const checkboxLabel = todo.completed
    ? `Mark "${todo.text}" as incomplete`
    : `Mark "${todo.text}" as complete`

  const checkbox = document.createElement('input')
  checkbox.className = 'todo-checkbox'
  checkbox.type = 'checkbox'
  checkbox.checked = todo.completed
  checkbox.dataset.id = todo.id
  checkbox.setAttribute('aria-label', checkboxLabel)

  const mainCol = document.createElement('div')
  mainCol.className = 'todo-item-main'

  const metaRow = document.createElement('div')
  metaRow.className = 'todo-item-meta'

  const badge = document.createElement('span')
  badge.className = categoryClass(todo.category)
  badge.textContent = CATEGORY_LABELS[todo.category] ?? todo.category

  metaRow.append(badge)

  if (todo.dueDate) {
    const due = document.createElement('time')
    due.className = 'todo-item-due'
    due.dateTime = todo.dueDate
    due.textContent = formatDueDate(todo.dueDate)
    metaRow.append(due)
  }

  const pri = document.createElement('span')
  pri.className = `todo-priority-label todo-priority-label--${todo.priority}`
  pri.textContent =
    todo.priority === 'high' ? 'High' : todo.priority === 'low' ? 'Low' : 'Medium'
  metaRow.append(pri)

  const text = document.createElement('span')
  text.className = 'todo-item-text'
  text.textContent = todo.text

  mainCol.append(metaRow, text)

  const deleteButton = document.createElement('button')
  deleteButton.className = 'todo-delete-button'
  deleteButton.type = 'button'
  deleteButton.dataset.id = todo.id
  deleteButton.textContent = 'Delete'
  deleteButton.setAttribute('aria-label', `Delete "${todo.text}"`)

  item.append(checkbox, mainCol, deleteButton)
  return item
}

if (retryButton) {
  retryButton.addEventListener('click', () => {
    if (currentUserId) loadTodos(currentUserId)
  })
}

authTabs.forEach((tab) => {
  tab.addEventListener('click', () => setActiveAuthPanel(tab.dataset.panel))
})

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
      return
    }

    if (data.user) {
      setStatus('Check your email to confirm your account, then sign in.', 'notice')
      if (authSignupPassword) authSignupPassword.value = ''
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
  const user = await ensureSession()
  if (!user) {
    setStatus(`Could not sign in anonymously.${deploySetupHint()}`)
    updateAuthUi(null)
    return
  }
  updateAuthUi(user)
  await loadTodos(user.id)
})()
