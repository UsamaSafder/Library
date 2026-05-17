const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const togglePassword = document.getElementById('togglePassword');
const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const errorBox = document.getElementById('errorBox');
const loginBtn = document.querySelector('.login-btn');
const toastContainer = document.getElementById('toastContainer');
const spinner = document.getElementById('spinner');

// ==================== HAMBURGER MENU ====================
hamburger.addEventListener('click', function () {
    hamburger.classList.toggle('active');
    navLinks.classList.toggle('active');
});

// Close menu when a link is clicked
navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', function () {
        hamburger.classList.remove('active');
        navLinks.classList.remove('active');
    });
});

// Close menu when clicking outside
document.addEventListener('click', function (event) {
    const isClickInsideNav = hamburger.contains(event.target) || navLinks.contains(event.target);
    if (!isClickInsideNav && navLinks.classList.contains('active')) {
        hamburger.classList.remove('active');
        navLinks.classList.remove('active');
    }
});

// ==================== PASSWORD TOGGLE ====================
togglePassword.addEventListener('click', function () {
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        togglePassword.textContent = '🙈';
    } else {
        passwordInput.type = 'password';
        togglePassword.textContent = '👁️';
    }
});

// ==================== EMAIL VALIDATION ====================
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// ==================== INPUT VALIDATION ====================
emailInput.addEventListener('blur', function () {
    if (this.value.trim() === '') {
        emailError.textContent = 'Email is required';
        emailError.classList.add('show');
    } else if (!isValidEmail(this.value)) {
        emailError.textContent = 'Please enter a valid email address';
        emailError.classList.add('show');
    } else {
        emailError.textContent = '';
        emailError.classList.remove('show');
    }
});

passwordInput.addEventListener('blur', function () {
    if (this.value === '') {
        passwordError.textContent = 'Password is required';
        passwordError.classList.add('show');
    } else if (this.value.length < 6) {
        passwordError.textContent = 'Password must be at least 6 characters';
        passwordError.classList.add('show');
    } else {
        passwordError.textContent = '';
        passwordError.classList.remove('show');
    }
});

// Clear errors when user starts typing
emailInput.addEventListener('input', function () {
    if (emailError.classList.contains('show')) {
        emailError.textContent = '';
        emailError.classList.remove('show');
    }
});

passwordInput.addEventListener('input', function () {
    if (passwordError.classList.contains('show')) {
        passwordError.textContent = '';
        passwordError.classList.remove('show');
    }
});

// ==================== TOAST NOTIFICATION ====================
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => {
            toast.remove();
        }, 400);
    }, 3000);
}

// ==================== FORM SUBMISSION ====================
loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Clear previous errors
    emailError.textContent = '';
    emailError.classList.remove('show');
    passwordError.textContent = '';
    passwordError.classList.remove('show');
    errorBox.textContent = '';
    errorBox.classList.remove('show');

    // Validate inputs
    let isValid = true;

    if (email === '') {
        emailError.textContent = 'Email is required';
        emailError.classList.add('show');
        isValid = false;
    } else if (!isValidEmail(email)) {
        emailError.textContent = 'Please enter a valid email address';
        emailError.classList.add('show');
        isValid = false;
    }

    if (password === '') {
        passwordError.textContent = 'Password is required';
        passwordError.classList.add('show');
        isValid = false;
    } else if (password.length < 6) {
        passwordError.textContent = 'Password must be at least 6 characters';
        passwordError.classList.add('show');
        isValid = false;
    }

    if (!isValid) {
        return;
    }

    // Show loading state
    loginBtn.classList.add('loading');
    loginBtn.disabled = true;

    try {
        const normalizedEmail = normalizeEmail(email);
        const userDoc = await findUserDocByEmail(normalizedEmail);

        if (!userDoc) {
            throw new Error('No user found with this email address');
        }

        const userData = userDoc.data();

        if (!userData.passwordHash || !userData.passwordSalt) {
            throw new Error('This account must be re-registered because it was created before the new login system.');
        }

        const passwordHash = await hashPassword(password, userData.passwordSalt);
        if (passwordHash !== userData.passwordHash) {
            throw new Error('Incorrect password. Please try again');
        }

        const role = userData.role || 'member';
        await db.collection('users').doc(userDoc.id).set({
            lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
            displayName: userData.displayName || normalizedEmail,
            email: normalizedEmail,
            role
        }, { merge: true });

        saveSessionUser({
            uid: userDoc.id,
            email: normalizedEmail,
            displayName: userData.displayName || normalizedEmail,
            role
        });

        showToast('Login successful! Redirecting...', 'success');
        setTimeout(() => {
            if (role === 'admin') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'catalogue.html';
            }
        }, 1500);
    } catch (error) {
        let errorMessage = 'An error occurred during login';

        if (error.message) {
            errorMessage = error.message;
        }

        errorBox.textContent = errorMessage;
        errorBox.classList.add('show');
        showToast(errorMessage, 'error');
        console.error('Login error:', error);
    } finally {
        // Remove loading state
        loginBtn.classList.remove('loading');
        loginBtn.disabled = false;
    }
});

// ==================== SESSION RECOVERY ====================
// Check if user is already logged in on page load
const existingSessionUser = getSessionUser();
if (existingSessionUser) {
    if (existingSessionUser.role === 'admin') {
        window.location.href = 'admin.html';
    } else {
        window.location.href = 'catalogue.html';
    }
}
