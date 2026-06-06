window.API_BASE = '/api';

function getToken() {
    return localStorage.getItem('ipo_token');
}

function getSession() {
    try {
        return JSON.parse(localStorage.getItem('ipo_session') || 'null');
    } catch {
        return null;
    }
}

function saveSession(data) {
    localStorage.setItem('ipo_token', data.token);
    localStorage.setItem('ipo_session', JSON.stringify({
        user: data.user,
        organization: data.organization,
        role: data.role,
        organizations: data.organizations || [],
    }));
}

function clearSession() {
    localStorage.removeItem('ipo_token');
    localStorage.removeItem('ipo_session');
}

function logout() {
    clearSession();
    window.location.href = '/login.html';
}

async function apiFetch(url, options = {}) {
    const token = getToken();
    const opts = { ...options };
    opts.headers = { ...(opts.headers || {}) };

    if (token) {
        opts.headers['Authorization'] = `Bearer ${token}`;
    }

    const isFormData = opts.body instanceof FormData;
    if (opts.body && typeof opts.body === 'object' && !isFormData) {
        opts.headers['Content-Type'] = opts.headers['Content-Type'] || 'application/json';
        opts.body = JSON.stringify(opts.body);
    }

    const fullUrl = url.startsWith('http') ? url : url;
    const res = await fetch(fullUrl, opts);

    if (res.status === 401 && !window.location.pathname.includes('login')) {
        clearSession();
        window.location.href = '/login.html';
    }
    return res;
}

function requireAuth() {
    if (!getToken()) {
        window.location.href = '/login.html';
        return false;
    }
    return true;
}

function updateUserProfileUI() {
    const session = getSession();
    const nameEl = document.getElementById('user-display-name');
    const orgEl = document.getElementById('org-display-name');
    const avatarEl = document.getElementById('user-avatar');
    if (!session) return;
    if (nameEl) nameEl.textContent = session.user?.full_name || 'User';
    if (orgEl) orgEl.textContent = session.organization?.name || 'Workspace';
    if (avatarEl) {
        const letter = (session.user?.full_name || 'U')[0].toUpperCase();
        avatarEl.textContent = letter;
    }
}
