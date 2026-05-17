// ==================== LOAD MEMBERS (FIRESTORE) ====================
function getMemberIdNumber(memberId) {
    if (typeof memberId !== 'string' || !memberId.trim()) {
        return NaN;
    }

    const parts = memberId.trim().split('-').filter(Boolean);
    const candidate = parts.length > 1 ? parts[1] : parts[0];
    return parseInt(candidate, 10);
}

function getMemberInitials(name) {
    if (typeof name !== 'string' || !name.trim()) {
        return '??';
    }
    return name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map(n => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();
}

function normalizeMemberData(member) {
    const normalizedName = typeof member.name === 'string' && member.name.trim() ? member.name.trim() : (typeof member.email === 'string' ? member.email : 'Unknown Member');
    return {
        id: member.id || '',
        name: normalizedName,
        email: typeof member.email === 'string' ? member.email : '',
        role: member.role || 'member',
        status: member.status || 'active',
        avatarColor: colorGradients[member.avatarColor] ? member.avatarColor : 'purple',
        memberId: typeof member.memberId === 'string' ? member.memberId : (member.memberId ? String(member.memberId) : ''),
        joinedDate: member.joinedDate || new Date().toISOString(),
        lastActive: member.lastActive || member.joinedDate || new Date().toISOString(),
        activeBorrowings: Number(member.activeBorrowings) || 0,
        totalBorrowed: Number(member.totalBorrowed) || 0,
        ...member
    };
}

async function loadMembers() {
    try {
        if (!window.db) {
            throw new Error('Firestore is not initialized. Check firebase-config.js and the Firebase SDK script order.');
        }

        const snapshot = await db.collection('users').get();
        allMembers = snapshot.docs.map(doc => normalizeMemberData({ id: doc.id, ...doc.data() }));
        // Calculate nextMemberId for new member creation (if needed)
        const maxId = allMembers.reduce((max, m) => {
            const num = getMemberIdNumber(m.memberId);
            return isNaN(num) ? max : Math.max(max, num);
        }, 0);
        nextMemberId = maxId + 1;
        filterMembers();
    } catch (error) {
        console.error('Failed to load members from Firebase:', error);
        showToast('error', 'Load Error', `Failed to load members from database. ${error.message}`);
        allMembers = [];
        filterMembers();
    }
}

// ==================== COLOR MAPPING ====================
const colorGradients = {
    "purple": "#667eea, #764ba2",
    "blue": "#4facfe, #00f2fe",
    "green": "#43e97b, #38f9d7",
    "orange": "#f7971e, #ffd200",
    "pink": "#f5576c, #f093fb",
    "teal": "#11998e, #38ef7d",
    "indigo": "#5a67d8, #6b46c1",
    "cyan": "#06b6d4, #0891b2"
};

// ==================== STATE VARIABLES ====================
let allMembers = [];
let filteredMembers = [];
let selectedMembers = new Set();
let currentPage = 1;
let membersPerPage = 10;
let viewMode = 'table';
let currentEditingMemberId = null;
let nextMemberId = 8;

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
const addMemberBtn = document.getElementById("addMemberBtn");
const exportMembersBtn = document.getElementById("exportMembersBtn");

// Filters
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const sortSelect = document.getElementById("sortSelect");
const tableViewBtn = document.getElementById("tableViewBtn");
const cardViewBtn = document.getElementById("cardViewBtn");
const perPageSelect = document.getElementById("perPageSelect");

// Table
const membersTableBody = document.getElementById("membersTableBody");
const selectAllCheckbox = document.getElementById("selectAllCheckbox");
const bulkActionsBar = document.getElementById("bulkActionsBar");
const bulkDeleteBtn = document.getElementById("bulkDeleteBtn");
const clearSelectBtn = document.getElementById("clearSelectBtn");

// Pagination
const resultsCount = document.getElementById("resultsCount");
const totalCount = document.getElementById("totalCount");
const paginationNumbers = document.getElementById("paginationNumbers");
const paginationStart = document.getElementById("paginationStart");
const paginationEnd = document.getElementById("paginationEnd");
const paginationTotal = document.getElementById("paginationTotal");
const bulkCount = document.getElementById("bulkCount");

// Grid
const membersGrid = document.getElementById("membersGrid");

// Modals
const memberDetailOverlay = document.getElementById("memberDetailOverlay");
const addMemberOverlay = document.getElementById("addMemberOverlay");
const editMemberOverlay = document.getElementById("editMemberOverlay");
const deleteMemberOverlay = document.getElementById("deleteMemberOverlay");

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

function initializePage() {
    // Load members
    loadMembers();
    
    // Setup event listeners
    setupEventListeners();
    
    // Load saved preferences
    const savedView = localStorage.getItem('membersViewMode') || 'table';
    setViewMode(savedView);
    
    const savedPerPage = localStorage.getItem('membersPerPage') || '10';
    membersPerPage = parseInt(savedPerPage);
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

    // Members management
    addMemberBtn.addEventListener("click", openAddMemberModal);
    exportMembersBtn.addEventListener("click", exportMembers);

    // Filters
    searchInput.addEventListener("input", applyFilters);
    statusFilter.addEventListener("change", applyFilters);
    sortSelect.addEventListener("change", applyFilters);
    perPageSelect.addEventListener("change", (e) => {
        membersPerPage = parseInt(e.target.value);
        localStorage.setItem('membersPerPage', membersPerPage);
        currentPage = 1;
        renderTable();
    });

    // View toggle
    tableViewBtn.addEventListener("click", () => setViewMode("table"));
    cardViewBtn.addEventListener("click", () => setViewMode("card"));

    // Checkboxes
    selectAllCheckbox.addEventListener("change", toggleSelectAll);
    bulkDeleteBtn.addEventListener("click", bulkDelete);
    clearSelectBtn.addEventListener("click", clearSelection);

    // Close modals
    document.getElementById("closeDetailBtn").addEventListener("click", closeDetailModal);
    document.getElementById("closeAddMemberBtn").addEventListener("click", closeAddMemberModal);
    document.getElementById("cancelAddMemberBtn").addEventListener("click", closeAddMemberModal);
    document.getElementById("closeEditMemberBtn").addEventListener("click", closeEditMemberModal);
    document.getElementById("cancelEditMemberBtn").addEventListener("click", closeEditMemberModal);
    document.getElementById("cancelDeleteMemberBtn").addEventListener("click", closeDeleteModal);

    // Form submissions
    document.getElementById("addMemberForm").addEventListener("submit", handleAddMember);
    document.getElementById("editMemberForm").addEventListener("submit", handleEditMember);
    document.getElementById("confirmDeleteMemberBtn").addEventListener("click", handleDeleteMember);

    // Detail modal edit/delete buttons
    document.getElementById("editMemberFromDetailBtn").addEventListener("click", () => {
        closeDetailModal();
        setTimeout(() => openEditMemberModal(currentEditingMemberId), 300);
    });
    document.getElementById("deleteMemberFromDetailBtn").addEventListener("click", () => {
        closeDetailModal();
        setTimeout(() => openDeleteModal(currentEditingMemberId), 300);
    });

    // Tabs
    document.querySelectorAll(".detail-tab").forEach(tab => {
        tab.addEventListener("click", (e) => {
            switchDetailTab(e.target.dataset.tab);
        });
    });

    // Character counters
    document.getElementById("memberNotes").addEventListener("input", (e) => {
        document.getElementById("memberNotesCount").textContent = e.target.value.length;
    });
    document.getElementById("editMemberNotes").addEventListener("input", (e) => {
        document.getElementById("editMemberNotesCount").textContent = e.target.value.length;
    });

    // Password strength checker
    document.getElementById("memberPassword").addEventListener("input", (e) => {
        updatePasswordStrength(e.target.value);
    });

    // Change password toggle
    document.getElementById("changePasswordCheckbox").addEventListener("change", (e) => {
        document.getElementById("passwordChangeFields").style.display = e.target.checked ? "block" : "none";
    });

    // Color swatches
    document.querySelectorAll(".color-swatch").forEach(swatch => {
        swatch.addEventListener("click", (e) => {
            e.preventDefault();
            document.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("active"));
            swatch.classList.add("active");
        });
    });

    // Toggle password visibility
    document.getElementById("togglePassword1")?.addEventListener("click", (e) => {
        e.preventDefault();
        togglePasswordVisibility(document.getElementById("memberPassword"));
    });
    document.getElementById("togglePassword2")?.addEventListener("click", (e) => {
        e.preventDefault();
        togglePasswordVisibility(document.getElementById("confirmPassword"));
    });
    document.getElementById("toggleEditPassword1")?.addEventListener("click", (e) => {
        e.preventDefault();
        togglePasswordVisibility(document.getElementById("editPassword"));
    });
    document.getElementById("toggleEditPassword2")?.addEventListener("click", (e) => {
        e.preventDefault();
        togglePasswordVisibility(document.getElementById("confirmEditPassword"));
    });

    // Regenerate ID
    document.getElementById("regenerateIdBtn")?.addEventListener("click", (e) => {
        e.preventDefault();
        const newId = generateMemberId();
        document.getElementById("memberId").value = newId;
    });

    // Role radio buttons
    document.querySelectorAll('input[name="role"]').forEach(radio => {
        radio.addEventListener("change", (e) => {
            const warning = document.getElementById("roleWarning");
            if (e.target.value === "admin") {
                warning.style.display = "block";
            } else {
                warning.style.display = "none";
            }
        });
    });
}

// ==================== LOAD MEMBERS ====================
// (Replaced by async Firestore version above)

// ==================== FILTER MEMBERS ====================
function applyFilters() {
    currentPage = 1;
    filterMembers();
}

function filterMembers() {
    const searchQuery = searchInput.value.toLowerCase();
    const selectedStatus = statusFilter.value;
    const selectedSort = sortSelect.value;

    // Filter
    filteredMembers = allMembers.filter(member => {
        // Search
        const matchesSearch = !searchQuery || 
            member.name.toLowerCase().includes(searchQuery) ||
            member.email.toLowerCase().includes(searchQuery) ||
            member.memberId.includes(searchQuery);

        // Status
        let matchesStatus = true;
        if (selectedStatus === "active") {
            matchesStatus = member.status === "active";
        } else if (selectedStatus === "overdue") {
            matchesStatus = member.status === "overdue";
        } else if (selectedStatus === "no-borrowings") {
            matchesStatus = member.status === "no-borrowings";
        }

        return matchesSearch && matchesStatus;
    });

    // Sort
    switch (selectedSort) {
        case "newest":
            filteredMembers.sort((a, b) => new Date(b.joinedDate) - new Date(a.joinedDate));
            break;
        case "oldest":
            filteredMembers.sort((a, b) => new Date(a.joinedDate) - new Date(b.joinedDate));
            break;
        case "nameAz":
            filteredMembers.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case "nameZa":
            filteredMembers.sort((a, b) => b.name.localeCompare(a.name));
            break;
        case "mostBorrowed":
            filteredMembers.sort((a, b) => b.totalBorrowed - a.totalBorrowed);
            break;
    }

    // Update counts
    resultsCount.textContent = filteredMembers.length;
    totalCount.textContent = allMembers.length;
    paginationTotal.textContent = allMembers.length;

    // Update stats
    updateStats();

    // Update overdue section
    updateOverdueSection();

    // Render
    if (viewMode === "table") {
        renderTable();
    } else {
        renderGrid();
    }
}

// ==================== RENDER TABLE ====================
function renderTable() {
    const startIndex = (currentPage - 1) * membersPerPage;
    const endIndex = startIndex + membersPerPage;
    const paginatedMembers = filteredMembers.slice(startIndex, endIndex);

    membersTableBody.innerHTML = paginatedMembers.map(member => {
        const isSelected = selectedMembers.has(member.id);
        const rowClass = isSelected ? "selected" : "";

        return `
            <tr class="${rowClass}">
                <td style="width: 50px;">
                    <input type="checkbox" class="custom-checkbox member-checkbox" data-id="${member.id}" ${isSelected ? "checked" : ""}>
                </td>
                <td>
                    <div class="member-cell">
                        <div class="member-avatar" style="background: linear-gradient(135deg, ${colorGradients[member.avatarColor]});">
                            ${getMemberInitials(member.name)}
                        </div>
                        <div class="member-info">
                            <div class="member-name">
                                ${escapeHtml(member.name)}
                                ${member.role === "admin" ? '<span class="member-role-badge">Admin</span>' : ''}
                            </div>
                            <div class="member-email">${escapeHtml(member.email)}</div>
                        </div>
                    </div>
                </td>
                <td class="email-cell">${escapeHtml(member.email)}</td>
                <td class="member-id-cell">${member.memberId}</td>
                <td class="joined-cell">
                    ${formatDate(member.joinedDate)}
                    <div class="joined-ago">${getTimeAgo(member.joinedDate)}</div>
                </td>
                <td>
                    <div class="borrowed-cell">
                        <span class="borrowed-count">${member.activeBorrowings} active / ${member.totalBorrowed} total</span>
                        <div class="borrowed-bar">
                            <div class="borrowed-bar-fill" style="width: ${Math.min(100, (member.activeBorrowings / 5) * 100)}%"></div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="status-badge ${member.status}">${getStatusLabel(member.status)}</span>
                </td>
                <td>
                    <div class="actions-cell">
                        <button class="action-icon-btn view" title="View" onclick="openDetailModal('${member.id}')">👁️</button>
                        <button class="action-icon-btn edit" title="Edit" onclick="openEditMemberModal('${member.id}')">✏️</button>
                        <button class="action-icon-btn delete" title="Delete" onclick="openDeleteModal('${member.id}')">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    // Update pagination
    updatePagination();

    // Re-attach checkbox listeners
    document.querySelectorAll(".member-checkbox").forEach(checkbox => {
        checkbox.addEventListener("change", (e) => {
            if (e.target.checked) {
                selectedMembers.add(e.target.dataset.id);
            } else {
                selectedMembers.delete(e.target.dataset.id);
            }
            updateBulkActions();
        });
    });

    // Update checkbox state
    selectAllCheckbox.checked = paginatedMembers.length > 0 && paginatedMembers.every(m => selectedMembers.has(m.id));
    updateBulkActions();
}

// ==================== RENDER GRID ====================
function renderGrid() {
    const startIndex = (currentPage - 1) * membersPerPage;
    const endIndex = startIndex + membersPerPage;
    const paginatedMembers = filteredMembers.slice(startIndex, endIndex);

    const gridHTML = paginatedMembers.map(member => {
        const statusLabel = getStatusLabel(member.status);
        const statusClass = member.status;

        return `
            <div class="member-grid-card">
                <div class="grid-card-header"></div>
                <div class="grid-card-content">
                    <div class="grid-avatar" style="background: linear-gradient(135deg, ${colorGradients[member.avatarColor]});">
                        ${getMemberInitials(member.name)}
                    </div>
                    <div class="grid-card-name">${escapeHtml(member.name)}</div>
                    ${member.role === "admin" ? '<div class="grid-card-role">Admin</div>' : ''}
                    <div class="grid-card-email">${escapeHtml(member.email)}</div>
                    <div class="grid-card-id">${member.memberId}</div>

                    <div class="grid-stats">
                        <div class="grid-stat-item">
                            <div class="grid-stat-number">${member.totalBorrowed}</div>
                            <div class="grid-stat-label">Total</div>
                        </div>
                        <div class="grid-stat-item">
                            <div class="grid-stat-number">${member.activeBorrowings}</div>
                            <div class="grid-stat-label">Active</div>
                        </div>
                        <div class="grid-stat-item">
                            <div class="grid-stat-number">${formatDate(member.joinedDate).split(" ")[0]}</div>
                            <div class="grid-stat-label">Since</div>
                        </div>
                    </div>

                    <div class="grid-card-status ${statusClass}">${statusLabel}</div>

                    <div class="grid-card-buttons">
                        <button class="grid-card-btn" onclick="openDetailModal('${member.id}')">View</button>
                        <button class="grid-card-btn delete" onclick="openDeleteModal('${member.id}')">Delete</button>
                    </div>
                </div>
            </div>
        `;
    }).join("");

    membersGrid.innerHTML = gridHTML;
    updatePagination();
}

// ==================== PAGINATION ====================
function updatePagination() {
    const totalPages = Math.ceil(filteredMembers.length / membersPerPage);
    const startIndex = (currentPage - 1) * membersPerPage + 1;
    const endIndex = Math.min(currentPage * membersPerPage, filteredMembers.length);

    paginationStart.textContent = filteredMembers.length === 0 ? 0 : startIndex;
    paginationEnd.textContent = endIndex;

    paginationNumbers.innerHTML = "";

    // Prev button
    const prevBtn = document.createElement("button");
    prevBtn.className = "pagination-btn";
    prevBtn.textContent = "← Prev";
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            if (viewMode === "table") renderTable();
            else renderGrid();
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

    // Next button
    const nextBtn = document.createElement("button");
    nextBtn.className = "pagination-btn";
    nextBtn.textContent = "Next →";
    nextBtn.disabled = currentPage === totalPages || totalPages === 0;
    nextBtn.addEventListener("click", () => {
        if (currentPage < totalPages) {
            currentPage++;
            if (viewMode === "table") renderTable();
            else renderGrid();
            window.scrollTo(0, 0);
        }
    });
    paginationNumbers.appendChild(nextBtn);
}

function goToPage(page) {
    currentPage = page;
    if (viewMode === "table") renderTable();
    else renderGrid();
    window.scrollTo(0, 0);
}

// ==================== VIEW MODE ====================
function setViewMode(mode) {
    viewMode = mode;
    localStorage.setItem('membersViewMode', mode);

    if (mode === "table") {
        document.getElementById("tableViewContainer").style.display = "block";
        document.getElementById("gridViewContainer").style.display = "none";
        tableViewBtn.classList.add("active");
        cardViewBtn.classList.remove("active");
        renderTable();
    } else {
        document.getElementById("tableViewContainer").style.display = "none";
        document.getElementById("gridViewContainer").style.display = "block";
        tableViewBtn.classList.remove("active");
        cardViewBtn.classList.add("active");
        renderGrid();
    }
}

// ==================== CHECKBOXES ====================
function toggleSelectAll(e) {
    const paginatedMembers = filteredMembers.slice((currentPage - 1) * membersPerPage, currentPage * membersPerPage);
    
    if (e.target.checked) {
        paginatedMembers.forEach(member => selectedMembers.add(member.id));
    } else {
        paginatedMembers.forEach(member => selectedMembers.delete(member.id));
    }

    renderTable();
}

function updateBulkActions() {
    if (selectedMembers.size > 0) {
        bulkActionsBar.style.display = "flex";
        bulkCount.textContent = selectedMembers.size;
    } else {
        bulkActionsBar.style.display = "none";
    }
}

function clearSelection() {
    selectedMembers.clear();
    selectAllCheckbox.checked = false;
    renderTable();
}

function bulkDelete() {
    if (selectedMembers.size === 0) return;
    showToast("success", "Bulk Delete", `${selectedMembers.size} members deleted successfully!`);
    selectedMembers.forEach(id => {
        const index = allMembers.findIndex(m => m.id === id);
        if (index > -1) allMembers.splice(index, 1);
    });
    selectedMembers.clear();
    filterMembers();
}

// ==================== MODALS ====================

// Detail Modal
function openDetailModal(memberId) {
    const member = allMembers.find(m => m.id === memberId);
    if (!member) return;

    currentEditingMemberId = memberId;

    // Populate header
    document.getElementById("detailAvatar").style.background = `linear-gradient(135deg, ${colorGradients[member.avatarColor]})`;
    document.getElementById("detailAvatar").textContent = getMemberInitials(member.name);
    document.getElementById("detailName").textContent = member.name;
    document.getElementById("detailEmail").textContent = member.email;

    // Overview tab
    document.getElementById("infoEmail").textContent = member.email;
    document.getElementById("infoJoined").textContent = formatDate(member.joinedDate);
    document.getElementById("infoLastActive").textContent = formatDate(member.lastActive);
    document.getElementById("infoMemberId").textContent = member.memberId;
    document.getElementById("infoRole").textContent = member.role === "admin" ? "Administrator" : "Member";
    document.getElementById("infoBorrowedCount").textContent = member.totalBorrowed;
    document.getElementById("infoActiveBorrow").textContent = member.activeBorrowings;
    document.getElementById("infoReturnRate").textContent = "95%";
    document.getElementById("memberSinceText").textContent = `Member since ${formatDate(member.joinedDate)}`;

    // Current books
    document.getElementById("currentBooksList").innerHTML = member.activeBorrowings > 0 ? 
        `<div class="book-item"><div class="book-title">The Great Gatsby</div><div class="book-due">Due: May 20, 2025</div></div>
         <div class="book-item"><div class="book-title">Clean Code</div><div class="book-due urgent">Overdue by 2 days</div></div>` :
        '<p class="no-data">No active borrowings</p>';

    // Reset tabs
    document.querySelectorAll(".detail-tab-pane").forEach(pane => pane.classList.remove("active"));
    document.getElementById("tab-overview").classList.add("active");
    document.querySelectorAll(".detail-tab").forEach(tab => tab.classList.remove("active"));
    document.querySelector('[data-tab="overview"]').classList.add("active");

    memberDetailOverlay.style.display = "flex";
    document.body.style.overflow = "hidden";
}

function closeDetailModal() {
    memberDetailOverlay.style.display = "none";
    document.body.style.overflow = "auto";
    currentEditingMemberId = null;
}

function switchDetailTab(tabName) {
    document.querySelectorAll(".detail-tab-pane").forEach(pane => pane.classList.remove("active"));
    document.querySelectorAll(".detail-tab").forEach(tab => tab.classList.remove("active"));
    
    document.getElementById(`tab-${tabName}`).classList.add("active");
    document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");
}

// Add Member Modal
function openAddMemberModal() {
    document.getElementById("addMemberForm").reset();
    document.getElementById("memberNotesCount").textContent = "0";
    document.getElementById("memberId").value = generateMemberId();
    document.getElementById("memberPassword").value = "";
    document.getElementById("confirmPassword").value = "";
    document.querySelectorAll(".color-swatch").forEach((s, i) => {
        s.classList.toggle("active", i === 0);
    });
    document.getElementById("roleWarning").style.display = "none";
    addMemberOverlay.style.display = "flex";
    document.body.style.overflow = "hidden";
}

function closeAddMemberModal() {
    addMemberOverlay.style.display = "none";
    document.body.style.overflow = "auto";
}

// Edit Member Modal
function openEditMemberModal(memberId) {
    const member = allMembers.find(m => m.id === memberId);
    if (!member) return;

    currentEditingMemberId = memberId;

    document.getElementById("editMemberName").value = member.name;
    document.getElementById("editMemberId").value = member.memberId;
    document.getElementById("editMemberEmail").value = member.email;
    document.getElementById("editMemberPhone").value = member.phone;
    document.getElementById("editMemberNotes").value = member.notes || "";
    document.getElementById("editMemberNotesCount").textContent = (member.notes || "").length;
    document.getElementById("changePasswordCheckbox").checked = false;
    document.getElementById("passwordChangeFields").style.display = "none";

    editMemberOverlay.style.display = "flex";
    document.body.style.overflow = "hidden";
}

function closeEditMemberModal() {
    editMemberOverlay.style.display = "none";
    document.body.style.overflow = "auto";
    currentEditingMemberId = null;
}

// Delete Member Modal
function openDeleteModal(memberId) {
    const member = allMembers.find(m => m.id === memberId);
    if (!member) return;

    currentEditingMemberId = memberId;
    document.getElementById("deleteMemberName").textContent = member.name;
    document.getElementById("deleteMemberEmail").textContent = member.email;
    document.getElementById("deleteActiveWarning").style.display = member.activeBorrowings > 0 ? "block" : "none";
    document.getElementById("activeBorrowCount").textContent = member.activeBorrowings;
    document.getElementById("confirmDeleteMemberBtn").disabled = member.activeBorrowings > 0;

    deleteMemberOverlay.style.display = "flex";
    document.body.style.overflow = "hidden";
}

function closeDeleteModal() {
    deleteMemberOverlay.style.display = "none";
    document.body.style.overflow = "auto";
    currentEditingMemberId = null;
}

// ==================== FORM SUBMISSION ====================
async function handleAddMember(e) {
    e.preventDefault();

    const name = document.getElementById("memberName").value.trim();
    const email = document.getElementById("memberEmail").value.trim();
    const phone = document.getElementById("memberPhone").value.trim();
    const password = document.getElementById("memberPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const role = document.querySelector('input[name="role"]:checked').value;
    const notes = document.getElementById("memberNotes").value;
    const memberId = document.getElementById("memberId").value;
    const avatarColor = document.querySelector(".color-swatch.active").dataset.color;

    // Validate
    if (!name || !email || !password || !confirmPassword) {
        showToast("error", "Validation Error", "Please fill in all required fields");
        return;
    }

    if (password !== confirmPassword) {
        showToast("error", "Validation Error", "Passwords do not match");
        return;
    }

    if (password.length < 6) {
        showToast("error", "Validation Error", "Password must be at least 6 characters");
        return;
    }

    // Check email uniqueness
    if (allMembers.some(m => m.email === email)) {
        showToast("error", "Validation Error", "Email already exists");
        return;
    }

    // Create member in Firestore
    try {
        const normalizedEmail = normalizeEmail(email);
        const passwordSalt = generatePasswordSalt();
        const passwordHash = await hashPassword(password, passwordSalt);

        const newMember = {
            memberId,
            name,
            displayName: name,
            email: normalizedEmail,
            emailLower: normalizedEmail,
            phone,
            role,
            notes,
            avatarColor,
            joinedDate: new Date(),
            lastActive: new Date(),
            totalBorrowed: 0,
            activeBorrowings: 0,
            status: "active",
            passwordSalt,
            passwordHash,
            authProvider: 'local',
            authUid: null,
            createdBy: (localStorage.getItem('userId') || null)
        };

        await db.collection('users').add(newMember);
        showToast("success", "Member Added", `${name} has been added successfully!`);
        closeAddMemberModal();
        await loadMembers();
    } catch (error) {
        showToast("error", "Add Error", "Failed to add member to database.");
    }
}

async function handleEditMember(e) {
    e.preventDefault();

    const member = allMembers.find(m => m.id === currentEditingMemberId);
    if (!member) return;

    const name = document.getElementById("editMemberName").value.trim();
    const email = document.getElementById("editMemberEmail").value.trim();
    const phone = document.getElementById("editMemberPhone").value.trim();
    const notes = document.getElementById("editMemberNotes").value;
    const changePassword = document.getElementById("changePasswordCheckbox").checked;

    // Validate
    if (!name || !email) {
        showToast("error", "Validation Error", "Please fill in all required fields");
        return;
    }

    if (changePassword) {
        const password = document.getElementById("editPassword").value;
        const confirmPassword = document.getElementById("confirmEditPassword").value;

        if (!password || !confirmPassword) {
            showToast("error", "Validation Error", "Please fill in password fields");
            return;
        }

        if (password !== confirmPassword) {
            showToast("error", "Validation Error", "Passwords do not match");
            return;
        }

        if (password.length < 6) {
            showToast("error", "Validation Error", "Password must be at least 6 characters");
            return;
        }
    }

    // Check email uniqueness (excluding current member)
    if (email !== member.email && allMembers.some(m => m.email === email && m.id !== member.id)) {
        showToast("error", "Validation Error", "Email already exists");
        return;
    }

    // Update member in Firestore
    try {
        const updateData = {
            name,
            displayName: name,
            email: normalizeEmail(email),
            emailLower: normalizeEmail(email),
            phone,
            notes
        };

        if (changePassword) {
            const password = document.getElementById("editPassword").value;
            const passwordSalt = generatePasswordSalt();
            const passwordHash = await hashPassword(password, passwordSalt);
            updateData.passwordSalt = passwordSalt;
            updateData.passwordHash = passwordHash;
            updateData.authProvider = 'local';
        }

        await db.collection('users').doc(member.id).update(updateData);
        showToast("success", "Member Updated", `${name} has been updated successfully!`);
        closeEditMemberModal();
        await loadMembers();
    } catch (error) {
        showToast("error", "Update Error", "Failed to update member in database.");
    }
}

async function handleDeleteMember() {
    const member = allMembers.find(m => m.id === currentEditingMemberId);
    if (!member) return;

    if (member.activeBorrowings > 0) {
        showToast("error", "Delete Failed", "Member has active borrowings");
        return;
    }

    try {
        await db.collection('users').doc(member.id).delete();
        showToast("success", "Member Deleted", `${member.name} has been deleted successfully!`);
        closeDeleteModal();
        await loadMembers();
    } catch (error) {
        showToast("error", "Delete Error", "Failed to delete member from database.");
    }
}

// ==================== STATS ====================
function updateStats() {
    const total = allMembers.length;
    const active = allMembers.filter(m => m.activeBorrowings > 0).length;
    const newThisMonth = allMembers.filter(m => {
        const now = new Date();
        const joined = new Date(m.joinedDate);
        return joined.getMonth() === now.getMonth() && joined.getFullYear() === now.getFullYear();
    }).length;
    const overdue = allMembers.filter(m => m.status === "overdue").length;

    // Animate numbers
    animateCounter(document.getElementById("totalMembersCount"), total);
    animateCounter(document.getElementById("activeBorrowersCount"), active);
    animateCounter(document.getElementById("newThisMonthCount"), newThisMonth);
    animateCounter(document.getElementById("overdueCount"), overdue);
}

function animateCounter(element, target) {
    const current = parseInt(element.textContent) || 0;
    const increment = target / 30;
    let count = 0;

    const timer = setInterval(() => {
        count += increment;
        if (count >= target) {
            element.textContent = target;
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(count);
        }
    }, 30);
}

function updateOverdueSection() {
    const overdueMembers = allMembers.filter(m => m.status === "overdue");
    const section = document.getElementById("overdueSection");

    if (overdueMembers.length === 0) {
        section.style.display = "none";
    } else {
        section.style.display = "block";
        document.getElementById("overdueCountBadge").textContent = overdueMembers.length;

        const overdueList = document.getElementById("overdueList");
        overdueList.innerHTML = overdueMembers.map(member => `
            <div class="overdue-item">
                <div class="overdue-member-info">
                    <div class="overdue-avatar" style="background: linear-gradient(135deg, ${colorGradients[member.avatarColor]});">
                        ${getMemberInitials(member.name)}
                    </div>
                    <div class="overdue-member-details">
                        <div class="overdue-member-name">${escapeHtml(member.name)}</div>
                        <div class="overdue-member-email">${escapeHtml(member.email)}</div>
                        <div class="overdue-book-info">
                            <span class="overdue-book-title">The Alchemist</span> - <span class="overdue-days">3 days overdue</span>
                        </div>
                    </div>
                </div>
                <div class="overdue-buttons">
                    <button class="overdue-btn" onclick="showToast('success', 'Reminder Sent', 'Reminder sent to ${member.name}')">Send Reminder</button>
                    <button class="overdue-btn" onclick="showToast('success', 'Updated', 'Marked as returned')">Mark Returned</button>
                </div>
            </div>
        `).join("");
    }
}

// ==================== EXPORT ====================
function exportMembers() {
    const csv = [
        ["Name", "Email", "Member ID", "Joined", "Total Borrowed", "Status"],
        ...filteredMembers.map(m => [
            m.name,
            m.email,
            m.memberId,
            formatDate(m.joinedDate),
            m.totalBorrowed,
            getStatusLabel(m.status)
        ])
    ];

    const csvContent = csv.map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `city-library-members-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    showToast("success", "Export", "Members list exported successfully!");
}

// ==================== UTILITIES ====================
function generateMemberId() {
    const id = String(nextMemberId).padStart(4, "0");
    nextMemberId++;
    return `#MBR-${id}`;
}

function formatDate(date) {
    const options = { year: "numeric", month: "short", day: "numeric" };
    let parsedDate = date;

    if (date && typeof date.toDate === "function") {
        parsedDate = date.toDate();
    }

    const result = new Date(parsedDate);
    if (isNaN(result)) {
        return "Unknown Date";
    }

    return result.toLocaleDateString("en-US", options);
}

function getTimeAgo(date) {
    let parsedDate = date;
    if (date && typeof date.toDate === "function") {
        parsedDate = date.toDate();
    }

    const targetDate = new Date(parsedDate);
    if (isNaN(targetDate)) {
        return "Unknown";
    }

    const now = new Date();
    const diff = now - targetDate;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
}

function getStatusLabel(status) {
    const labels = {
        "active": "Active",
        "overdue": "Overdue",
        "no-borrowings": "No Borrowings",
        "new": "New Member"
    };
    return labels[status] || status;
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function updatePasswordStrength(password) {
    const fill = document.getElementById("strengthFill");
    const text = document.getElementById("strengthText");
    let strength = 0;

    if (password.length >= 6) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z\d]/.test(password)) strength++;

    const percentage = (strength / 4) * 100;
    fill.style.width = percentage + "%";

    if (strength <= 1) {
        text.textContent = "Weak";
        text.className = "strength-text weak";
    } else if (strength <= 2) {
        text.textContent = "Medium";
        text.className = "strength-text medium";
    } else {
        text.textContent = "Strong";
        text.className = "strength-text strong";
    }
}

function togglePasswordVisibility(input) {
    if (input.type === "password") {
        input.type = "text";
    } else {
        input.type = "password";
    }
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
        if (memberDetailOverlay.style.display !== "none") closeDetailModal();
        if (addMemberOverlay.style.display !== "none") closeAddMemberModal();
        if (editMemberOverlay.style.display !== "none") closeEditMemberModal();
        if (deleteMemberOverlay.style.display !== "none") closeDeleteModal();
    }
});

// ==================== CLOSE MODAL ON OVERLAY CLICK ====================
[memberDetailOverlay, addMemberOverlay, editMemberOverlay, deleteMemberOverlay].forEach(modal => {
    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            if (modal === memberDetailOverlay) closeDetailModal();
            if (modal === addMemberOverlay) closeAddMemberModal();
            if (modal === editMemberOverlay) closeEditMemberModal();
            if (modal === deleteMemberOverlay) closeDeleteModal();
        }
    });
});
