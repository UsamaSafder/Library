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
    console.log('Firebase initialized:', {
        appName: app.name,
        authLoaded: !!window.auth,
        firestoreLoaded: !!window.db
    });
}
