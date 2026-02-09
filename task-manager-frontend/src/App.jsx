import { useState, useEffect } from 'react'
import api from './api/axios'
import Login from './components/Login'
import Register from './components/Register'
import ProtectedRoute from './components/ProtectedRoute'
import './App.css'

function App() {
  const [tasks, setTasks] = useState([])
  const [newTask, setNewTask] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [token, setToken] = useState(localStorage.getItem('token') || '')
  const [authMode, setAuthMode] = useState('login')
  const isAuthenticated = Boolean(token)

  useEffect(() => {
    if (token) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`
      fetchTasks()
    } else {
      setLoading(false)
      setTasks([])
      delete api.defaults.headers.common.Authorization
    }
  }, [token])

  const getAuthHeaders = () => {
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  const fetchTasks = async () => {
    try {
      setError('')
      const response = await api.get('/tasks', { headers: getAuthHeaders() })
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

  const addTask = async () => {
    if (newTask.trim()) {
      try {
        setError('')
        const response = await api.post(
          '/tasks',
          { text: newTask },
          { headers: getAuthHeaders() }
        )
        setTasks([response.data, ...tasks])
        setNewTask('')
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
      setTasks(tasks.map(task => 
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

  const deleteTask = async (id) => {
    try {
      setError('')
      await api.delete(`/tasks/${id}`, { headers: getAuthHeaders() })
      setTasks(tasks.filter(task => task.id !== id))
    } catch (error) {
      console.error('Error deleting task:', error)
      if (error?.response?.status === 401 || error?.response?.status === 422) {
        handleLogout()
        return
      }
      setError('Could not delete task. Try again.')
    }
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
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <button
                onClick={() => setAuthMode('login')}
                disabled={authMode === 'login'}
              >
                Login
              </button>
              <button
                onClick={() => setAuthMode('register')}
                disabled={authMode === 'register'}
                style={{ marginLeft: '0.5rem' }}
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
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <button onClick={handleLogout}>Logout</button>
          </div>

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
          {error && <p role="alert">{error}</p>}

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
                  <span style={{ textDecoration: task.completed ? 'line-through' : 'none' }}>
                    {task.text}
                  </span>
                  <button onClick={() => deleteTask(task.id)}>Delete</button>
                </div>
              ))
            )}
          </div>
        </div>
      </ProtectedRoute>
    </div>
  )
}

export default App
