
// ==================== GENRE EMOJIS ====================
const genreEmojis = {
    "Fiction": "📖",
    "Non-Fiction": "📚",
    "Science": "🔬",
    "History": "🏛️",
    "Technology": "💻",
    "Biography": "👤",
    "Children": "🧒",
    "Mystery": "🕵️"
};

// ==================== DATA STATE ====================
let allBooks = [];
let filteredBooks = [];
let selectedBooks = new Set();
let currentPage = 1;
let booksPerPage = 10;
let viewMode = 'table';
let currentEditingBookId = null;

// ==================== DOM ELEMENTS ====================
const pageLoader = document.getElementById("pageLoader");
const hamburger = document.getElementById("hamburger");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const notificationBell = document.getElementById("notificationBell");
const notificationDropdown = document.getElementById("notificationDropdown");
const adminAvatarBtn = document.getElementById("adminAvatarBtn");
const adminDropdown = document.getElementById("adminDropdown");
const logoutBtn = document.getElementById("logoutBtn");
const logoutDropdown = document.getElementById("logoutDropdown");

// Buttons
const addBookBtn = document.getElementById("addBookBtn");
const importBooksBtn = document.getElementById("importBooksBtn");

// Filters
const searchInput = document.getElementById("searchInput");
const genreFilter = document.getElementById("genreFilter");
const availabilityFilter = document.getElementById("availabilityFilter");
const sortSelect = document.getElementById("sortSelect");
const tableViewBtn = document.getElementById("tableViewBtn");
const gridViewBtn = document.getElementById("gridViewBtn");
const perPageSelect = document.getElementById("perPageSelect");

// Table
const booksTableBody = document.getElementById("booksTableBody");
const selectAllCheckbox = document.getElementById("selectAllCheckbox");
const bulkActionsBar = document.getElementById("bulkActionsBar");
const bulkDeleteBtn = document.getElementById("bulkDeleteBtn");
const clearSelectBtn = document.getElementById("clearSelectBtn");

// Pagination
// ==================== LOAD BOOKS (FIRESTORE) ====================
async function loadBooks() {
    try {
        if (!window.db) {
            throw new Error('Firestore is not initialized. Check firebase-config.js and the Firebase SDK script order.');
        }

        const snapshot = await db.collection('books').get();
        allBooks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        filterBooks();
    } catch (error) {
        console.error('Failed to load books from Firebase:', error);
        showToast('error', 'Load Error', `Failed to load books from database. ${error.message}`);
        allBooks = [];
        filterBooks();
    }
}
const paginationTotal = document.getElementById("paginationTotal");
const bulkCount = document.getElementById("bulkCount");

// Grid
const booksGrid = document.getElementById("booksGrid");

// Modals
const addBookOverlay = document.getElementById("addBookOverlay");
const editBookOverlay = document.getElementById("editBookOverlay");
const deleteBookOverlay = document.getElementById("deleteBookOverlay");
const importBooksOverlay = document.getElementById("importBooksOverlay");

// Toast
const toastContainer = document.getElementById("toastContainer");

// ==================== INITIALIZATION ====================
document.addEventListener("DOMContentLoaded", async () => {
    // Check auth
    if (localStorage.getItem('demoMode') === 'true') {
        const userName = localStorage.getItem('userDisplayName') || "Admin User";
        const initials = userName.charAt(0).toUpperCase();
        const userNameElem = document.getElementById("userName");
        const userAvatarElem = document.getElementById("userAvatar");
        const adminInitialsElem = document.getElementById("adminInitials");
        if (userNameElem) userNameElem.textContent = userName;
        if (userAvatarElem) userAvatarElem.textContent = initials;
        if (adminInitialsElem) adminInitialsElem.textContent = initials;
        pageLoader.style.display = "none";
        initializePage();
    } else {
        const sessionUser = getSessionUser();
        if (!sessionUser) {
            window.location.href = "login.html";
            return;
        }
        const userNameElem = document.getElementById("userName");
        const userAvatarElem = document.getElementById("userAvatar");
        const adminInitialsElem = document.getElementById("adminInitials");
        if (userNameElem) userNameElem.textContent = sessionUser.displayName || "Admin User";
        if (userAvatarElem) userAvatarElem.textContent = (sessionUser.displayName || "A").charAt(0).toUpperCase();
        if (adminInitialsElem) adminInitialsElem.textContent = (sessionUser.displayName || "A").charAt(0).toUpperCase();
        pageLoader.style.display = "none";
        initializePage();
    }
});

async function initializePage() {
    // Load books
    await loadBooks();
    
    // Setup event listeners
    setupEventListeners();
    
    // Load saved preferences
    const savedView = localStorage.getItem('booksViewMode') || 'table';
    setViewMode(savedView);
    
    const savedPerPage = localStorage.getItem('booksPerPage') || '10';
    booksPerPage = parseInt(savedPerPage);
    perPageSelect.value = savedPerPage;
}

function setupEventListeners() {
    // Sidebar
    hamburger.addEventListener("click", () => {
        sidebar.classList.toggle("open");
        sidebarOverlay.classList.toggle("open");
    });

    sidebarOverlay.addEventListener("click", () => {
        sidebar.classList.remove("open");
        sidebarOverlay.classList.remove("open");
    });

    // Notifications
    notificationBell.addEventListener("click", (e) => {
        e.stopPropagation();
        notificationDropdown.style.display = notificationDropdown.style.display === "none" ? "block" : "none";
        adminDropdown.style.display = "none";
    });

    adminAvatarBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        adminDropdown.style.display = adminDropdown.style.display === "none" ? "block" : "none";
        notificationDropdown.style.display = "none";
    });

    document.addEventListener("click", () => {
        notificationDropdown.style.display = "none";
        adminDropdown.style.display = "none";
    });

    // Logout
    logoutBtn.addEventListener("click", handleLogout);
    logoutDropdown.addEventListener("click", handleLogout);

    // Books management
    addBookBtn.addEventListener("click", openAddBookModal);
    importBooksBtn.addEventListener("click", openImportBooksModal);

    // Filters
    searchInput.addEventListener("input", applyFilters);
    genreFilter.addEventListener("change", applyFilters);
    availabilityFilter.addEventListener("change", applyFilters);
    sortSelect.addEventListener("change", applyFilters);
    perPageSelect.addEventListener("change", (e) => {
        booksPerPage = parseInt(e.target.value);
        localStorage.setItem('booksPerPage', booksPerPage);
        currentPage = 1;
        renderTable();
    });

    // View toggle
    tableViewBtn.addEventListener("click", () => setViewMode("table"));
    gridViewBtn.addEventListener("click", () => setViewMode("grid"));

    // Checkboxes
    selectAllCheckbox.addEventListener("change", toggleSelectAll);
    bulkDeleteBtn.addEventListener("click", bulkDelete);
    clearSelectBtn.addEventListener("click", clearSelection);

    // Close modals
    document.getElementById("closeAddBookBtn").addEventListener("click", closeAddBookModal);
    document.getElementById("cancelAddBookBtn").addEventListener("click", closeAddBookModal);
    document.getElementById("closeEditBookBtn").addEventListener("click", closeEditBookModal);
    document.getElementById("cancelEditBookBtn").addEventListener("click", closeEditBookModal);
    document.getElementById("cancelDeleteBtn").addEventListener("click", closeDeleteBookModal);
    document.getElementById("closeImportBtn").addEventListener("click", closeImportBooksModal);
    document.getElementById("cancelImportBtn").addEventListener("click", closeImportBooksModal);

    // Form submissions
    document.getElementById("addBookForm").addEventListener("submit", handleAddBook);
    document.getElementById("editBookForm").addEventListener("submit", handleEditBook);
    document.getElementById("confirmDeleteBtn").addEventListener("click", handleDeleteBook);

    // Character counters
    document.getElementById("bookDescription").addEventListener("input", (e) => {
        document.getElementById("charCount").textContent = e.target.value.length;
    });
    document.getElementById("editBookDescription").addEventListener("input", (e) => {
        document.getElementById("editCharCount").textContent = e.target.value.length;
    });

    // Copies validation
    document.getElementById("totalCopies").addEventListener("change", (e) => {
        const totalCopies = parseInt(e.target.value) || 1;
        document.getElementById("availableCopies").setAttribute("max", totalCopies);
        if (!document.getElementById("availableCopies").value) {
            document.getElementById("availableCopies").value = totalCopies;
        }
    });

    document.getElementById("editTotalCopies").addEventListener("change", (e) => {
        const totalCopies = parseInt(e.target.value) || 1;
        document.getElementById("editAvailableCopies").setAttribute("max", totalCopies);
    });

    // Color swatches
    document.querySelectorAll(".color-swatch").forEach(swatch => {
        swatch.addEventListener("click", (e) => {
            document.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("active"));
            swatch.classList.add("active");
            updateCoverPreview();
        });
    });

    // Drag and drop
    const dragDropZone = document.getElementById("dragDropZone");
    const fileInput = document.getElementById("fileInput");
    
    dragDropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dragDropZone.classList.add("dragover");
    });
    
    dragDropZone.addEventListener("dragleave", () => {
        dragDropZone.classList.remove("dragover");
    });
    
    dragDropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dragDropZone.classList.remove("dragover");
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            document.getElementById("importBtn").disabled = false;
        }
    });

    document.getElementById("browseFileBtn").addEventListener("click", () => {
        fileInput.click();
    });

    fileInput.addEventListener("change", () => {
        document.getElementById("importBtn").disabled = !fileInput.files.length;
    });

    document.getElementById("importBtn").addEventListener("click", () => {
        showToast("success", "Import Complete", "Books imported successfully!");
        closeImportBooksModal();
    });
}

// ==================== LOAD BOOKS ====================
async function loadBooks() {
    try {
        if (!window.db) {
            throw new Error('Firestore is not initialized. Check firebase-config.js and the Firebase SDK script order.');
        }

        const snapshot = await db.collection('books').get();
        allBooks = snapshot.docs.map(doc => {
            const data = doc.data();
            const addedDateValue = data.addedDate;
            const addedDate = addedDateValue && typeof addedDateValue.toDate === 'function'
                ? addedDateValue.toDate()
                : addedDateValue ? new Date(addedDateValue) : new Date();

            return {
                id: doc.id,
                ...data,
                addedDate
            };
        });

        filterBooks();
    } catch (error) {
        console.error('Failed to load books from Firebase:', error);
        showToast('error', 'Load Error', `Failed to load books from database. ${error.message}`);
        allBooks = [];
        filterBooks();
    }
}

// ==================== FILTER BOOKS ====================
function applyFilters() {
    currentPage = 1;
    filterBooks();
}

function filterBooks() {
    const searchQuery = searchInput.value.toLowerCase();
    const selectedGenre = genreFilter.value;
    const selectedAvailability = availabilityFilter.value;
    const selectedSort = sortSelect.value;

    // Filter
    filteredBooks = allBooks.filter(book => {
        // Search
        const matchesSearch = !searchQuery || 
            book.title.toLowerCase().includes(searchQuery) ||
            book.author.toLowerCase().includes(searchQuery) ||
            book.isbn.includes(searchQuery) ||
            book.genre.toLowerCase().includes(searchQuery);

        // Genre
        const matchesGenre = !selectedGenre || book.genre === selectedGenre;

        // Availability
        let matchesAvailability = true;
        if (selectedAvailability === "available") {
            matchesAvailability = book.available > 0;
        } else if (selectedAvailability === "unavailable") {
            matchesAvailability = book.available === 0;
        } else if (selectedAvailability === "low") {
            matchesAvailability = book.available > 0 && book.available <= 2;
        }

        return matchesSearch && matchesGenre && matchesAvailability;
    });

    // Sort
    switch (selectedSort) {
        case "latest":
            filteredBooks.sort((a, b) => new Date(b.addedDate) - new Date(a.addedDate));
            break;
        case "titleAz":
            filteredBooks.sort((a, b) => a.title.localeCompare(b.title));
            break;
        case "titleZa":
            filteredBooks.sort((a, b) => b.title.localeCompare(a.title));
            break;
        case "mostAvailable":
            filteredBooks.sort((a, b) => b.available - a.available);
            break;
    }

    // Update counts
    resultsCount.textContent = filteredBooks.length;
    totalCount.textContent = allBooks.length;
    paginationTotal.textContent = allBooks.length;

    // Update stats
    updateStats();

    // Render
    if (viewMode === "table") {
        renderTable();
    } else {
        renderGrid();
    }
}

// ==================== RENDER TABLE ====================
function renderTable() {
    const startIndex = (currentPage - 1) * booksPerPage;
    const endIndex = startIndex + booksPerPage;
    const paginatedBooks = filteredBooks.slice(startIndex, endIndex);

    booksTableBody.innerHTML = paginatedBooks.map(book => {
        const emoji = genreEmojis[book.genre] || "📖";
        const statusClass = book.available === 0 ? "unavailable" : book.available <= 2 ? "low" : "available";
        const statusText = book.available === 0 ? "Unavailable" : book.available <= 2 ? "Low Stock" : "Available";
        const isSelected = selectedBooks.has(book.id);
        const rowClass = isSelected ? "selected" : "";

        return `
            <tr class="${rowClass}">
                <td style="width: 50px;">
                    <input type="checkbox" class="custom-checkbox book-checkbox" data-id="${book.id}" ${isSelected ? "checked" : ""}>
                </td>
                <td style="width: 80px;">
                    <div class="book-cover" style="background: linear-gradient(135deg, ${getCoverGradient(book.coverColor)});">
                        ${emoji}
                    </div>
                </td>
                <td>
                    <div class="book-info-cell">
                        <div class="book-title">${escapeHtml(book.title)}</div>
                        <div class="book-author">by ${escapeHtml(book.author)}</div>
                        <div class="book-isbn">ISBN: ${book.isbn}</div>
                        <div class="book-added-date">Added ${formatDate(book.addedDate)}</div>
                    </div>
                </td>
                <td style="width: 120px;">
                    <div class="genre-badge ${book.genre.toLowerCase().replace("-", "")}">${book.genre}</div>
                </td>
                <td style="width: 100px;">
                    <div class="copies-cell">
                        <span class="copies-number">${book.totalCopies}</span>
                        <span class="copies-label">total</span>
                    </div>
                </td>
                <td style="width: 100px;">
                    <div class="available-cell">
                        <span class="available-number ${book.available === 0 ? 'red' : book.available <= 2 ? 'orange' : 'green'}">${book.available}</span>
                        <span class="available-label">copies</span>
                    </div>
                </td>
                <td style="width: 120px;">
                    <div style="text-align: center;">
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </div>
                </td>
                <td style="width: 140px;">
                    <div class="actions-cell">
                        <button class="action-icon-btn view" title="View" onclick="window.location.href='book-detail.html?id=${book.id}'">👁️</button>
                        <button class="action-icon-btn edit" title="Edit" onclick="openEditBookModal('${book.id}')">✏️</button>
                        <button class="action-icon-btn delete" title="Delete" onclick="openDeleteBookModal('${book.id}')">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    // Update pagination
    updatePagination();

    // Re-attach checkbox listeners
    document.querySelectorAll(".book-checkbox").forEach(checkbox => {
        checkbox.addEventListener("change", (e) => {
            if (e.target.checked) {
                selectedBooks.add(e.target.dataset.id);
            } else {
                selectedBooks.delete(e.target.dataset.id);
            }
            updateBulkActions();
        });
    });

    // Update checkbox state
    selectAllCheckbox.checked = paginatedBooks.length > 0 && paginatedBooks.every(b => selectedBooks.has(b.id));
    updateBulkActions();
}

// ==================== RENDER GRID ====================
function renderGrid() {
    const startIndex = (currentPage - 1) * booksPerPage;
    const endIndex = startIndex + booksPerPage;
    const paginatedBooks = filteredBooks.slice(startIndex, endIndex);

    booksGrid.innerHTML = paginatedBooks.map(book => {
        const emoji = genreEmojis[book.genre] || "📖";

        return `
            <div class="book-grid-card">
                <div class="grid-card-cover" style="background: linear-gradient(135deg, ${getCoverGradient(book.coverColor)});">
                    ${emoji}
                    <div class="grid-card-actions">
                        <button class="grid-action-btn" title="Edit" onclick="openEditBookModal('${book.id}')">✏️</button>
                        <button class="grid-action-btn" title="Delete" onclick="openDeleteBookModal('${book.id}')">🗑️</button>
                    </div>
                </div>
                <div class="grid-card-content">
                    <div class="grid-card-genre">${book.genre}</div>
                    <div class="grid-card-title">${escapeHtml(book.title)}</div>
                    <div class="grid-card-author">${escapeHtml(book.author)}</div>
                    <div class="grid-card-stats">
                        <div class="grid-stat">
                            <div class="grid-stat-number">${book.totalCopies}</div>
                            <div class="grid-stat-label">Total</div>
                        </div>
                        <div class="grid-stat">
                            <div class="grid-stat-number">${book.available}</div>
                            <div class="grid-stat-label">Available</div>
                        </div>
                        <div class="grid-stat">
                            <div class="grid-stat-number">${book.totalCopies - book.available}</div>
                            <div class="grid-stat-label">Borrowed</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join("");

    updatePagination();
}

// ==================== PAGINATION ====================
function updatePagination() {
    const totalPages = Math.ceil(filteredBooks.length / booksPerPage);
    const startIndex = (currentPage - 1) * booksPerPage + 1;
    const endIndex = Math.min(currentPage * booksPerPage, filteredBooks.length);

    paginationStart.textContent = filteredBooks.length === 0 ? 0 : startIndex;
    paginationEnd.textContent = endIndex;

    // Generate page numbers
    paginationNumbers.innerHTML = "";

    const prevBtn = document.createElement("button");
    prevBtn.className = "pagination-btn";
    prevBtn.textContent = "← Prev";
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            if (viewMode === "table") {
                renderTable();
            } else {
                renderGrid();
            }
            window.scrollTo(0, 0);
        }
    });
    paginationNumbers.appendChild(prevBtn);

    // Show max 5 page numbers
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    if (startPage > 1) {
        const pageBtn = document.createElement("button");
        pageBtn.className = "pagination-btn";
        pageBtn.textContent = "1";
        pageBtn.addEventListener("click", () => goToPage(1));
        paginationNumbers.appendChild(pageBtn);

        if (startPage > 2) {
            const dots = document.createElement("span");
            dots.style.padding = "0 4px";
            dots.textContent = "...";
            paginationNumbers.appendChild(dots);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement("button");
        pageBtn.className = `pagination-btn ${i === currentPage ? "active" : ""}`;
        pageBtn.textContent = i;
        pageBtn.addEventListener("click", () => goToPage(i));
        paginationNumbers.appendChild(pageBtn);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const dots = document.createElement("span");
            dots.style.padding = "0 4px";
            dots.textContent = "...";
            paginationNumbers.appendChild(dots);
        }

        const pageBtn = document.createElement("button");
        pageBtn.className = "pagination-btn";
        pageBtn.textContent = totalPages;
        pageBtn.addEventListener("click", () => goToPage(totalPages));
        paginationNumbers.appendChild(pageBtn);
    }

    const nextBtn = document.createElement("button");
    nextBtn.className = "pagination-btn";
    nextBtn.textContent = "Next →";
    nextBtn.disabled = currentPage === totalPages || totalPages === 0;
    nextBtn.addEventListener("click", () => {
        if (currentPage < totalPages) {
            currentPage++;
            if (viewMode === "table") {
                renderTable();
            } else {
                renderGrid();
            }
            window.scrollTo(0, 0);
        }
    });
    paginationNumbers.appendChild(nextBtn);
}

function goToPage(page) {
    currentPage = page;
    if (viewMode === "table") {
        renderTable();
    } else {
        renderGrid();
    }
    window.scrollTo(0, 0);
}

// ==================== VIEW MODE ====================
function setViewMode(mode) {
    viewMode = mode;
    localStorage.setItem('booksViewMode', mode);

    if (mode === "table") {
        document.getElementById("tableViewContainer").style.display = "block";
        document.getElementById("gridViewContainer").style.display = "none";
        tableViewBtn.classList.add("active");
        gridViewBtn.classList.remove("active");
        renderTable();
    } else {
        document.getElementById("tableViewContainer").style.display = "none";
        document.getElementById("gridViewContainer").style.display = "block";
        tableViewBtn.classList.remove("active");
        gridViewBtn.classList.add("active");
        renderGrid();
    }
}

// ==================== CHECKBOXES ====================
function toggleSelectAll(e) {
    const paginatedBooks = filteredBooks.slice((currentPage - 1) * booksPerPage, currentPage * booksPerPage);
    
    if (e.target.checked) {
        paginatedBooks.forEach(book => selectedBooks.add(book.id));
    } else {
        paginatedBooks.forEach(book => selectedBooks.delete(book.id));
    }

    renderTable();
}

function updateBulkActions() {
    if (selectedBooks.size > 0) {
        bulkActionsBar.style.display = "flex";
        bulkCount.textContent = selectedBooks.size;
    } else {
        bulkActionsBar.style.display = "none";
    }
}

function clearSelection() {
    selectedBooks.clear();
    selectAllCheckbox.checked = false;
    renderTable();
}

function bulkDelete() {
    if (selectedBooks.size === 0) return;
    showToast("success", "Bulk Delete", `${selectedBooks.size} books deleted successfully!`);
    selectedBooks.forEach(id => {
        const index = allBooks.findIndex(b => b.id === id);
        if (index > -1) {
            allBooks.splice(index, 1);
        }
    });
    selectedBooks.clear();
    filterBooks();
}

// ==================== MODALS ====================
function openAddBookModal() {
    document.getElementById("addBookForm").reset();
    document.getElementById("charCount").textContent = "0";
    document.getElementById("totalCopies").value = "1";
    document.getElementById("availableCopies").value = "1";
    addBookOverlay.style.display = "flex";
    document.body.style.overflow = "hidden";
}

function closeAddBookModal() {
    addBookOverlay.style.display = "none";
    document.body.style.overflow = "auto";
}

function openEditBookModal(bookId) {
    const book = allBooks.find(b => b.id === bookId);
    if (!book) return;

    currentEditingBookId = bookId;

    document.getElementById("editBookTitle").value = book.title;
    document.getElementById("editBookAuthor").value = book.author;
    document.getElementById("editBookISBN").value = book.isbn;
    document.getElementById("editBookGenre").value = book.genre;
    document.getElementById("editBookYear").value = book.year;
    document.getElementById("editTotalCopies").value = book.totalCopies;
    document.getElementById("editAvailableCopies").value = book.available;
    document.getElementById("editBookDescription").value = book.description || "";
    document.getElementById("editBookLanguage").value = book.language || "English";
    document.getElementById("editBookEdition").value = book.edition || "";
    document.getElementById("editCharCount").textContent = (book.description || "").length;

    editBookOverlay.style.display = "flex";
    document.body.style.overflow = "hidden";
}

function closeEditBookModal() {
    editBookOverlay.style.display = "none";
    document.body.style.overflow = "auto";
    currentEditingBookId = null;
}

function openDeleteBookModal(bookId) {
    const book = allBooks.find(b => b.id === bookId);
    if (!book) return;

    currentEditingBookId = bookId;
    document.getElementById("deleteBookTitle").textContent = book.title;
    document.getElementById("deleteActiveWarning").style.display = "none";

    deleteBookOverlay.style.display = "flex";
    document.body.style.overflow = "hidden";
}

function closeDeleteBookModal() {
    deleteBookOverlay.style.display = "none";
    document.body.style.overflow = "auto";
    currentEditingBookId = null;
}

function openImportBooksModal() {
    document.getElementById("fileInput").value = "";
    document.getElementById("importBtn").disabled = true;
    importBooksOverlay.style.display = "flex";
    document.body.style.overflow = "hidden";
}

function closeImportBooksModal() {
    importBooksOverlay.style.display = "none";
    document.body.style.overflow = "auto";
}

// ==================== FORM SUBMISSION ====================
async function handleAddBook(e) {
    e.preventDefault();

    const title = document.getElementById("bookTitle").value.trim();
    const author = document.getElementById("bookAuthor").value.trim();
    const isbn = document.getElementById("bookISBN").value.trim();
    const genre = document.getElementById("bookGenre").value;
    const year = parseInt(document.getElementById("bookYear").value) || new Date().getFullYear();
    const totalCopies = parseInt(document.getElementById("totalCopies").value) || 1;
    const available = parseInt(document.getElementById("availableCopies").value) || totalCopies;
    const description = document.getElementById("bookDescription").value;
    const language = document.getElementById("bookLanguage").value;
    const edition = document.getElementById("bookEdition").value;
    const coverColor = document.querySelector(".color-swatch.active").dataset.color || "purple";

    // Validate
    if (!title || !author || !genre) {
        showToast("error", "Validation Error", "Please fill in all required fields");
        return;
    }

    if (available > totalCopies) {
        showToast("error", "Validation Error", "Available copies cannot exceed total copies");
        return;
    }

    if (!window.db) {
        showToast("error", "Save Error", "Firebase is not initialized.");
        return;
    }

    const newBook = {
        title,
        author,
        isbn,
        genre,
        year,
        totalCopies,
        available,
        description,
        language,
        edition,
        coverColor,
        addedDate: new Date()
    };

    try {
        const bookData = { ...newBook, addedDate: firebase.firestore.FieldValue.serverTimestamp() };
        const docRef = await db.collection('books').add(bookData);
        newBook.id = docRef.id;
        allBooks.push(newBook);
        filterBooks();
        closeAddBookModal();
        showToast("success", "Book Added", '"' + title + '" has been added successfully!');
    } catch (error) {
        console.error('Error adding book:', error);
        showToast('error', 'Save Error', 'Book could not be saved. ' + error.message);
    }
}
async function handleEditBook(e) {
    e.preventDefault();

    const book = allBooks.find(b => b.id === currentEditingBookId);
    if (!book) return;

    const title = document.getElementById("editBookTitle").value.trim();
    const author = document.getElementById("editBookAuthor").value.trim();
    const isbn = document.getElementById("editBookISBN").value.trim();
    const genre = document.getElementById("editBookGenre").value;
    const year = parseInt(document.getElementById("editBookYear").value) || book.year;
    const totalCopies = parseInt(document.getElementById("editTotalCopies").value) || book.totalCopies;
    const available = parseInt(document.getElementById("editAvailableCopies").value) || book.available;
    const description = document.getElementById("editBookDescription").value;
    const language = document.getElementById("editBookLanguage").value;
    const edition = document.getElementById("editBookEdition").value;

    // Validate
    if (!title || !author || !genre) {
        showToast("error", "Validation Error", "Please fill in all required fields");
        return;
    }

    if (available > totalCopies) {
        showToast("error", "Validation Error", "Available copies cannot exceed total copies");
        return;
    }

    if (!window.db) {
        showToast("error", "Save Error", "Firebase is not initialized.");
        return;
    }

    const updatedData = {
        title,
        author,
        isbn,
        genre,
        year,
        totalCopies,
        available,
        description,
        language,
        edition
    };

    try {
        await db.collection('books').doc(book.id).update(updatedData);
        Object.assign(book, updatedData);
        filterBooks();
        closeEditBookModal();
        showToast("success", "Book Updated", '"' + title + '" has been updated successfully!');
    } catch (error) {
        console.error('Error updating book:', error);
        showToast('error', 'Save Error', 'Book could not be updated. ' + error.message);
    }
}
async function handleDeleteBook() {
    const book = allBooks.find(b => b.id === currentEditingBookId);
    if (!book) return;

    if (!window.db) {
        showToast("error", "Delete Error", "Firebase is not initialized.");
        return;
    }

    try {
        await db.collection('books').doc(book.id).delete();
        const index = allBooks.indexOf(book);
        if (index > -1) {
            allBooks.splice(index, 1);
        }
        filterBooks();
        closeDeleteBookModal();
        showToast("success", "Book Deleted", '"' + book.title + '" has been deleted successfully!');
    } catch (error) {
        console.error('Error deleting book:', error);
        showToast('error', 'Delete Error', 'Book could not be deleted. ' + error.message);
    }
}

// ==================== STATS ====================
function updateStats() {
    const total = allBooks.length;
    const available = allBooks.reduce((sum, book) => sum + book.available, 0);
    const borrowed = allBooks.reduce((sum, book) => sum + (book.totalCopies - book.available), 0);
    const genres = new Set(allBooks.map(b => b.genre)).size;

    document.getElementById("totalBooksCount").textContent = total;
    document.getElementById("availableBooksCount").textContent = available;
    document.getElementById("borrowedBooksCount").textContent = borrowed;
    document.getElementById("genresCount").textContent = genres;
}

function updateCoverPreview() {
    const selectedColor = document.querySelector(".color-swatch.active").dataset.color;
    const preview = document.getElementById("coverPreview");
    const gradient = getCoverGradient(selectedColor);
    preview.querySelector(".preview-book").style.background = `linear-gradient(135deg, ${gradient})`;
}

// ==================== UTILITIES ====================
function getCoverGradient(color) {
    const gradients = {
        "purple": "#667eea, #764ba2",
        "blue": "#4facfe, #00f2fe",
        "green": "#43e97b, #38f9d7",
        "orange": "#f7971e, #ffd200",
        "pink": "#f5576c, #f093fb",
        "teal": "#11998e, #38ef7d"
    };
    return gradients[color] || gradients.purple;
}

function formatDate(date) {
    const options = { year: "numeric", month: "short", day: "numeric" };
    return new Date(date).toLocaleDateString("en-US", options);
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function handleLogout() {
    localStorage.removeItem('demoMode');
    logoutAndRedirect();
}

function showToast(type, title, message) {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `<strong>${title}:</strong> ${message}`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("removing");
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// ==================== CLOSE ON ESCAPE ====================
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        if (addBookOverlay.style.display !== "none") closeAddBookModal();
        if (editBookOverlay.style.display !== "none") closeEditBookModal();
        if (deleteBookOverlay.style.display !== "none") closeDeleteBookModal();
        if (importBooksOverlay.style.display !== "none") closeImportBooksModal();
    }
});

// ==================== CLOSE MODAL ON OVERLAY CLICK ====================
[addBookOverlay, editBookOverlay, deleteBookOverlay, importBooksOverlay].forEach(modal => {
    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            if (modal === addBookOverlay) closeAddBookModal();
            if (modal === editBookOverlay) closeEditBookModal();
            if (modal === deleteBookOverlay) closeDeleteBookModal();
            if (modal === importBooksOverlay) closeImportBooksModal();
        }
    });
});
