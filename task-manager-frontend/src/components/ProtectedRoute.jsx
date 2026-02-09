function ProtectedRoute({ isAuthenticated, children, fallback = null }) {
  if (!isAuthenticated) return fallback
  return children
}

export default ProtectedRoute
