import './style.css'

const todoForm = document.querySelector('.todo-form')
const todoInput = document.querySelector('.todo-input')
const todoList = document.querySelector('.todo-list')

let todos = []

todoForm.addEventListener('submit', (event) => {
  event.preventDefault()

  const text = todoInput.value.trim()
  if (!text) return

  todos = [
    ...todos,
    {
      id: createTodoId(),
      text,
      completed: false,
    },
  ]

  todoInput.value = ''
  todoInput.focus()
  renderTodos()
})

todoList.addEventListener('change', (event) => {
  const checkbox = event.target.closest('.todo-checkbox')
  if (!checkbox) return

  todos = todos.map((todo) =>
    todo.id === checkbox.dataset.id ? { ...todo, completed: checkbox.checked } : todo,
  )

  renderTodos()
})

todoList.addEventListener('click', (event) => {
  const deleteButton = event.target.closest('.todo-delete-button')
  if (!deleteButton) return

  todos = todos.filter((todo) => todo.id !== deleteButton.dataset.id)

  renderTodos()
})

renderTodos()

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

function createTodoId() {
  return crypto.randomUUID()
}
