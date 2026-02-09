from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_bcrypt import Bcrypt
from datetime import datetime
import sqlite3
import os

app = Flask(__name__)
CORS(app)  # Allow React to talk to Flask
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'dev-secret-change')
jwt = JWTManager(app)
bcrypt = Bcrypt(app)

DATABASE = 'tasks.db'

def get_db():
    db = sqlite3.connect(DATABASE)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys = ON')
    return db

def init_db():
    with app.app_context():
        db = get_db()
        db.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL
            )
        ''')
        db.execute('''
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL,
                completed BOOLEAN NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        db.execute('''
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                UNIQUE(user_id, name),
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ''')
        db.execute('''
            CREATE TABLE IF NOT EXISTS task_categories (
                task_id INTEGER NOT NULL,
                category_id INTEGER NOT NULL,
                PRIMARY KEY (task_id, category_id),
                FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
            )
        ''')
        columns = db.execute('PRAGMA table_info(tasks)').fetchall()
        column_names = {col['name'] for col in columns}
        if 'user_id' not in column_names:
            db.execute('ALTER TABLE tasks ADD COLUMN user_id INTEGER')
        db.commit()

def build_tasks_with_categories(rows):
    tasks = []
    task_map = {}
    for row in rows:
        task_id = row['id']
        if task_id not in task_map:
            task_data = {
                'id': task_id,
                'text': row['text'],
                'completed': bool(row['completed']),
                'created_at': row['created_at'],
                'user_id': row['user_id'],
                'categories': []
            }
            task_map[task_id] = task_data
            tasks.append(task_data)
        if row['category_id'] is not None:
            task_map[task_id]['categories'].append({
                'id': row['category_id'],
                'name': row['category_name']
            })
    return tasks

def fetch_tasks_for_user(db, user_id, task_ids=None):
    if task_ids is None:
        rows = db.execute('''
            SELECT t.id, t.text, t.completed, t.created_at, t.user_id,
                   c.id as category_id, c.name as category_name
            FROM tasks t
            LEFT JOIN task_categories tc ON tc.task_id = t.id
            LEFT JOIN categories c ON c.id = tc.category_id
            WHERE t.user_id = ?
            ORDER BY t.created_at DESC
        ''', (user_id,)).fetchall()
    else:
        if not task_ids:
            return []
        placeholders = ','.join(['?'] * len(task_ids))
        rows = db.execute(f'''
            SELECT t.id, t.text, t.completed, t.created_at, t.user_id,
                   c.id as category_id, c.name as category_name
            FROM tasks t
            LEFT JOIN task_categories tc ON tc.task_id = t.id
            LEFT JOIN categories c ON c.id = tc.category_id
            WHERE t.user_id = ? AND t.id IN ({placeholders})
            ORDER BY t.created_at DESC
        ''', [user_id, *task_ids]).fetchall()
    return build_tasks_with_categories(rows)

def normalize_category_ids(raw_value):
    if raw_value is None:
        return []
    if not isinstance(raw_value, list):
        return None
    try:
        return sorted({int(value) for value in raw_value})
    except (TypeError, ValueError):
        return None

def validate_category_ids(db, user_id, category_ids):
    if not category_ids:
        return True
    placeholders = ','.join(['?'] * len(category_ids))
    rows = db.execute(
        f'SELECT id FROM categories WHERE user_id = ? AND id IN ({placeholders})',
        [user_id, *category_ids]
    ).fetchall()
    return len(rows) == len(category_ids)

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    db = get_db()
    existing = db.execute('SELECT id FROM users WHERE email = ?', (email,)).fetchone()
    if existing:
        return jsonify({'error': 'Email already registered'}), 409

    password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
    cursor = db.execute(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)',
        (email, password_hash)
    )
    db.commit()

    user_id = cursor.lastrowid
    access_token = create_access_token(identity=str(user_id))
    return jsonify({'access_token': access_token, 'user': {'id': user_id, 'email': email}}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    db = get_db()
    user = db.execute(
        'SELECT id, email, password_hash FROM users WHERE email = ?',
        (email,)
    ).fetchone()

    if not user or not bcrypt.check_password_hash(user['password_hash'], password):
        return jsonify({'error': 'Invalid email or password'}), 401

    access_token = create_access_token(identity=str(user['id']))
    return jsonify({'access_token': access_token, 'user': {'id': user['id'], 'email': user['email']}})

@app.route('/api/tasks', methods=['GET'])
@jwt_required()
def get_tasks():
    db = get_db()
    user_id = int(get_jwt_identity())
    category_filter = request.args.get('category')
    if category_filter:
        try:
            category_id = int(category_filter)
        except ValueError:
            return jsonify({'error': 'Invalid category filter'}), 400
        category = db.execute(
            'SELECT id FROM categories WHERE id = ? AND user_id = ?',
            (category_id, user_id)
        ).fetchone()
        if not category:
            return jsonify({'error': 'Category not found'}), 404
        task_rows = db.execute('''
            SELECT DISTINCT t.id
            FROM tasks t
            JOIN task_categories tc ON tc.task_id = t.id
            JOIN categories c ON c.id = tc.category_id
            WHERE t.user_id = ? AND c.user_id = ? AND c.id = ?
            ORDER BY t.created_at DESC
        ''', (user_id, user_id, category_id)).fetchall()
        task_ids = [row['id'] for row in task_rows]
        return jsonify(fetch_tasks_for_user(db, user_id, task_ids))
    return jsonify(fetch_tasks_for_user(db, user_id))

@app.route('/api/tasks', methods=['POST'])
@jwt_required()
def create_task():
    data = request.json or {}
    db = get_db()
    user_id = int(get_jwt_identity())
    text = (data.get('text') or '').strip()
    if not text:
        return jsonify({'error': 'Task text is required'}), 400
    category_ids = normalize_category_ids(data.get('category_ids'))
    if category_ids is None:
        return jsonify({'error': 'category_ids must be an array of ids'}), 400
    if not validate_category_ids(db, user_id, category_ids):
        return jsonify({'error': 'One or more categories are invalid'}), 400
    cursor = db.execute(
        'INSERT INTO tasks (text, completed, user_id) VALUES (?, ?, ?)',
        (text, False, user_id)
    )
    task_id = cursor.lastrowid
    if category_ids:
        db.executemany(
            'INSERT INTO task_categories (task_id, category_id) VALUES (?, ?)',
            [(task_id, category_id) for category_id in category_ids]
        )
    db.commit()
    task_rows = fetch_tasks_for_user(db, user_id, [task_id])
    return jsonify(task_rows[0] if task_rows else {
        'id': task_id,
        'text': text,
        'completed': False,
        'user_id': user_id,
        'categories': []
    }), 201

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
@jwt_required()
def update_task(task_id):
    data = request.json or {}
    db = get_db()
    user_id = int(get_jwt_identity())
    task = db.execute(
        'SELECT id FROM tasks WHERE id = ? AND user_id = ?',
        (task_id, user_id)
    ).fetchone()
    if not task:
        return jsonify({'error': 'Task not found'}), 404
    if 'completed' in data:
        db.execute(
            'UPDATE tasks SET completed = ? WHERE id = ?',
            (bool(data['completed']), task_id)
        )
    if 'category_ids' in data:
        category_ids = normalize_category_ids(data.get('category_ids'))
        if category_ids is None:
            return jsonify({'error': 'category_ids must be an array of ids'}), 400
        if not validate_category_ids(db, user_id, category_ids):
            return jsonify({'error': 'One or more categories are invalid'}), 400
        db.execute('DELETE FROM task_categories WHERE task_id = ?', (task_id,))
        if category_ids:
            db.executemany(
                'INSERT INTO task_categories (task_id, category_id) VALUES (?, ?)',
                [(task_id, category_id) for category_id in category_ids]
            )
    db.commit()
    task_rows = fetch_tasks_for_user(db, user_id, [task_id])
    return jsonify(task_rows[0] if task_rows else {'success': True})

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
@jwt_required()
def delete_task(task_id):
    db = get_db()
    user_id = int(get_jwt_identity())
    task = db.execute(
        'SELECT id FROM tasks WHERE id = ? AND user_id = ?',
        (task_id, user_id)
    ).fetchone()
    if not task:
        return jsonify({'error': 'Task not found'}), 404
    db.execute('DELETE FROM tasks WHERE id = ?', (task_id,))
    db.commit()
    return jsonify({'success': True})

@app.route('/api/categories', methods=['GET'])
@jwt_required()
def get_categories():
    db = get_db()
    user_id = int(get_jwt_identity())
    categories = db.execute(
        'SELECT id, name FROM categories WHERE user_id = ? ORDER BY name ASC',
        (user_id,)
    ).fetchall()
    return jsonify([dict(category) for category in categories])

@app.route('/api/categories', methods=['POST'])
@jwt_required()
def create_category():
    data = request.json or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Category name is required'}), 400
    db = get_db()
    user_id = int(get_jwt_identity())
    existing = db.execute(
        'SELECT id FROM categories WHERE user_id = ? AND name = ?',
        (user_id, name)
    ).fetchone()
    if existing:
        return jsonify({'error': 'Category already exists'}), 409
    cursor = db.execute(
        'INSERT INTO categories (name, user_id) VALUES (?, ?)',
        (name, user_id)
    )
    db.commit()
    return jsonify({'id': cursor.lastrowid, 'name': name}), 201

@app.route('/api/categories/<int:category_id>', methods=['DELETE'])
@jwt_required()
def delete_category(category_id):
    db = get_db()
    user_id = int(get_jwt_identity())
    category = db.execute(
        'SELECT id FROM categories WHERE id = ? AND user_id = ?',
        (category_id, user_id)
    ).fetchone()
    if not category:
        return jsonify({'error': 'Category not found'}), 404
    db.execute('DELETE FROM categories WHERE id = ?', (category_id,))
    db.commit()
    return jsonify({'success': True})

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
