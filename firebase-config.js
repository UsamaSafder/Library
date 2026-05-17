// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCHO14JGQ8VQixXb4SxCeppwellwbSjsCE",
    authDomain: "city-library-5b259.firebaseapp.com",
    projectId: "city-library-5b259",
    storageBucket: "city-library-5b259.appspot.com",
    messagingSenderId: "948777819509",
    appId: "1:948777819509:web:682cfc7e4782394e27473c",
    measurementId: "G-NMPJKG4QKG"
};


// Initialize Firebase only if not already initialized
if (typeof firebase === 'undefined') {
    console.error('Firebase SDK not loaded. Make sure firebase-app-compat.js is included before firebase-config.js.');
} else {
    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
    window.firebaseApp = app;
    window.firebase = firebase;
    window.auth = firebase.auth();
    window.db = firebase.firestore();

    const sessionStorageKey = 'cityLibrarySessionUser';

    window.normalizeEmail = function (email) {
        return (email || '').trim().toLowerCase();
    };

    window.generateUserId = function () {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }

        return `user-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    };

    window.generatePasswordSalt = function () {
        const saltBytes = new Uint8Array(16);
        window.crypto.getRandomValues(saltBytes);
        return Array.from(saltBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    };

    window.hashPassword = async function (password, salt) {
        const input = new TextEncoder().encode(`${salt}:${password}`);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', input);
        return Array.from(new Uint8Array(hashBuffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
    };

    window.saveSessionUser = function (user) {
        const sessionUser = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || '',
            role: user.role || 'member'
        };

        localStorage.setItem(sessionStorageKey, JSON.stringify(sessionUser));
        localStorage.setItem('userEmail', sessionUser.email || '');
        localStorage.setItem('userRole', sessionUser.role || 'member');
        localStorage.setItem('userDisplayName', sessionUser.displayName || '');
        localStorage.setItem('userId', sessionUser.uid || '');

        return sessionUser;
    };

    window.getSessionUser = function () {
        const sessionJson = localStorage.getItem(sessionStorageKey);

        if (sessionJson) {
            try {
                const parsedSession = JSON.parse(sessionJson);
                if (parsedSession && parsedSession.uid) {
                    return parsedSession;
                }
            } catch (error) {
                console.warn('Invalid session data in localStorage:', error);
            }
        }

        const legacyUserId = localStorage.getItem('userId');
        if (!legacyUserId) {
            return null;
        }

        return {
            uid: legacyUserId,
            email: localStorage.getItem('userEmail') || '',
            displayName: localStorage.getItem('userDisplayName') || '',
            role: localStorage.getItem('userRole') || 'member'
        };
    };

    window.findUserDocByEmail = async function (email) {
        const normalizedEmail = normalizeEmail(email);

        const lowerSnapshot = await db.collection('users')
            .where('emailLower', '==', normalizedEmail)
            .limit(1)
            .get();

        if (!lowerSnapshot.empty) {
            return lowerSnapshot.docs[0];
        }

        const emailSnapshot = await db.collection('users')
            .where('email', '==', normalizedEmail)
            .limit(1)
            .get();

        if (!emailSnapshot.empty) {
            return emailSnapshot.docs[0];
        }

        return null;
    };

    window.setAuthPersistence = async function () {
        if (window.auth && firebase.auth && firebase.auth.Auth && firebase.auth.Auth.Persistence) {
            await window.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        }
    };

    window.clearSessionData = function () {
        localStorage.removeItem(sessionStorageKey);
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userDisplayName');
        localStorage.removeItem('userId');
    };

    window.logoutAndRedirect = function () {
        clearSessionData();
        window.location.href = 'login.html';
    };

    console.log('Firebase initialized:', {
        appName: app.name,
        authLoaded: !!window.auth,
        firestoreLoaded: !!window.db
    });
}
