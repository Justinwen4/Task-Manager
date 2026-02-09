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
        columns = db.execute('PRAGMA table_info(tasks)').fetchall()
        column_names = {col['name'] for col in columns}
        if 'user_id' not in column_names:
            db.execute('ALTER TABLE tasks ADD COLUMN user_id INTEGER')
        db.commit()

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
    tasks = db.execute(
        'SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC',
        (user_id,)
    ).fetchall()
    return jsonify([dict(task) for task in tasks])

@app.route('/api/tasks', methods=['POST'])
@jwt_required()
def create_task():
    data = request.json
    db = get_db()
    user_id = int(get_jwt_identity())
    cursor = db.execute(
        'INSERT INTO tasks (text, completed, user_id) VALUES (?, ?, ?)',
        (data['text'], False, user_id)
    )
    db.commit()
    task_id = cursor.lastrowid
    return jsonify({'id': task_id, 'text': data['text'], 'completed': False, 'user_id': user_id}), 201

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
@jwt_required()
def update_task(task_id):
    data = request.json
    db = get_db()
    user_id = int(get_jwt_identity())
    task = db.execute(
        'SELECT id FROM tasks WHERE id = ? AND user_id = ?',
        (task_id, user_id)
    ).fetchone()
    if not task:
        return jsonify({'error': 'Task not found'}), 404
    db.execute(
        'UPDATE tasks SET completed = ? WHERE id = ?',
        (data['completed'], task_id)
    )
    db.commit()
    return jsonify({'success': True})

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

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
