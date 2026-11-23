# 🚀 Deployment Guide — Real-Time Communication Platform

**Stack:** Django (backend) + Angular (frontend) + PostgreSQL + Redis  
**Platform:** Render (recommended — free tier with PostgreSQL + Redis)  
**Architecture:** Monorepo (single GitHub repo, single `render.yaml`)

---

## 📁 Project Structure

```
realtime-communication-platform/
├── backend/                    # Django project
│   ├── manage.py
│   ├── commute/               # Django settings
│   │   ├── settings.py
│   │   ├── asgi.py
│   │   ├── wsgi.py
│   │   ├── urls.py
│   │   └── ...
│   ├── calls/                 # WebRTC calling app
│   ├── chat/                  # Chat + presence app
│   ├── users/                 # Custom user model
│   ├── requirements.txt
│   └── db.sqlite3             # (dev only, ignored in prod)
├── frontend/                  # Angular project
│   ├── src/
│   ├── package.json
│   ├── angular.json
│   └── ...
├── render.yaml                # Render infrastructure config (create this)
├── .gitignore                 # Updated for deployment
└── DEPLOYMENT.md              # This file
```

---

## 📋 Prerequisites

1. **GitHub account** — repo must be public or private with Render access
2. **Render account** — free at [render.com](https://render.com)
3. **Node.js 18+** and **Python 3.11+** (for local testing)
4. **Angular CLI** (`npm install -g @angular/cli`)

---

## 🛠️ Files to Create / Modify

### 1. `render.yaml` — Infrastructure as Code (REQUIRED)

Create at repo root:

```yaml
# render.yaml
services:
  # ─── Django Backend ───
  - type: web
    name: realtime-backend
    runtime: python
    plan: free
    region: oregon
    rootDir: backend
    buildCommand: pip install -r requirements.txt
    startCommand: |
      python manage.py migrate --no-input &&
      python manage.py collectstatic --no-input &&
      daphne -b 0.0.0.0 -p $PORT commute.asgi:application
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: realtime-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          type: redis
          name: realtime-redis
          property: connectionString
      - key: SECRET_KEY
        generateValue: true
      - key: DEBUG
        value: "false"
      - key: ALLOWED_HOSTS
        value: ".onrender.com"
      - key: CORS_ALLOWED_ORIGINS
        value: "https://realtime-frontend.onrender.com"
      - key: USE_REDIS_CHANNEL_LAYER
        value: "true"
    healthCheckPath: /health/

  # ─── Angular Frontend (Static Site) ───
  - type: web
    name: realtime-frontend
    runtime: static
    rootDir: frontend
    buildCommand: |
      chmod +x build-env.sh
      ./build-env.sh
      npm install
      npm run build
    staticPublishPath: dist/frontend/browser/browser
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
    envVars:
      - key: NODE_VERSION
        value: "20"
      - key: BACKEND_URL
        value: "https://realtime-backend.onrender.com"

  # ─── Redis (Free) ───
  - type: redis
    name: realtime-redis
    plan: free
    region: oregon
    ipAllowList: []

databases:
  # ─── PostgreSQL Database (Free) ───
  - name: realtime-db
    plan: free
    ipAllowList: []
```

> **Note:** Adjust `staticPublishPath` to match your Angular output directory. Run `npm run build` locally first to confirm (usually `dist/frontend/browser` or `dist/your-app-name`).

---

### 2. Update `backend/commute/settings.py`

**Replace the DATABASES block** (lines 128–133) with:

```python
# backend/commute/settings.py
import dj_database_url
import os

# ... existing imports ...

# ─── Database: PostgreSQL (production) / SQLite (dev) ───
DATABASES = {
    'default': dj_database_url.parse(
        os.environ.get('DATABASE_URL', f"sqlite:///{BASE_DIR / 'db.sqlite3'}")
    )
}

# ─── Static Files (WhiteNoise for production) ───
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Add WhiteNoise middleware (after SecurityMiddleware, before others)
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # ← ADD THIS
    'django.contrib.sessions.middleware.SessionMiddleware',
    # ... rest unchanged
]

# Optional: compress static files
STORAGES = {
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    }
}
```

**Add `dj-database-url` and `whitenoise` to `requirements.txt`:**

```text
# backend/requirements.txt
Django>=5.2,<5.3
asgiref>=3.12
sqlparse>=0.6.0
tzdata>=2026.5
djangorestframework>=3.18.0
django-cors-headers>=4.9.0
djangorestframework-simplejwt>=5.5.0
daphne>=4.2.3
channels>=4.3.2
channels-redis>=4.2.0
redis>=5.0.0
dj-database-url>=2.2.0     # ← ADD
whitenoise>=6.7.0           # ← ADD
gunicorn>=22.0.0            # ← ADD (production WSGI server)
```

**Update CORS for production** (around line 210):

```python
# backend/commute/settings.py
# ... existing CORS_ALLOWED_ORIGINS ...

# In production, CORS_ALLOWED_ORIGINS comes from env var
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',')
    if origin.strip()
]

# Fallback for local dev
if not CORS_ALLOWED_ORIGINS and DEBUG:
    CORS_ALLOWED_ORIGINS = [
        'http://localhost:4200',
        'http://127.0.0.1:4200',
    ]

CORS_ALLOW_CREDENTIALS = True
```

---

### 3. Update `backend/commute/asgi.py` (for Daphne)

```python
# backend/commute/asgi.py
"""
ASGI config for commute project.
"""
import os
from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'commute.settings')

# Import websocket patterns from apps
from chat.routing import websocket_urlpatterns as chat_ws_patterns
from calls.routing import websocket_urlpatterns as calls_ws_patterns

application = ProtocolTypeRouter({
    'http': get_asgi_application(),
    'websocket': AuthMiddlewareStack(
        URLRouter(
            chat_ws_patterns + calls_ws_patterns
        )
    ),
})
```

---

### 4. Add Health Check Endpoint

```python
# backend/commute/views.py (add this)
from django.http import JsonResponse
from django.views import View

class HealthCheckView(View):
    def get(self, request):
        return JsonResponse({'status': 'healthy', 'service': 'realtime-backend'})
```

```python
# backend/commute/urls.py (add health path)
from django.urls import path, include
from .views import HealthCheckView

urlpatterns = [
    path('health/', HealthCheckView.as_view(), name='health'),
    path('api/', include('api_urls')),
    # ... existing paths
]
```

---

### 5. Update `.gitignore`

```gitignore
# Root .gitignore
# ─── Python ───
backend/.venv/
backend/__pycache__/
backend/*.pyc
backend/db.sqlite3
backend/staticfiles/
backend/media/

# ─── Node / Angular ───
frontend/node_modules/
frontend/dist/
frontend/.angular/

# ─── Environment ───
.env
.env.local
*.env

# ─── IDE / OS ───
.vscode/
.idea/
*.swp
.DS_Store

# ─── Render ───
.render/
```

---

### 6. Frontend Build Configuration

Ensure `frontend/angular.json` outputs to expected path:

```json
// frontend/angular.json (projects > your-app > architect > build > options)
{
  "outputPath": "dist/frontend/browser",
  "index": "src/index.html",
  "main": "src/main.ts",
  "polyfills": ["zone.js"],
  "tsConfig": "tsconfig.app.json",
  "assets": ["src/favicon.ico", "src/assets"],
  "styles": ["src/styles.scss"],
  "scripts": []
}
```

Run locally to verify:

```bash
cd frontend
npm run build -- --configuration=static
ls dist/frontend/browser/browser  # should contain index.html, assets/
```

---

## 🚀 Deployment Steps (Render)

### Step 1: Push to GitHub

```bash
cd realtime-communication-platform
git init
git add .
git commit -m "Initial commit: Django + Angular + WebRTC platform"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/realtime-communication-platform.git
git push -u origin main
```

### Step 2: Connect to Render

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **New > Blueprint** (or "New > Web Service" if not using Blueprint)
3. Select your GitHub repo
4. Render detects `render.yaml` and shows:
   - `realtime-backend` (Web Service)
   - `realtime-frontend` (Static Site)
   - `realtime-db` (PostgreSQL)
   - `realtime-redis` (Redis)
5. Click **Apply** — Render provisions everything

### Step 3: Wait for First Deploy (3–5 minutes)

- Backend builds: `pip install`, runs migrations, collects static
- Frontend builds: `npm install`, `npm run build`
- Database and Redis are created and connected via env vars

### Step 4: Verify

- Backend: `https://realtime-backend.onrender.com/health/` → `{"status":"healthy"}`
- Frontend: `https://realtime-frontend.onrender.com/` → Angular app loads
- Test WebSocket: Open browser console, check `/ws/chat/` and `/ws/calls/` connections

---

## 🔄 Subsequent Deployments (Version 2, 3, ...)

**Just push to main:**

```bash
git add .
git commit -m "feat: add new feature"
git push origin main
```

Render automatically:

1. Detects push to `main`
2. Re-runs `buildCommand` for each service
3. Restarts backend with new code
4. Rebuilds frontend static files
5. Runs `migrate` if Django migrations exist
6. Deploys new version live

**No manual steps required.** Database data persists; Redis clears on free tier (acceptable for most cases).

---

## 🌐 Alternative: Split Hosting (Render + Netlify)

### Backend on Render

Same as above, but only deploy `backend/` as Web Service + PostgreSQL + Redis.

### Frontend on Netlify

```bash
# Option A: Drag & Drop (quick test)
cd frontend
npm run build
# Drag `dist/frontend/browser` folder to Netlify dashboard

# Option B: Git Integration (auto-deploy)
# 1. Connect GitHub repo to Netlify
# 2. Build command: npm install && npm run build
# 3. Publish directory: dist/frontend/browser
# 4. Add redirect rule: /* /index.html 200
```

### CORS Update

In Render backend env vars, set:

```
CORS_ALLOWED_ORIGINS=https://your-app.netlify.app
```

---

## ⚙️ Environment Variables Reference

| Variable                  | Service  | Required | Source                           |
| ------------------------- | -------- | -------- | -------------------------------- |
| `DATABASE_URL`            | Backend  | ✅       | Render PostgreSQL (auto)         |
| `REDIS_URL`               | Backend  | ✅       | Render Redis (auto)              |
| `SECRET_KEY`              | Backend  | ✅       | Render auto-generates            |
| `ALLOWED_HOSTS`           | Backend  | ✅       | `.onrender.com` or custom domain |
| `CORS_ALLOWED_ORIGINS`    | Backend  | ✅       | Frontend URL(s)                  |
| `USE_REDIS_CHANNEL_LAYER` | Backend  | ✅       | `"true"`                         |
| `NODE_VERSION`            | Frontend | Optional | `"20"`                           |

---

## 🐛 Troubleshooting

### "Module not found: whitenoise"

```bash
pip install whitenoise
# Add to requirements.txt
```

### "Database connection failed"

- Check `DATABASE_URL` is set in Render dashboard
- Ensure PostgreSQL service is "Available" (green)

### "WebSocket connection failed"

- Verify `REDIS_URL` is set and Redis service is running
- Check `CHANNEL_LAYERS` uses `channels_redis.core.RedisChannelLayer`

### "CORS error in browser"

- Verify `CORS_ALLOWED_ORIGINS` includes your frontend URL exactly
- Check for trailing slashes: `https://app.onrender.com` not `https://app.onrender.com/`

### "Static files not loading"

- Ensure `collectstatic` ran (check Render build logs)
- Verify `STATIC_ROOT` and `whitenoise` middleware order

### "Angular routes return 404 on refresh"

- Add rewrite rule in `render.yaml` (already included above)
- Or Netlify: `/* /index.html 200` redirect

---

## 📊 Free Tier Limits (Render)

| Resource       | Limit                                       |
| -------------- | ------------------------------------------- |
| Web Service    | 750 hrs/mo (sleeps after 15 min inactivity) |
| Static Site    | Unlimited bandwidth, 100 GB/mo              |
| PostgreSQL     | 90 days (then auto-deleted if inactive)     |
| Redis          | 25 MB, shared instance                      |
| Custom Domains | Free                                        |

> **Tip:** Use a custom domain to avoid cold starts affecting UX. Free tier sleeps after 15 min of no traffic.

---

## 🔐 Production Checklist

Before going live:

- [ ] `DEBUG = False` in production (auto via env var)
- [ ] `SECRET_KEY` from env (auto-generated by Render)
- [ ] `ALLOWED_HOSTS` restricted to your domain(s)
- [ ] HTTPS enforced (Render provides free SSL)
- [ ] Database backups enabled (Render: manual or paid plan)
- [ ] Monitoring/logging configured (Render logs in dashboard)
- [ ] Rate limiting / abuse protection considered

---

## 📞 Support

- **Render Docs**: https://render.com/docs
- **Django Channels**: https://channels.readthedocs.io
- **Angular Deployment**: https://angular.io/guide/deployment

---

_Generated for Real-Time Communication Platform v1.0_
