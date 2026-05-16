// ==================== FIREBASE INITIALIZATION (ensure firebase-config.js is loaded first) ====================
// Assumes firebase.initializeApp is already called in firebase-config.js

// ==================== DOM ELEMENTS ====================
const statBooks = document.querySelector('.stat-item .stat-number:nth-child(1)');
const statMembers = document.querySelectorAll('.stat-item .stat-number')[1];
const statGenres = document.querySelectorAll('.stat-item .stat-number')[2];
const featuredGrid = document.querySelector('.featured-grid');

// ==================== FETCH & RENDER STATS ====================
async function renderStats() {
  if (!window.db) return;
  const [booksSnap, membersSnap] = await Promise.all([
    db.collection('books').get(),
    db.collection('users').get()
  ]);
  const books = booksSnap.docs.map(doc => doc.data());
  const members = membersSnap.docs.map(doc => doc.data());
  const genres = new Set(books.map(b => b.genre).filter(Boolean));
  statBooks.textContent = books.length;
  statMembers.textContent = members.length;
  statGenres.textContent = genres.size;
}

// ==================== FETCH & RENDER FEATURED BOOKS ====================
async function renderFeaturedBooks() {
  if (!window.db) return;
  const booksSnap = await db.collection('books').get();
  const books = booksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  // Optionally, sort by borrow count if available, else just pick first 3
  const featured = books.slice(0, 3);
  featuredGrid.innerHTML = '';
  featured.forEach(book => {
    featuredGrid.innerHTML += `
      <div class="book-card">
        <div class="book-cover">📚</div>
        <div class="book-info">
          <div class="book-title">${book.title || 'Untitled'}</div>
          <div class="book-author">${book.author || 'Unknown Author'}</div>
          <span class="genre-badge">${book.genre || 'General'}</span>
          <a href="book-detail.html?id=${book.id}" class="btn-primary">View Details</a>
        </div>
      </div>
    `;
  });
}

// ==================== AUTH STATE NAVBAR ====================
function setupNavbarAuth() {
  if (!window.firebase?.auth) return;
  firebase.auth().onAuthStateChanged(user => {
    document.getElementById('loginLink').style.display = user ? 'none' : 'list-item';
    document.getElementById('registerLink').style.display = user ? 'none' : 'list-item';
    document.getElementById('myBooksLink').style.display = user ? 'list-item' : 'none';
  });
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  renderStats();
  renderFeaturedBooks();
  setupNavbarAuth();
});
