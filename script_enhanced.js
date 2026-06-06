// Enhanced IPO Dashboard with Dynamic Colors and Pre-filled Details
// Global state
let investors = [];
let ipos = [];
let applications = [];

// API Base URL
const API_BASE = 'http://127.0.0.1:5001/api';

// Enhanced Color Palette for Dynamic UI
const colorPalette = [
    { primary: '#667eea', secondary: '#764ba2', accent: '#4c63d2', light: '#e8ebff' },
    { primary: '#f093fb', secondary: '#f5576c', accent: '#e91e63', light: '#ffeef7' },
    { primary: '#4facfe', secondary: '#00f2fe', accent: '#2196f3', light: '#e3f2fd' },
    { primary: '#43e97b', secondary: '#38f9d7', accent: '#4caf50', light: '#e8f5e8' },
    { primary: '#fa709a', secondary: '#fee140', accent: '#ff9800', light: '#fff3e0' },
    { primary: '#a8edea', secondary: '#fed6e3', accent: '#9c27b0', light: '#f3e5f5' },
    { primary: '#ffecd2', secondary: '#fcb69f', accent: '#ff5722', light: '#fbe9e7' },
    { primary: '#667eea', secondary: '#764ba2', accent: '#3f51b5', light: '#e8eaf6' }
];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Loaded');
    setupNavigation();
    setupThemeToggle();
    setupSidebarToggle();

    // Load default view
    setTimeout(() => {
        console.log('Loading default view');
        loadView('dashboard');
    }, 100);
});

// Navigation Handling
function setupNavigation() {
    const navItems = document.querySelectorAll('.sidebar nav li');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            const view = item.dataset.view;
            loadView(view);
        });
    });
}

// Theme Toggle
function setupThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    themeToggle.addEventListener('click', ()