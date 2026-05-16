# Admin Dashboard Credentials & Setup Guide

## Test Admin Account

### Credentials to Use:
```
Email:    admin@citylibrary.com
Password: Admin@123456
```

## How to Set Up Admin Access

### Step 1: Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project or use existing one
3. Enable Email/Password Authentication

### Step 2: Create Admin User in Firebase Authentication
1. In Firebase Console → Authentication → Users tab
2. Click "Add User"
3. Enter:
   - Email: `admin@citylibrary.com`
   - Password: `Admin@123456`
4. Click "Add User"

### Step 3: Update Firebase Config
Edit `firebase-config.js` with your Firebase project credentials:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

### Step 4: Create Admin Document in Firestore
1. In Firebase Console → Firestore Database
2. Create collection: `users`
3. Create document with ID: (copy the UID from the Authentication user you created)
4. Add fields:
   ```
   email: admin@citylibrary.com (string)
   role: admin (string)
   displayName: Admin User (string)
   ```

### Step 5: Access Admin Dashboard
1. Go to `login.html`
2. Sign in with:
   - Email: `admin@citylibrary.com`
   - Password: `Admin@123456`
3. After login, navigate to `admin.html`
4. Dashboard will load if you have admin role

## Admin Dashboard Features Available

✅ Welcome banner with dynamic greeting  
✅ 4 stat cards (Books, Members, Active Borrowings, Returned Today)  
✅ Borrowing activity chart (last 7 days)  
✅ Books by genre chart  
✅ Recent borrowings table  
✅ Top performing books  
✅ Quick actions (Add Book, Member, Report)  
✅ Overdue alerts  
✅ Recent members  
✅ Inventory status  
✅ Notifications  
✅ Mobile responsive sidebar  

## Testing Without Firebase (Current Demo Mode)

The admin dashboard currently has a fallback mode for testing:
- If Firebase isn't properly configured, it will still allow dashboard access
- Open `admin.html` directly to see the demo dashboard
- All charts, tables, and features will display with sample data

## Firestore Collections Needed

Create these collections for full functionality:

```
/books
  - title (string)
  - author (string)
  - genre (string)
  - available (number)
  - total (number)

/users
  - email (string)
  - role (string: "admin" or "member")
  - displayName (string)
  - joinedDate (timestamp)

/borrowings
  - memberId (string)
  - bookId (string)
  - borrowedDate (timestamp)
  - dueDate (timestamp)
  - returnedDate (timestamp or null)
  - status (string: "borrowed", "overdue", "returned")
```

## Security Rules (Optional)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Only admins can read/write admin routes
    match /admin/{document=**} {
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
    }
    
    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
  }
}
```

---

**Status**: Ready for Firebase configuration  
**Current Mode**: Demo mode (test data only)  
**Last Updated**: May 16, 2026
