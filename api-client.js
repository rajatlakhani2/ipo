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

// ---------------------------------------------------------------------------
// ALL CAPS: text typed into forms is converted to capital letters by default.
// Skipped: email, password, number, date, file fields; UPI, search, advisor
// chat, links, tokens/keys; and any field marked data-no-caps.
// ---------------------------------------------------------------------------
(function () {
    const SKIP_TYPES = new Set(['email', 'password', 'number', 'date', 'datetime-local', 'time',
        'month', 'week', 'file', 'url', 'color', 'range', 'checkbox', 'radio', 'hidden',
        'submit', 'button', 'reset', 'image']);
    const SKIP_ID = /email|mail|pass|upi|url|link|token|key|secret|search|advisor|otp|code/i;

    function wantsCaps(el) {
        if (!el || el.readOnly || el.disabled) return false;
        if (el.tagName === 'TEXTAREA') return !(el.hasAttribute('data-no-caps') || SKIP_ID.test(el.id || el.name || ''));
        if (el.tagName !== 'INPUT') return false;
        if (SKIP_TYPES.has((el.type || 'text').toLowerCase())) return false;
        if (el.hasAttribute('data-no-caps') || el.closest('[data-no-caps]')) return false;
        return !SKIP_ID.test((el.id || '') + ' ' + (el.name || '') + ' ' + (el.placeholder || ''));
    }

    function upper(el) {
        const v = el.value, up = v.toUpperCase();
        if (v === up) return;
        const s = el.selectionStart, e = el.selectionEnd;
        el.value = up;
        try { el.setSelectionRange(s, e); } catch (_) { /* some inputs don't support selection */ }
    }

    // Convert while typing / pasting
    document.addEventListener('input', ev => { if (wantsCaps(ev.target)) upper(ev.target); }, true);
    // Show capitals while the field is being typed into (mobile keyboards too)
    document.addEventListener('focusin', ev => {
        if (!wantsCaps(ev.target)) return;
        ev.target.setAttribute('autocapitalize', 'characters');
        ev.target.style.textTransform = 'uppercase';
    }, true);
    // Before any form is saved, convert older lowercase values left in fields
    document.addEventListener('submit', ev => {
        ev.target.querySelectorAll('input, textarea').forEach(el => { if (wantsCaps(el)) upper(el); });
    }, true);
})();

// ---------- Auto CAPITALS for all text fields ----------
// Every text box types in capital letters, like a PAN card.
// Skipped: email, password, URL, UPI, search, AI-advisor question, and any
// field marked data-no-caps. Add data-no-caps to an input to opt it out.
(function () {
    const SKIP_TYPES = /^(email|password|url|number|date|datetime-local|month|time|week|file|checkbox|radio|hidden|color|range|search)$/i;
    const SKIP_NAMES = /(email|e-mail|mail|pass|pwd|upi|url|link|website|web|key|token|secret|otp|search|advisor)/i;

    function wantsCaps(el) {
        if (!el || el.readOnly || el.disabled) return false;
        if (el.tagName === 'TEXTAREA') {
            // textareas: same name rules
        } else if (el.tagName !== 'INPUT' || SKIP_TYPES.test(el.type || 'text')) {
            return false;
        }
        if (el.hasAttribute('data-no-caps') || el.closest('[data-no-caps]')) return false;
        const hint = [el.id, el.name, el.placeholder, el.getAttribute('autocomplete')].join(' ');
        return !SKIP_NAMES.test(hint);
    }

    function toCaps(el) {
        const v = el.value, up = v.toUpperCase();
        if (v === up) return;
        const s = el.selectionStart, e = el.selectionEnd;
        el.value = up;
        try { el.setSelectionRange(s, e); } catch (_) { /* some types don't support selection */ }
    }

    // Typing / pasting
    document.addEventListener('input', ev => { if (wantsCaps(ev.target)) toCaps(ev.target); }, true);

    // Fields opened with existing (lowercase) values: show them in capitals too
    function styleField(el) {
        if (el.dataset.capsDone) return;
        el.dataset.capsDone = '1';
        if (wantsCaps(el)) {
            el.style.textTransform = 'uppercase';
            el.setAttribute('autocapitalize', 'characters');
            toCaps(el);
        }
    }
    function scan(root) {
        (root.querySelectorAll ? root : document).querySelectorAll('input, textarea').forEach(styleField);
        if (root.matches && root.matches('input, textarea')) styleField(root);
    }
    const start = () => {
        scan(document);
        new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n => n.nodeType === 1 && scan(n))))
            .observe(document.body, { childList: true, subtree: true });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
