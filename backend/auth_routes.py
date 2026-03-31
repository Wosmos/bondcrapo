"""
Authentication Routes for BondCheck PRO
Handles user registration, login, and profile management
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import timedelta
import json

from auth import (
    create_user, get_user_by_username, verify_password,
    create_access_token, create_refresh_token, verify_token,
    get_current_user, get_current_active_user, get_current_admin_user,
    update_last_login, log_activity, ACCESS_TOKEN_EXPIRE_MINUTES
)
from analytics import (
    get_user_stats, get_recent_activity, get_search_history,
    get_system_stats, get_user_preferences, update_user_preferences,
    export_user_data
)

router = APIRouter(prefix="/auth", tags=["authentication"])

# Pydantic models
class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: Optional[str]
    is_active: bool
    is_admin: bool
    created_at: str

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str

class UserPreferences(BaseModel):
    theme: Optional[str] = None
    default_denomination: Optional[int] = None
    results_per_page: Optional[int] = None
    email_notifications: Optional[bool] = None

# ==================== PUBLIC ENDPOINTS ====================

@router.post("/register", response_model=UserResponse)
async def register(user: UserRegister, request: Request):
    """Register a new user"""
    # Check if username or email already exists
    existing_user = get_user_by_username(user.username)
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Username already registered"
        )
    
    # Create user
    user_id = create_user(
        username=user.username,
        email=user.email,
        password=user.password,
        full_name=user.full_name
    )
    
    if not user_id:
        raise HTTPException(
            status_code=400,
            detail="Could not create user. Email may already be registered."
        )
    
    # Log activity
    log_activity(
        user_id=user_id,
        activity_type="register",
        endpoint="/auth/register",
        method="POST",
        ip_address=request.client.host if request.client else None
    )
    
    # Get created user
    from auth import get_user_by_id
    new_user = get_user_by_id(user_id)
    
    return UserResponse(
        id=new_user['id'],
        username=new_user['username'],
        email=new_user['email'],
        full_name=new_user['full_name'],
        is_active=bool(new_user['is_active']),
        is_admin=bool(new_user['is_admin']),
        created_at=new_user['created_at']
    )

@router.post("/token", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), request: Request = None):
    """Login and get access token"""
    user = get_user_by_username(form_data.username)
    if not user or not verify_password(form_data.password, user['hashed_password']):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user['is_active']:
        raise HTTPException(status_code=400, detail="Inactive user")
    
    # Create tokens
    access_token = create_access_token(
        data={"sub": user['username']},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    refresh_token = create_refresh_token(user['id'])
    
    # Update last login
    update_last_login(user['id'])
    
    # Log activity
    log_activity(
        user_id=user['id'],
        activity_type="login",
        endpoint="/auth/token",
        method="POST",
        ip_address=request.client.host if request and request.client else None
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

@router.post("/refresh", response_model=Token)
async def refresh_token(refresh_token: str):
    """Refresh access token using refresh token"""
    payload = verify_token(refresh_token, "refresh")
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    user_id = int(payload.get("sub"))
    from auth import get_user_by_id
    user = get_user_by_id(user_id)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Create new tokens
    access_token = create_access_token(data={"sub": user['username']})
    new_refresh_token = create_refresh_token(user_id)
    
    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }

# ==================== PROTECTED ENDPOINTS ====================

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_active_user)):
    """Get current user information"""
    return UserResponse(
        id=current_user['id'],
        username=current_user['username'],
        email=current_user['email'],
        full_name=current_user['full_name'],
        is_active=bool(current_user['is_active']),
        is_admin=bool(current_user['is_admin']),
        created_at=current_user['created_at']
    )

@router.get("/me/stats")
async def get_my_stats(current_user: dict = Depends(get_current_active_user)):
    """Get current user's statistics"""
    return get_user_stats(current_user['id'])

@router.get("/me/activity")
async def get_my_activity(
    limit: int = 20,
    current_user: dict = Depends(get_current_active_user)
):
    """Get current user's recent activity"""
    return get_recent_activity(current_user['id'], limit)

@router.get("/me/searches")
async def get_my_searches(
    limit: int = 50,
    current_user: dict = Depends(get_current_active_user)
):
    """Get current user's search history"""
    return get_search_history(current_user['id'], limit)

@router.get("/me/preferences")
async def get_my_preferences(current_user: dict = Depends(get_current_active_user)):
    """Get current user's preferences"""
    prefs = get_user_preferences(current_user['id'])
    return prefs if prefs else {}

@router.put("/me/preferences")
async def update_my_preferences(
    preferences: UserPreferences,
    current_user: dict = Depends(get_current_active_user)
):
    """Update current user's preferences"""
    # Filter out None values
    prefs_dict = {k: v for k, v in preferences.dict().items() if v is not None}
    
    if not prefs_dict:
        raise HTTPException(status_code=400, detail="No preferences provided")
    
    success = update_user_preferences(current_user['id'], **prefs_dict)
    
    if not success:
        raise HTTPException(status_code=400, detail="Could not update preferences")
    
    return {"message": "Preferences updated successfully"}

@router.get("/me/export")
async def export_my_data(current_user: dict = Depends(get_current_active_user)):
    """Export all user data (GDPR compliance)"""
    return export_user_data(current_user['id'])

# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/stats")
async def get_admin_stats(current_user: dict = Depends(get_current_admin_user)):
    """Get system-wide statistics (admin only)"""
    return get_system_stats()

@router.get("/admin/users")
async def list_users(
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_admin_user)
):
    """List all users (admin only)"""
    from auth import get_db_connection
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT id, username, email, full_name, is_active, is_admin, created_at, last_login
        FROM users
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    ''', (limit, offset))
    
    users = [dict(row) for row in cursor.fetchall()]
    
    cursor.execute('SELECT COUNT(*) as total FROM users')
    total = cursor.fetchone()['total']
    
    conn.close()
    
    return {
        'users': users,
        'total': total,
        'limit': limit,
        'offset': offset
    }

@router.get("/admin/users/{user_id}/stats")
async def get_user_stats_admin(
    user_id: int,
    current_user: dict = Depends(get_current_admin_user)
):
    """Get stats for a specific user (admin only)"""
    return get_user_stats(user_id)
