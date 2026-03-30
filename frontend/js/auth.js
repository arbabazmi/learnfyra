/**
 * @file frontend/js/auth.js
 * @description Shared authentication utility module for Learnfyra.
 * Handles token storage, API requests with auth headers, and login/register UI.
 */

// ---------------------------------------------------------------
// Core auth helpers — exported for use in any page module
// ---------------------------------------------------------------

export function getToken() {
  return localStorage.getItem('auth_token');
}

export function getUser() {
  return JSON.parse(localStorage.getItem('auth_user') || 'null');
}

export function setAuth(token, user) {
  localStorage.setItem('auth_token', token);
  localStorage.setItem('auth_user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
}

export function isAuthenticated() {
  return !!getToken();
}

/**
 * Authenticated fetch wrapper.
 * Injects Authorization header if a token exists.
 * Throws an augmented Error on non-ok responses.
 */
export async function apiRequest(url, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  const data = await res.json();
  if (!res.ok) {
    throw Object.assign(
      new Error(data.error || 'Request failed'),
      { status: res.status, data }
    );
  }
  return data;
}

/**
 * Redirect to login if the user is not authenticated.
 * Call this at the top of any protected page module.
 */
export function redirectIfNotAuth(redirectTo = '/login.html') {
  if (!isAuthenticated()) {
    window.location.href = redirectTo;
  }
}

// ---------------------------------------------------------------
// Determine where to send the user after a successful sign-in
// ---------------------------------------------------------------
function resolveRedirect(user) {
  if (!user) return '/';
  if (user.role === 'student') return '/student/dashboard.html';
  if (user.role === 'teacher' || user.role === 'parent') return '/teacher/dashboard.html';
  return '/';
}

// ---------------------------------------------------------------
// Login / Register UI — only runs when login.html elements exist
// ---------------------------------------------------------------
if (document.getElementById('signInForm')) {
  const signInForm       = document.getElementById('signInForm');
  const createAccountForm = document.getElementById('createAccountForm');
  const loginError       = document.getElementById('loginError');
  const registerError    = document.getElementById('registerError');
  const tabBtns          = document.querySelectorAll('.tab-btn');

  // --- Tab switching ---
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;

      tabBtns.forEach((b) => b.classList.toggle('tab-btn--active', b === btn));

      if (target === 'signin') {
        signInForm.hidden = false;
        createAccountForm.hidden = true;
      } else {
        signInForm.hidden = true;
        createAccountForm.hidden = false;
      }

      // Clear errors when switching tabs
      loginError.hidden = true;
      registerError.hidden = true;
    });
  });

  // --- Sign In ---
  signInForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.hidden = true;

    const email    = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    const btn = document.getElementById('signInBtn');
    btn.disabled = true;
    btn.textContent = 'Signing in…';

    try {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      setAuth(data.token, data.user);
      window.location.href = resolveRedirect(data.user);
    } catch (err) {
      loginError.textContent = err.data?.error || err.message || 'Sign in failed. Please try again.';
      loginError.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });

  // --- Create Account ---
  createAccountForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    registerError.hidden = true;

    const displayName = document.getElementById('regDisplayName').value.trim();
    const email       = document.getElementById('regEmail').value.trim();
    const password    = document.getElementById('regPassword').value;
    const role        = document.getElementById('regRole').value;

    if (password.length < 8) {
      registerError.textContent = 'Password must be at least 8 characters.';
      registerError.hidden = false;
      return;
    }

    const btn = document.getElementById('createAccountBtn');
    btn.disabled = true;
    btn.textContent = 'Creating account…';

    try {
      const data = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ displayName, email, password, role }),
      });

      setAuth(data.token, data.user);
      window.location.href = resolveRedirect(data.user);
    } catch (err) {
      registerError.textContent = err.data?.error || err.message || 'Registration failed. Please try again.';
      registerError.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  });
}
