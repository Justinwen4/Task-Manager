# Task Manager

A full-stack task management application built with React and Flask, featuring real-time CRUD operations and persistent data storage.

## Features

- Create, read, update, and delete tasks
- Mark tasks as complete/incomplete
- Persistent data storage with SQLite database
- RESTful API architecture
- Responsive user interface
- Real-time UI updates

## Tech Stack

### Frontend

- **React** - UI framework
- **Vite** - Build tool and dev server
- **Axios** - HTTP client for API requests
- **CSS3** - Styling

### Backend

- **Flask** - Python web framework
- **Flask-CORS** - Cross-origin resource sharing
- **SQLite** - Lightweight database
- **Python 3.14** - Programming language

## Project Structure

```
task-manager/
├── task-manager-frontend/     # React frontend
│   ├── src/
│   │   ├── App.jsx           # Main application component
│   │   ├── App.css           # Styles
│   │   └── main.jsx          # Entry point
│   └── package.json
│
├── task-manager-backend/      # Flask backend
│   ├── app.py                # Flask API server
│   ├── tasks.db              # SQLite database
│   └── venv/                 # Python virtual environment
│
└── README.md                 # This file
```

## Installation & Setup

### Prerequisites

- Node.js (v16 or higher)
- Python 3.x
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:

```bash
cd task-manager-backend
```

2. Create and activate a virtual environment:

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install Python dependencies:

```bash
pip install flask flask-cors
```

4. Run the Flask server:

```bash
python app.py
```

The API will be available at `http://localhost:5000`

### Frontend Setup

1. Navigate to the frontend directory:

```bash
cd task-manager-frontend
```

2. Install dependencies:

```bash
npm install
```

3. Install axios for API calls:

```bash
npm install axios
```

4. Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## API Endpoints

| Method | Endpoint          | Description                   |
| ------ | ----------------- | ----------------------------- |
| GET    | `/api/tasks`      | Retrieve all tasks            |
| POST   | `/api/tasks`      | Create a new task             |
| PUT    | `/api/tasks/<id>` | Update task completion status |
| DELETE | `/api/tasks/<id>` | Delete a task                 |

### Example API Request

**Create a Task:**

```bash
curl -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"text": "Complete project documentation"}'
```

**Get All Tasks:**

```bash
curl http://localhost:5000/api/tasks
```

## How It Works

1. **Frontend (React)**: User interacts with the UI to create, update, or delete tasks
2. **API Calls (Axios)**: React sends HTTP requests to the Flask backend
3. **Backend (Flask)**: Processes requests and performs database operations
4. **Database (SQLite)**: Stores task data persistently
5. **Response**: Flask returns data to React, which updates the UI

## Usage

1. Start both the Flask backend and React frontend
2. Open your browser to `http://localhost:5173`
3. Add tasks using the input field
4. Check off completed tasks
5. Delete tasks you no longer need
6. Refresh the page - your tasks persist!

## Future Improvements

- [ ] User authentication and authorization
- [ ] Task categories and tags
- [ ] Due dates and reminders
- [ ] Task priority levels
- [ ] Search and filter functionality
- [ ] Dark mode toggle
- [ ] Deploy to production (Render + Vercel)

## Development Notes

- The frontend runs on port 5173 (Vite default)
- The backend runs on port 5000 (Flask default)
- CORS is enabled to allow frontend-backend communication
- Database file (`tasks.db`) is created automatically on first run

## Contributing

Feel free to fork this project and submit pull requests for any improvements.

## License

This project is open source and available under the MIT License.

## Author

Justin Wen

- GitHub: [@Justinwen4](https://github.com/Justinwen4)
- LinkedIn: [Justin Wen](https://www.linkedin.com/in/justin-wen-763688344/)

---
