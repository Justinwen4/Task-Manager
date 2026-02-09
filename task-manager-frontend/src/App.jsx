import { useState, useEffect } from 'react'
import api from './api/axios'
import Login from './components/Login'
import Register from './components/Register'
import ProtectedRoute from './components/ProtectedRoute'
import Categories from './components/Categories'
import './App.css'

function App() {
  const [tasks, setTasks] = useState([])
  const [newTask, setNewTask] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [token, setToken] = useState(localStorage.getItem('token') || '')
  const [authMode, setAuthMode] = useState('login')
  const [categories, setCategories] = useState([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([])
  const [activeCategoryId, setActiveCategoryId] = useState(null)
  const isAuthenticated = Boolean(token)

  useEffect(() => {
    if (token) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`
      fetchCategories()
      fetchTasks(activeCategoryId)
    } else {
      setLoading(false)
      setTasks([])
      setCategories([])
      setSelectedCategoryIds([])
      setActiveCategoryId(null)
      delete api.defaults.headers.common.Authorization
    }
  }, [token])

  useEffect(() => {
    if (token) {
      fetchTasks(activeCategoryId)
    }
  }, [activeCategoryId, token])

  const getAuthHeaders = () => {
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  const fetchTasks = async (categoryId = null) => {
    try {
      setError('')
      const query = categoryId ? `?category=${categoryId}` : ''
      const response = await api.get(`/tasks${query}`, { headers: getAuthHeaders() })
      setTasks(response.data)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching tasks:', error)
      if (error?.response?.status === 401 || error?.response?.status === 422) {
        handleLogout()
        return
      }
      setError('Could not load tasks. Check that the backend is running.')
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await api.get('/categories', { headers: getAuthHeaders() })
      setCategories(response.data)
    } catch (error) {
      console.error('Error fetching categories:', error)
      if (error?.response?.status === 401 || error?.response?.status === 422) {
        handleLogout()
      }
    }
  }

  const addTask = async () => {
    if (newTask.trim()) {
      try {
        setError('')
        const response = await api.post(
          '/tasks',
          { text: newTask, category_ids: selectedCategoryIds },
          { headers: getAuthHeaders() }
        )
        setTasks(prev => [response.data, ...prev])
        setNewTask('')
        setSelectedCategoryIds([])
      } catch (error) {
        console.error('Error adding task:', error)
        if (error?.response?.status === 401 || error?.response?.status === 422) {
          handleLogout()
          return
        }
        setError('Could not add task. Check the backend and try again.')
      }
    }
  }

  const toggleTask = async (id, completed) => {
    try {
      setError('')
      await api.put(
        `/tasks/${id}`,
        { completed: !completed },
        { headers: getAuthHeaders() }
      )
      setTasks(prev => prev.map(task =>
        task.id === id ? { ...task, completed: !completed } : task
      ))
    } catch (error) {
      console.error('Error updating task:', error)
      if (error?.response?.status === 401 || error?.response?.status === 422) {
        handleLogout()
        return
      }
      setError('Could not update task. Try again.')
    }
  }

  const updateTaskCategories = async (taskId, categoryIds) => {
    try {
      setError('')
      const response = await api.put(
        `/tasks/${taskId}`,
        { category_ids: categoryIds },
        { headers: getAuthHeaders() }
      )
      setTasks(prev => prev.map(task => (
        task.id === taskId ? response.data : task
      )))
    } catch (error) {
      console.error('Error updating task categories:', error)
      if (error?.response?.status === 401 || error?.response?.status === 422) {
        handleLogout()
        return
      }
      setError('Could not update task categories. Try again.')
    }
  }

  const deleteTask = async (id) => {
    try {
      setError('')
      await api.delete(`/tasks/${id}`, { headers: getAuthHeaders() })
      setTasks(prev => prev.filter(task => task.id !== id))
    } catch (error) {
      console.error('Error deleting task:', error)
      if (error?.response?.status === 401 || error?.response?.status === 422) {
        handleLogout()
        return
      }
      setError('Could not delete task. Try again.')
    }
  }

  const handleCreateCategory = async (name) => {
    try {
      setError('')
      const response = await api.post(
        '/categories',
        { name },
        { headers: getAuthHeaders() }
      )
      setCategories(prev => [...prev, response.data].sort((a, b) => a.name.localeCompare(b.name)))
    } catch (error) {
      console.error('Error creating category:', error)
      if (error?.response?.status === 409) {
        setError('Category already exists.')
        return
      }
      if (error?.response?.status === 401 || error?.response?.status === 422) {
        handleLogout()
        return
      }
      setError('Could not create category. Try again.')
    }
  }

  const handleDeleteCategory = async (categoryId) => {
    try {
      setError('')
      await api.delete(`/categories/${categoryId}`, { headers: getAuthHeaders() })
      setCategories(prev => prev.filter(category => category.id !== categoryId))
      setTasks(prev => prev.map(task => ({
        ...task,
        categories: (task.categories || []).filter(category => category.id !== categoryId)
      })))
      if (activeCategoryId === categoryId) {
        setActiveCategoryId(null)
      }
    } catch (error) {
      console.error('Error deleting category:', error)
      if (error?.response?.status === 401 || error?.response?.status === 422) {
        handleLogout()
        return
      }
      setError('Could not delete category. Try again.')
    }
  }

  const handleCategorySelectChange = (event) => {
    const selected = Array.from(event.target.selectedOptions).map(option => Number(option.value))
    setSelectedCategoryIds(selected)
  }

  const getCategoryColor = (categoryId) => {
    const palette = ['#2F855A', '#D53F8C', '#2B6CB0', '#B7791F', '#6B46C1', '#319795', '#C05621']
    return palette[categoryId % palette.length]
  }

  const handleRemoveCategoryFromTask = (task, categoryId) => {
    const remainingIds = (task.categories || [])
      .filter(category => category.id !== categoryId)
      .map(category => category.id)
    updateTaskCategories(task.id, remainingIds)
  }

  const handleAuthSuccess = (newToken) => {
    localStorage.setItem('token', newToken)
    setToken(newToken)
    setAuthMode('login')
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setToken('')
  }

  if (loading) return <div>Loading...</div>

  return (
    <div className="App">
      <h1>Task Manager</h1>

      <ProtectedRoute
        isAuthenticated={isAuthenticated}
        fallback={
          <div className="auth-panel">
            <div className="auth-switch">
              <button
                onClick={() => setAuthMode('login')}
                disabled={authMode === 'login'}
              >
                Login
              </button>
              <button
                onClick={() => setAuthMode('register')}
                disabled={authMode === 'register'}
              >
                Register
              </button>
            </div>
            {authMode === 'login' ? (
              <Login onAuthSuccess={handleAuthSuccess} />
            ) : (
              <Register onAuthSuccess={handleAuthSuccess} />
            )}
          </div>
        }
      >
        <div className="dashboard">
          <div className="toolbar">
            <button onClick={handleLogout}>Logout</button>
          </div>

          <div className="panel">
            <div className="task-input">
              <input 
                type="text"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addTask()}
                placeholder="Add a new task..."
              />
              <button onClick={addTask}>Add Task</button>
            </div>
            <div className="task-categories">
              <label>
                Categories
                <select
                  multiple
                  value={selectedCategoryIds.map(String)}
                  onChange={handleCategorySelectChange}
                  disabled={categories.length === 0}
                >
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          {error && <p role="alert">{error}</p>}

          <div className="filters">
            <button
              className={activeCategoryId === null ? 'active' : ''}
              onClick={() => setActiveCategoryId(null)}
            >
              All
            </button>
            {categories.map(category => (
              <button
                key={category.id}
                className={activeCategoryId === category.id ? 'active' : ''}
                style={{ backgroundColor: getCategoryColor(category.id) }}
                onClick={() => setActiveCategoryId(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>

          <div className="task-list">
            {tasks.length === 0 ? (
              <p>No tasks yet. Add one above!</p>
            ) : (
              tasks.map(task => (
                <div key={task.id} className="task-item">
                  <input 
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => toggleTask(task.id, task.completed)}
                  />
                  <span className="task-text" style={{ textDecoration: task.completed ? 'line-through' : 'none' }}>
                    {task.text}
                  </span>
                  <div className="task-tags">
                    {(task.categories || []).map(category => (
                      <span
                        key={category.id}
                        className="task-tag"
                        style={{ backgroundColor: getCategoryColor(category.id) }}
                      >
                        {category.name}
                        <button
                          type="button"
                          className="tag-remove"
                          onClick={() => handleRemoveCategoryFromTask(task, category.id)}
                          aria-label={`Remove ${category.name}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <button onClick={() => deleteTask(task.id)}>Delete</button>
                </div>
              ))
            )}
          </div>
        </div>
        <Categories
          categories={categories}
          onCreate={handleCreateCategory}
          onDelete={handleDeleteCategory}
          getCategoryColor={getCategoryColor}
        />
      </ProtectedRoute>
    </div>
  )
}

export default App
