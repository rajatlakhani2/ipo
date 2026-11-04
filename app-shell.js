/* App shell: phone bottom tab bar, slide-out menu, back-button navigation, last-view memory. */
(function () {
    const TABS = [
        { view: 'home', icon: 'fa-house', label: 'Home' },
        { view: 'ipo-centre', icon: 'fa-bolt', label: 'IPOs' },
        { view: 'applications', icon: 'fa-clipboard-list', label: 'Apply' },
        { view: 'investor-master', icon: 'fa-users', label: 'Family' },
    ];
    const VIEW_TITLES = {};
    let current = null;

    function navItems() { return document.querySelectorAll('.sidebar nav li[data-view]'); }

    function setActive(view) {
        navItems().forEach(li => {
            const on = li.dataset.view === view;
            li.classList.toggle('active', on);
            if (on) li.setAttribute('aria-current', 'page'); else li.removeAttribute('aria-current');
        });
        document.querySelectorAll('.shell-tabbar [data-view]').forEach(b => {
            const on = b.dataset.view === view;
            b.classList.toggle('is-on', on);
            if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
        });
        const more = document.querySelector('.shell-tabbar [data-act="menu"]');
        if (more) more.classList.toggle('is-on', !TABS.some(t => t.view === view));
        const title = document.getElementById('shell-title');
        if (title) title.textContent = VIEW_TITLES[view] || '';
    }

    function openMenu(open) {
        document.body.classList.toggle('shell-menu-open', open);
        const btn = document.querySelector('.shell-tabbar [data-act="menu"]');
        if (btn) btn.setAttribute('aria-expanded', String(open));
        if (open) {
            const active = document.querySelector('.sidebar nav li.active') || document.querySelector('.sidebar nav li[data-view]');
            if (active) active.focus({ preventScroll: true });
        }
    }

    function buildTabbar() {
        const bar = document.createElement('nav');
        bar.className = 'shell-tabbar';
        bar.setAttribute('aria-label', 'Quick navigation');
        bar.innerHTML = TABS.map(t => `
            <button data-view="${t.view}"><i class="fas ${t.icon}" aria-hidden="true"></i><span>${t.label}</span></button>`).join('') + `
            <button data-act="menu" aria-expanded="false" aria-controls="sidebar"><i class="fas fa-bars" aria-hidden="true"></i><span>More</span></button>`;
        document.body.appendChild(bar);
        bar.addEventListener('click', e => {
            const b = e.target.closest('button');
            if (!b) return;
            if (b.dataset.act === 'menu') return openMenu(!document.body.classList.contains('shell-menu-open'));
            openMenu(false);
            window.loadView(b.dataset.view);
        });

        const scrim = document.createElement('div');
        scrim.className = 'shell-scrim';
        scrim.addEventListener('click', () => openMenu(false));
        document.body.appendChild(scrim);

        // Phone header: current screen title
        const top = document.querySelector('.top-bar');
        if (top && !document.getElementById('shell-title')) {
            const h = document.createElement('div');
            h.className = 'shell-brand';
            h.innerHTML = `<span class="shell-mark" aria-hidden="true"></span><span id="shell-title"></span>`;
            top.prepend(h);
        }
    }

    function wrapLoadView() {
        const inner = window.loadView;
        if (!inner || inner.__shell) return;
        const wrapped = function (view, opts) {
            opts = opts || {};
            current = view;
            setActive(view);
            openMenu(false);
            try { localStorage.setItem('shell_last_view', view); } catch (_) { /* private mode */ }
            if (!opts.fromHistory) {
                const url = '#' + view;
                if (location.hash !== url) history.pushState({ view }, '', url);
            }
            const area = document.getElementById('content-area');
            if (area) area.scrollTop = 0;
            window.scrollTo(0, 0);
            return inner(view);
        };
        wrapped.__shell = true;
        window.loadView = wrapped;
    }

    function viewFromHash() {
        const v = decodeURIComponent(location.hash.replace(/^#/, ''));
        return v && document.querySelector(`.sidebar nav li[data-view="${CSS.escape(v)}"]`) ? v : null;
    }

    document.addEventListener('DOMContentLoaded', () => {
        navItems().forEach(li => {
            VIEW_TITLES[li.dataset.view] = li.textContent.trim();
            li.setAttribute('tabindex', '0');
            li.setAttribute('role', 'link');
            li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); li.click(); } });
        });
        buildTabbar();
        // Wrap after the other scripts have installed their routes
        setTimeout(() => {
            wrapLoadView();
            const start = viewFromHash();
            if (start && start !== 'home') window.loadView(start, { fromHistory: true });
            else { setActive(current || 'home'); history.replaceState({ view: 'home' }, '', location.hash || '#home'); }
        }, 200);
    });

    window.addEventListener('popstate', e => {
        const v = (e.state && e.state.view) || viewFromHash() || 'home';
        if (document.body.classList.contains('shell-menu-open')) { openMenu(false); }
        window.loadView(v, { fromHistory: true });
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && document.body.classList.contains('shell-menu-open')) openMenu(false);
    });
})();
