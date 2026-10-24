# Local Development Environment Setup & Onboarding Guide

This guide provides step-by-step instructions to set up, configure, and run the Real-Time Communication Platform locally on your workstation.

---

## 1. Prerequisites & Toolchain Versions

Before getting started, verify that the following tools are installed on your machine:

| Component | Required Version | Verification Command |
| :--- | :--- | :--- |
| **Node.js** | `>= 20.x` (Recommended: `24.x`) | `node --version` |
| **npm** | `>= 10.x` | `npm --version` |
| **Angular CLI** | `21.x` | `npx ng version` or `ng version` |
| **Python** | `>= 3.11` | `python --version` |
| **Git** | `>= 2.x` | `git --version` |

---

## 2. Repository Structure

```text
realtime-communication-platform/
├── backend/            # Django 5.2 ASGI/WSGI backend project (commute)
│   ├── commute/        # Core Django settings, URLs, ASGI/WSGI entrypoints
│   ├── manage.py       # Django management CLI
│   └── requirements.txt# Python dependencies
├── frontend/           # Angular 21 standalone frontend application
│   ├── src/            # Application components, styles, and configs
│   ├── package.json    # Node dependencies and scripts
│   └── angular.json    # Angular CLI configuration
├── docs/               # Architecture, setup, and onboarding documentation
├── specs/              # Technical specifications and phase plans
└── README.md           # Project overview and roadmap
```

---

## 3. Backend Setup (Django)

### Step 3.1: Navigate to the Backend Directory
```bash
cd backend
```

### Step 3.2: Create and Activate Virtual Environment

**On Windows (PowerShell):**
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```
*(If PowerShell restricts script execution, run: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`)*

**On macOS / Linux (bash/zsh):**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### Step 3.3: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 3.4: Apply Database Migrations
```bash
python manage.py migrate
```

### Step 3.5: Run System Check
Verify that the project settings and applications are properly configured:
```bash
python manage.py check
```

### Step 3.6: Start Development Server
```bash
python manage.py runserver
```
The Django backend will be available at: **`http://127.0.0.1:8000/`**

---

## 4. Frontend Setup (Angular)

Open a separate terminal window for the frontend.

### Step 4.1: Navigate to the Frontend Directory
```bash
cd frontend
```

### Step 4.2: Install Node Dependencies
```bash
npm install
```

### Step 4.3: Start the Angular Development Server
```bash
npm start
```
*(or run `npx ng serve`)*

Once compiled, navigate your browser to: **`http://localhost:4200/`**

The application automatically reloads when any source file under `src/` changes.

---

## 5. Development URLs & Ports

| Service | Local URL | Port |
| :--- | :--- | :--- |
| **Frontend Application** | `http://localhost:4200` | `4200` |
| **Backend API** | `http://127.0.0.1:8000` | `8000` |
| **Django Admin** | `http://127.0.0.1:8000/admin/` | `8000` |

---

## 6. Environment Variables & Conventions

For local development, sensible defaults are configured:
- `DEBUG = True`
- `SECRET_KEY`: default development key
- `DATABASES`: SQLite local database (`db.sqlite3`)

When moving toward Milestone 2 (CORS/REST) and Milestone 10 (Production Hardening), configuration will be read from a root `.env` file (see `.env.example`).

---

## 7. Verification Checklist

To confirm your local environment is fully operational:
1. `python manage.py check` outputs: `System check identified no issues (0 silenced)`.
2. Visiting `http://127.0.0.1:8000` renders the Django welcome screen.
3. Visiting `http://localhost:4200` renders the Angular application root layout.
4. Git working tree is clean with `git status` ignoring `.venv`, `node_modules`, and `db.sqlite3`.
