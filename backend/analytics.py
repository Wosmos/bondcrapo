"""
Analytics and Tracking Module
Provides insights into user behavior and system usage
"""

import sqlite3
from datetime import datetime, timedelta
from typing import Optional, List, Dict
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR.parent / "database" / "prize_bonds.db"

def get_db_connection():
    """Get database connection"""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

# User Analytics
def get_user_stats(user_id: int) -> Dict:
    """Get comprehensive stats for a user"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Total searches
    cursor.execute('''
        SELECT COUNT(*) as total_searches FROM search_history WHERE user_id = ?
    ''', (user_id,))
    total_searches = cursor.fetchone()['total_searches']
    
    # Searches by type
    cursor.execute('''
        SELECT search_type, COUNT(*) as count
        FROM search_history
        WHERE user_id = ?
        GROUP BY search_type
    ''', (user_id,))
    searches_by_type = [dict(row) for row in cursor.fetchall()]
    
    # Most searched denominations
    cursor.execute('''
        SELECT denomination, COUNT(*) as count
        FROM search_history
        WHERE user_id = ? AND denomination IS NOT NULL
        GROUP BY denomination
        ORDER BY count DESC
        LIMIT 5
    ''', (user_id,))
    top_denominations = [dict(row) for row in cursor.fetchall()]
    
    # Activity over time (last 30 days)
    cursor.execute('''
        SELECT DATE(timestamp) as date, COUNT(*) as count
        FROM user_activity
        WHERE user_id = ? AND timestamp >= datetime('now', '-30 days')
        GROUP BY DATE(timestamp)
        ORDER BY date DESC
    ''', (user_id,))
    activity_timeline = [dict(row) for row in cursor.fetchall()]
    
    # Most searched bond numbers
    cursor.execute('''
        SELECT bond_numbers, COUNT(*) as count
        FROM search_history
        WHERE user_id = ? AND bond_numbers IS NOT NULL
        GROUP BY bond_numbers
        ORDER BY count DESC
        LIMIT 10
    ''', (user_id,))
    top_bonds = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    
    return {
        'total_searches': total_searches,
        'searches_by_type': searches_by_type,
        'top_denominations': top_denominations,
        'activity_timeline': activity_timeline,
        'top_bonds': top_bonds
    }

def get_recent_activity(user_id: int, limit: int = 20) -> List[Dict]:
    """Get recent activity for a user"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT activity_type, endpoint, method, timestamp
        FROM user_activity
        WHERE user_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
    ''', (user_id, limit))
    
    activities = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return activities

def get_search_history(user_id: int, limit: int = 50) -> List[Dict]:
    """Get search history for a user"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT search_type, bond_numbers, denomination, results_count, timestamp
        FROM search_history
        WHERE user_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
    ''', (user_id, limit))
    
    searches = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return searches

# System-wide Analytics (Admin only)
def get_system_stats() -> Dict:
    """Get system-wide statistics"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Total users
    cursor.execute('SELECT COUNT(*) as total FROM users')
    total_users = cursor.fetchone()['total']
    
    # Active users (logged in last 7 days)
    cursor.execute('''
        SELECT COUNT(*) as active FROM users 
        WHERE last_login >= datetime('now', '-7 days')
    ''')
    active_users = cursor.fetchone()['active']
    
    # Total searches
    cursor.execute('SELECT COUNT(*) as total FROM search_history')
    total_searches = cursor.fetchone()['total']
    
    # Searches today
    cursor.execute('''
        SELECT COUNT(*) as today FROM search_history 
        WHERE DATE(timestamp) = DATE('now')
    ''')
    searches_today = cursor.fetchone()['today']
    
    # Most popular denominations (all users)
    cursor.execute('''
        SELECT denomination, COUNT(*) as count
        FROM search_history
        WHERE denomination IS NOT NULL
        GROUP BY denomination
        ORDER BY count DESC
    ''')
    popular_denominations = [dict(row) for row in cursor.fetchall()]
    
    # User growth (last 30 days)
    cursor.execute('''
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM users
        WHERE created_at >= datetime('now', '-30 days')
        GROUP BY DATE(created_at)
        ORDER BY date DESC
    ''')
    user_growth = [dict(row) for row in cursor.fetchall()]
    
    # Search trends (last 7 days)
    cursor.execute('''
        SELECT DATE(timestamp) as date, COUNT(*) as count
        FROM search_history
        WHERE timestamp >= datetime('now', '-7 days')
        GROUP BY DATE(timestamp)
        ORDER BY date DESC
    ''')
    search_trends = [dict(row) for row in cursor.fetchall()]
    
    # Most active users
    cursor.execute('''
        SELECT u.username, u.full_name, COUNT(sh.id) as search_count
        FROM users u
        LEFT JOIN search_history sh ON u.id = sh.user_id
        GROUP BY u.id
        ORDER BY search_count DESC
        LIMIT 10
    ''')
    top_users = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    
    return {
        'total_users': total_users,
        'active_users': active_users,
        'total_searches': total_searches,
        'searches_today': searches_today,
        'popular_denominations': popular_denominations,
        'user_growth': user_growth,
        'search_trends': search_trends,
        'top_users': top_users
    }

def get_endpoint_stats() -> List[Dict]:
    """Get statistics by endpoint"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT endpoint, method, COUNT(*) as count
        FROM user_activity
        WHERE endpoint IS NOT NULL
        GROUP BY endpoint, method
        ORDER BY count DESC
        LIMIT 20
    ''')
    
    stats = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return stats

def get_user_preferences(user_id: int) -> Dict:
    """Get user preferences"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT * FROM user_preferences WHERE user_id = ?
    ''', (user_id,))
    
    prefs = cursor.fetchone()
    conn.close()
    return dict(prefs) if prefs else None

def update_user_preferences(user_id: int, **kwargs) -> bool:
    """Update user preferences"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Build update query dynamically
    allowed_fields = ['theme', 'default_denomination', 'results_per_page', 'email_notifications']
    updates = []
    values = []
    
    for key, value in kwargs.items():
        if key in allowed_fields:
            updates.append(f"{key} = ?")
            values.append(value)
    
    if not updates:
        conn.close()
        return False
    
    values.append(user_id)
    query = f"UPDATE user_preferences SET {', '.join(updates)} WHERE user_id = ?"
    
    cursor.execute(query, values)
    conn.commit()
    conn.close()
    return True

# Export functions
def export_user_data(user_id: int) -> Dict:
    """Export all user data (GDPR compliance)"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # User info
    cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
    user = dict(cursor.fetchone())
    
    # Preferences
    cursor.execute('SELECT * FROM user_preferences WHERE user_id = ?', (user_id,))
    prefs = cursor.fetchone()
    preferences = dict(prefs) if prefs else {}
    
    # Activity
    cursor.execute('''
        SELECT * FROM user_activity WHERE user_id = ? ORDER BY timestamp DESC
    ''', (user_id,))
    activity = [dict(row) for row in cursor.fetchall()]
    
    # Search history
    cursor.execute('''
        SELECT * FROM search_history WHERE user_id = ? ORDER BY timestamp DESC
    ''', (user_id,))
    searches = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    
    # Remove sensitive data
    if 'hashed_password' in user:
        del user['hashed_password']
    
    return {
        'user': user,
        'preferences': preferences,
        'activity': activity,
        'search_history': searches,
        'exported_at': datetime.now().isoformat()
    }
