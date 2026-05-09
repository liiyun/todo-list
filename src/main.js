import './styles/index.css'
import { supabase } from './supabase.js'

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
let addTodoInFlight = false
let taskTitleDraft = ''
let editingTodoId = null

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
  const busy = isLoadingList || loadFailed || addTodoInFlight
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

    todos = [...todos, rowToTodo(data)]
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
    const cancelBtn = event.target.closest('.todo-edit-cancel')
    if (cancelBtn) {
      editingTodoId = null
      setStatus('')
      renderTodos()
      return
    }

    const saveBtn = event.target.closest('.todo-edit-save')
    if (saveBtn) {
      const item = saveBtn.closest('.todo-item')
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

if (dueDateInput && !dueDateInput.value) {
  dueDateInput.value = todayIsoDate()
}

function populateCategoryEditSelect(select, current) {
  const cur = normalizeCategory(current)
  const order = ['work', 'personal', 'errands']
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

function appendSvgIcon(button, svgMarkup) {
  const t = document.createElement('template')
  t.innerHTML = svgMarkup.trim()
  const svg = t.content.firstElementChild
  if (svg) {
    svg.setAttribute('aria-hidden', 'true')
    button.append(svg)
  }
}

function createTodoItem(todo) {
  const isEditing = editingTodoId === todo.id
  const item = document.createElement('li')
  item.className = 'todo-item'
  if (isEditing) item.classList.add('todo-item--editing')
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
  checkbox.disabled = isEditing
  checkbox.dataset.id = todo.id
  checkbox.setAttribute('aria-label', checkboxLabel)

  const mainCol = document.createElement('div')
  mainCol.className = 'todo-item-main'

  if (isEditing) {
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
    mainCol.append(editWrap)
  } else {
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
  }

  const actions = document.createElement('div')
  actions.className = 'todo-item-actions'

  if (!isEditing) {
    const editButton = document.createElement('button')
    editButton.className = 'todo-edit-button todo-icon-button'
    editButton.type = 'button'
    editButton.dataset.id = todo.id
    editButton.setAttribute(
      'aria-label',
      `Edit task, category, priority, and due date for "${todo.text}"`,
    )
    appendSvgIcon(editButton, SVG_ICON_PENCIL)
    actions.append(editButton)
  }

  const deleteButton = document.createElement('button')
  deleteButton.className = 'todo-delete-button todo-icon-button'
  deleteButton.type = 'button'
  deleteButton.dataset.id = todo.id
  deleteButton.setAttribute('aria-label', `Delete "${todo.text}"`)
  appendSvgIcon(deleteButton, SVG_ICON_TRASH)

  actions.append(deleteButton)

  item.append(checkbox, mainCol, actions)
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
