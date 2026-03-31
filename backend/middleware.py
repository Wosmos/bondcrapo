"""
Tracking Middleware for BondCheck PRO
Automatically logs all API requests and user activity
"""

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import time
import json
from typing import Callable

from auth import get_current_user, log_activity, log_search

class ActivityTrackingMiddleware(BaseHTTPMiddleware):
    """Middleware to track all user activity"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Start timer
        start_time = time.time()
        
        # Get user if authenticated
        user_id = None
        try:
            # Try to get token from Authorization header
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
                from auth import verify_token, get_user_by_username
                payload = verify_token(token, "access")
                if payload:
                    username = payload.get("sub")
                    user = get_user_by_username(username)
                    if user:
                        user_id = user['id']
        except:
            pass  # Anonymous request
        
        # Process request
        response = await call_next(request)
        
        # Calculate duration
        duration = time.time() - start_time
        
        # Log activity (async in background)
        try:
            # Only log API endpoints, not static files
            if request.url.path.startswith("/api/"):
                log_activity(
                    user_id=user_id,
                    activity_type="api_request",
                    endpoint=request.url.path,
                    method=request.method,
                    ip_address=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent")
                )
                
                # Track searches specifically
                if "/api/search" in request.url.path or "/api/draws" in request.url.path:
                    # Extract search parameters
                    params = dict(request.query_params)
                    
                    search_type = "single"
                    bond_numbers = None
                    denomination = None
                    filters = None
                    
                    if "number" in params:
                        search_type = "single"
                        bond_numbers = params.get("number")
                    elif "bond_list" in params:
                        search_type = "multi"
                        bond_numbers = params.get("bond_list")
                    elif "start_bond" in params or "end_bond" in params:
                        search_type = "series"
                        bond_numbers = f"{params.get('start_bond', '')}-{params.get('end_bond', '')}"
                    
                    if "denomination" in params:
                        try:
                            denomination = int(params["denomination"])
                        except:
                            pass
                    
                    # Collect other filters
                    filter_keys = ['position', 'year', 'start_date', 'end_date', 'min_amount', 'max_amount']
                    active_filters = {k: params[k] for k in filter_keys if k in params}
                    if active_filters:
                        filters = json.dumps(active_filters)
                    
                    # Log search
                    log_search(
                        user_id=user_id,
                        search_type=search_type,
                        bond_numbers=bond_numbers,
                        denomination=denomination,
                        filters=filters,
                        results_count=0  # We don't have this info in middleware
                    )
        except Exception as e:
            # Don't let tracking errors break the app
            print(f"Tracking error: {e}")
        
        # Add tracking headers to response
        response.headers["X-Process-Time"] = str(duration)
        
        return response
