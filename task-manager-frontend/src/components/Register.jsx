import { useState } from 'react'
import api from '../api/axios'

function Register({ onAuthSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await api.post('/register', { email, password })
      const token = response.data.access_token
      onAuthSuccess(token, response.data.user)
    } catch (err) {
      console.error('Registration failed:', err)
      const status = err?.response?.status
      if (status === 409) {
        setError('Email already registered.')
      } else {
        setError('Registration failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Register</h2>
      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? 'Creating account...' : 'Create account'}
      </button>
    </form>
  )
}

export default Register
