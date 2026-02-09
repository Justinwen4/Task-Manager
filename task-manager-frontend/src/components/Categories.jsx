import { useState } from 'react'

function Categories({ categories, onCreate, onDelete, getCategoryColor }) {
  const [newCategory, setNewCategory] = useState('')
  const [localError, setLocalError] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    const name = newCategory.trim()
    if (!name) {
      setLocalError('Category name is required.')
      return
    }
    onCreate(name)
    setNewCategory('')
    setLocalError('')
  }

  return (
    <section className="categories-panel">
      <h2>Categories</h2>
      <form onSubmit={handleSubmit} className="category-form">
        <input
          type="text"
          value={newCategory}
          onChange={(event) => setNewCategory(event.target.value)}
          placeholder="Add a category..."
        />
        <button type="submit">Add</button>
      </form>
      {localError && <p role="alert">{localError}</p>}
      <div className="category-list">
        {categories.length === 0 ? (
          <p>No categories yet.</p>
        ) : (
          categories.map(category => (
            <div key={category.id} className="category-item">
              <span
                className="category-chip"
                style={{ backgroundColor: getCategoryColor(category.id) }}
              >
                {category.name}
              </span>
              <button
                type="button"
                onClick={() => onDelete(category.id)}
                className="category-delete"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

export default Categories
