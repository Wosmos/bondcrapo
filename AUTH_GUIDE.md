# 🔐 Authentication & User Tracking System

## Overview

BondCheck PRO now includes a comprehensive authentication and user tracking system with:

✅ **JWT-based authentication** (access + refresh tokens)  
✅ **User registration and login**  
✅ **Password hashing** (bcrypt)  
✅ **Activity tracking** (all API requests)  
✅ **Search history** (what users search for)  
✅ **User analytics** (insights and stats)  
✅ **Admin dashboard** (system-wide metrics)  
✅ **GDPR compliance** (data export)

---

## 🏗️ Architecture

### New Files Created:

- `backend/auth.py` - Authentication logic, JWT, password hashing
- `backend/auth_routes.py` - API endpoints for auth
- `backend/analytics.py` - User tracking and analytics
- `backend/middleware.py` - Automatic request tracking

### Database Tables:

1. **users** - User accounts
2. **user_activity** - All API requests
3. **search_history** - Search queries and filters
4. **user_preferences** - User settings
5. **refresh_tokens** - JWT refresh tokens

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd backend
python -m pip install -r requirements.txt
```

New dependencies:

- `passlib[bcrypt]` - Password hashing
- `python-jose[cryptography]` - JWT tokens

### 2. Initialize Database

The auth tables are created automatically when you import the auth module.

### 3. Create Admin User

Run this Python script to create your first admin user:

```python
from auth import create_user

# Create admin
admin_id = create_user(
    username="admin",
    email="admin@bondcheck.com",
    password="your-secure-password",
    full_name="Admin User",
    is_admin=True
)

print(f"Admin created with ID: {admin_id}")
```

Or use the API (after starting the server):

```bash
curl -X POST "http://localhost:8000/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@bondcheck.com",
    "password": "SecurePass123!",
    "full_name": "Admin User"
  }'
```

---

## 📡 API Endpoints

### Public Endpoints (No Auth Required)

#### Register

```http
POST /auth/register
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "full_name": "John Doe"
}
```

**Response:**

```json
{
  "id": 1,
  "username": "john_doe",
  "email": "john@example.com",
  "full_name": "John Doe",
  "is_active": true,
  "is_admin": false,
  "created_at": "2026-02-02T20:00:00"
}
```

#### Login

```http
POST /auth/token
Content-Type: application/x-www-form-urlencoded

username=john_doe&password=SecurePass123!
```

**Response:**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

#### Refresh Token

```http
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "your-refresh-token"
}
```

---

### Protected Endpoints (Auth Required)

Add the access token to your requests:

```http
Authorization: Bearer your-access-token
```

#### Get Current User

```http
GET /auth/me
```

#### Get User Stats

```http
GET /auth/me/stats
```

**Response:**

```json
{
  "total_searches": 45,
  "searches_by_type": [
    {"search_type": "single", "count": 30},
    {"search_type": "multi", "count": 15}
  ],
  "top_denominations": [
    {"denomination": 200, "count": 20},
    {"denomination": 750, "count": 15}
  ],
  "activity_timeline": [...],
  "top_bonds": [...]
}
```

#### Get Search History

```http
GET /auth/me/searches?limit=50
```

#### Get Recent Activity

```http
GET /auth/me/activity?limit=20
```

#### Get/Update Preferences

```http
GET /auth/me/preferences

PUT /auth/me/preferences
Content-Type: application/json

{
  "theme": "onyx",
  "default_denomination": 200,
  "results_per_page": 100,
  "email_notifications": false
}
```

#### Export User Data (GDPR)

```http
GET /auth/me/export
```

---

### Admin Endpoints (Admin Only)

#### System Stats

```http
GET /auth/admin/stats
```

**Response:**

```json
{
  "total_users": 150,
  "active_users": 45,
  "total_searches": 5420,
  "searches_today": 123,
  "popular_denominations": [...],
  "user_growth": [...],
  "search_trends": [...],
  "top_users": [...]
}
```

#### List All Users

```http
GET /auth/admin/users?limit=50&offset=0
```

#### Get User Stats

```http
GET /auth/admin/users/{user_id}/stats
```

---

## 🔍 Tracking Features

### Automatic Tracking

The middleware automatically tracks:

- ✅ All API requests
- ✅ User IP addresses
- ✅ User agents (browser info)
- ✅ Request timestamps
- ✅ Endpoints accessed
- ✅ HTTP methods

### Search Tracking

Every search is logged with:

- Search type (single/multi/series)
- Bond numbers searched
- Denomination filter
- Other filters applied
- Results count
- Timestamp

### Analytics Available

**Per User:**

- Total searches
- Searches by type
- Most searched denominations
- Most searched bond numbers
- Activity timeline (30 days)
- Recent activity log

**System-Wide (Admin):**

- Total/active users
- User growth trends
- Search volume trends
- Popular denominations
- Most active users
- Endpoint usage stats

---

## 🎨 Frontend Integration

### Login Form Example

```html
<form id="loginForm">
  <input type="text" name="username" placeholder="Username" required />
  <input type="password" name="password" placeholder="Password" required />
  <button type="submit">Login</button>
</form>

<script>
  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const response = await fetch("/auth/token", {
      method: "POST",
      body: new URLSearchParams(formData),
    });

    const data = await response.json();

    // Store tokens
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);

    // Redirect to dashboard
    window.location.href = "/";
  });
</script>
```

### Making Authenticated Requests

```javascript
// Add token to all API requests
const token = localStorage.getItem("access_token");

fetch("/api/search?number=123456", {
  headers: {
    Authorization: `Bearer ${token}`,
  },
})
  .then((res) => res.json())
  .then((data) => console.log(data));
```

### Auto-Refresh Token

```javascript
async function refreshToken() {
  const refreshToken = localStorage.getItem("refresh_token");

  const response = await fetch("/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  const data = await response.json();
  localStorage.setItem("access_token", data.access_token);
  localStorage.setItem("refresh_token", data.refresh_token);
}
```

---

## 🔒 Security Features

### Password Security

- ✅ Bcrypt hashing (industry standard)
- ✅ Automatic salt generation
- ✅ Never stored in plain text

### Token Security

- ✅ JWT with HS256 algorithm
- ✅ Short-lived access tokens (30 min)
- ✅ Long-lived refresh tokens (7 days)
- ✅ Token rotation on refresh
- ✅ Revocable refresh tokens

### Best Practices

- ✅ HTTPS required in production
- ✅ Tokens stored in HTTP-only cookies (recommended)
- ✅ CORS configuration
- ✅ Rate limiting (add middleware)
- ✅ Input validation (Pydantic)

---

## 📊 Database Schema

### users

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    full_name TEXT,
    is_active BOOLEAN DEFAULT 1,
    is_admin BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);
```

### user_activity

```sql
CREATE TABLE user_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    activity_type TEXT NOT NULL,
    endpoint TEXT,
    method TEXT,
    ip_address TEXT,
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### search_history

```sql
CREATE TABLE search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    search_type TEXT NOT NULL,
    bond_numbers TEXT,
    denomination INTEGER,
    filters TEXT,
    results_count INTEGER,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 🎯 Use Cases

### 1. Track Popular Bonds

See which bond numbers users search for most:

```sql
SELECT bond_numbers, COUNT(*) as searches
FROM search_history
WHERE bond_numbers IS NOT NULL
GROUP BY bond_numbers
ORDER BY searches DESC
LIMIT 10;
```

### 2. Identify Power Users

Find most active users:

```sql
SELECT u.username, COUNT(sh.id) as total_searches
FROM users u
JOIN search_history sh ON u.id = sh.user_id
GROUP BY u.id
ORDER BY total_searches DESC
LIMIT 10;
```

### 3. Track Feature Usage

See which endpoints are most used:

```sql
SELECT endpoint, COUNT(*) as hits
FROM user_activity
WHERE endpoint LIKE '/api/%'
GROUP BY endpoint
ORDER BY hits DESC;
```

### 4. Monitor Growth

Track user signups over time:

```sql
SELECT DATE(created_at) as date, COUNT(*) as new_users
FROM users
WHERE created_at >= datetime('now', '-30 days')
GROUP BY DATE(created_at)
ORDER BY date;
```

---

## 🚀 Next Steps

### Recommended Enhancements:

1. **Email Verification** - Verify email on signup
2. **Password Reset** - Forgot password flow
3. **2FA** - Two-factor authentication
4. **Rate Limiting** - Prevent abuse
5. **Session Management** - Active sessions list
6. **Audit Log** - Detailed admin actions log
7. **Notifications** - Email alerts for wins
8. **Social Auth** - Google/Facebook login

### Production Checklist:

- [ ] Change SECRET_KEY to random value
- [ ] Enable HTTPS only
- [ ] Set up CORS properly
- [ ] Add rate limiting
- [ ] Configure email service
- [ ] Set up monitoring
- [ ] Add backup system
- [ ] Implement logging
- [ ] Add error tracking (Sentry)
- [ ] Performance monitoring

---

## 📝 Example: Complete Auth Flow

```python
# 1. Register
POST /auth/register
{
  "username": "john",
  "email": "john@example.com",
  "password": "SecurePass123!"
}

# 2. Login
POST /auth/token
username=john&password=SecurePass123!

# Response: {access_token, refresh_token}

# 3. Use API (with token)
GET /api/search?number=123456
Authorization: Bearer {access_token}

# 4. Check stats
GET /auth/me/stats
Authorization: Bearer {access_token}

# 5. Refresh when expired
POST /auth/refresh
{refresh_token}

# 6. Export data (GDPR)
GET /auth/me/export
Authorization: Bearer {access_token}
```

---

**Built with security and privacy in mind! 🔒**
