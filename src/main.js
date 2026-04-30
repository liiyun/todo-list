import './style.css'
import { supabase } from './supabase.js'

const todoForm = document.querySelector('.todo-form')
const todoInput = document.querySelector('.todo-input')
const todoList = document.querySelector('.todo-list')

let todos = []

function rowToTodo(row) {
  return {
    id: String(row.id),
    text: row.text,
    completed: row.is_complete,
  }
}

async function loadTodos() {
  const { data, error } = await supabase
    .from('todos')
    .select('id, text, is_complete, created_at')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to load todos:', error.message)
    return
  }

  todos = (data ?? []).map(rowToTodo)
  renderTodos()
}

todoForm.addEventListener('submit', async (event) => {
  event.preventDefault()

  const text = todoInput.value.trim()
  if (!text) return

  const { data, error } = await supabase.from('todos').insert({ text }).select('id, text, is_complete').single()

  if (error) {
    console.error('Failed to add todo:', error.message)
    return
  }

  todos = [...todos, rowToTodo(data)]
  todoInput.value = ''
  todoInput.focus()
  renderTodos()
})

todoList.addEventListener('change', async (event) => {
  const checkbox = event.target.closest('.todo-checkbox')
  if (!checkbox) return

  const id = Number(checkbox.dataset.id)
  const completed = checkbox.checked

  const { error } = await supabase.from('todos').update({ is_complete: completed }).eq('id', id)

  if (error) {
    console.error('Failed to update todo:', error.message)
    checkbox.checked = !completed
    return
  }

  todos = todos.map((todo) => (todo.id === String(id) ? { ...todo, completed } : todo))
  renderTodos()
})

todoList.addEventListener('click', async (event) => {
  const deleteButton = event.target.closest('.todo-delete-button')
  if (!deleteButton) return

  const id = Number(deleteButton.dataset.id)

  const { error } = await supabase.from('todos').delete().eq('id', id)

  if (error) {
    console.error('Failed to delete todo:', error.message)
    return
  }

  todos = todos.filter((todo) => todo.id !== String(id))
  renderTodos()
})

function renderTodos() {
  todoList.replaceChildren(...todos.map(createTodoItem))
}

function createTodoItem(todo) {
  const item = document.createElement('li')
  item.className = 'todo-item'
  if (todo.completed) item.classList.add('todo-item-completed')

  const checkboxLabel = todo.completed
    ? `Mark "${todo.text}" as incomplete`
    : `Mark "${todo.text}" as complete`

  const checkbox = document.createElement('input')
  checkbox.className = 'todo-checkbox'
  checkbox.type = 'checkbox'
  checkbox.checked = todo.completed
  checkbox.dataset.id = todo.id
  checkbox.setAttribute('aria-label', checkboxLabel)

  const text = document.createElement('span')
  text.className = 'todo-item-text'
  text.textContent = todo.text

  const deleteButton = document.createElement('button')
  deleteButton.className = 'todo-delete-button'
  deleteButton.type = 'button'
  deleteButton.dataset.id = todo.id
  deleteButton.textContent = 'Delete'
  deleteButton.setAttribute('aria-label', `Delete "${todo.text}"`)

  item.append(checkbox, text, deleteButton)
  return item
}

loadTodos()
