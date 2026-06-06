import re
from datetime import datetime, timedelta
from functools import wraps

import jwt
from flask import request, jsonify, g, current_app

from config import Config


def _slugify(name):
    slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    return slug[:80] or 'workspace'


def create_token(user_id, organization_id, role, email):
    payload = {
        'sub': user_id,
        'org_id': organization_id,
        'role': role,
        'email': email,
        'exp': datetime.utcnow() + timedelta(hours=Config.JWT_EXPIRY_HOURS),
        'iat': datetime.utcnow(),
    }
    return jwt.encode(payload, Config.SECRET_KEY, algorithm='HS256')


def decode_token(token):
    return jwt.decode(token, Config.SECRET_KEY, algorithms=['HS256'])


def require_auth(roles=None):
    """JWT auth; sets g.user_id, g.organization_id, g.role."""

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            auth = request.headers.get('Authorization', '')
            if not auth.startswith('Bearer '):
                return jsonify({'error': 'Authentication required'}), 401
            try:
                payload = decode_token(auth[7:])
                g.user_id = payload['sub']
                g.organization_id = payload['org_id']
                g.role = payload.get('role', 'member')
                g.user_email = payload.get('email')
            except jwt.ExpiredSignatureError:
                return jsonify({'error': 'Token expired'}), 401
            except jwt.InvalidTokenError:
                return jsonify({'error': 'Invalid token'}), 401

            if roles and g.role not in roles:
                return jsonify({'error': 'Insufficient permissions'}), 403

            if current_app.config.get('REQUIRE_EMAIL_VERIFICATION'):
                from models import User
                user = User.query.get(g.user_id)
                if user and not user.email_verified:
                    return jsonify({
                        'error': 'Email not verified',
                        'code': 'email_not_verified',
                    }), 403

            return fn(*args, **kwargs)

        return wrapper

    return decorator


def can_write():
    return g.role in ('owner', 'admin', 'member')


def require_write(fn):
    @wraps(fn)
    @require_auth()
    def wrapper(*args, **kwargs):
        if not can_write():
            return jsonify({'error': 'Read-only access'}), 403
        return fn(*args, **kwargs)

    return wrapper
