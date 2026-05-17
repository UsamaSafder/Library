// ==================== MEMBER LOOKUP HELPER ====================
function findMemberByBorrowing(borrowing) {
    // Try to match by all possible fields
    const member = membersData.find(m =>
        (m.id && m.id === borrowing.userId) ||
        (m.memberId && m.memberId === borrowing.userId) ||
        (m.authUid && m.authUid === borrowing.userId) ||
        (m.email && m.email === borrowing.userEmail)
    );
    if (!member) return { name: 'Unknown Member', email: '', avatar: 'U' };
    const name = (typeof member.name === 'string' && member.name.trim()) ? member.name.trim() : (typeof member.email === 'string' ? member.email : 'Unknown Member');
    return {
        name,
        email: member.email || '',
        avatar: name.charAt(0).toUpperCase() || 'U'
    };
}
// ==================== DYNAMIC DATA (FIRESTORE) ====================
let borrowingsData = [];
let membersData = [];
let booksData = [];
let genreData = [];
let inventoryData = [];
let topBooks = [];
let borrowingActivityData = [];
let dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Fetch all dashboard data from Firestore
async function fetchDashboardData() {
    if (!window.db) {
        throw new Error('Firestore is not initialized. Check firebase-config.js and the Firebase SDK script order.');
    }

    // Fetch books
    const booksSnap = await db.collection('books').get();
    booksData = booksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Fetch members
    const membersSnap = await db.collection('users').get();
    membersData = membersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Fetch borrowings
    const borrowingsSnap = await db.collection('borrowings').get();
    borrowingsData = borrowingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Calculate genre stats
    const genreMap = {};
    booksData.forEach(book => {
        if (!genreMap[book.genre]) genreMap[book.genre] = 0;
        genreMap[book.genre] += book.totalCopies || 1;
    });
    const totalBooks = booksData.reduce((sum, b) => sum + (b.totalCopies || 1), 0);
    genreData = Object.entries(genreMap).map(([genre, count]) => ({
        genre,
        count,
        percentage: totalBooks ? Math.round((count / totalBooks) * 100) : 0
    }));

    // Inventory data
    inventoryData = Object.entries(genreMap).map(([genre, count]) => {
        const available = booksData.filter(b => b.genre === genre).reduce((sum, b) => sum + (b.available || 0), 0);
        const borrowed = count - available;
        let status = "good";
        const rate = available / count;
        if (rate <= 0.2) status = "critical";
        else if (rate <= 0.5) status = "low";
        return { genre, total: count, available, borrowed, status };
    });

    // Top books (by borrow count)
    const bookBorrowCounts = {};
    borrowingsData.forEach(b => {
        if (!bookBorrowCounts[b.bookId]) bookBorrowCounts[b.bookId] = 0;
        bookBorrowCounts[b.bookId]++;
    });
    topBooks = booksData
        .map(b => ({
            title: b.title,
            author: b.author,
            count: bookBorrowCounts[b.id] || 0
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    // Borrowing activity (last 7 days)
    const today = new Date();
    borrowingActivityData = Array(7).fill(0);
    borrowingsData.forEach(b => {
        if (b.borrowedDate) {
            const date = b.borrowedDate.toDate ? b.borrowedDate.toDate() : new Date(b.borrowedDate);
            const diff = Math.floor((today - date) / (1000 * 60 * 60 * 24));
            if (diff >= 0 && diff < 7) {
                borrowingActivityData[6 - diff]++;
            }
        }
    });
}

// ==================== DOM ELEMENTS ====================
const pageLoader = document.getElementById("pageLoader");
const accessDenied = document.getElementById("accessDenied");
const sidebar = document.getElementById("sidebar");
const hamburger = document.getElementById("hamburger");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const sidebarClose = document.getElementById("sidebarClose");
const logoutBtn = document.getElementById("logoutBtn");
const logoutDropdown = document.getElementById("logoutDropdown");
const notificationBell = document.getElementById("notificationBell");
const notificationDropdown = document.getElementById("notificationDropdown");
const adminAvatarBtn = document.getElementById("adminAvatarBtn");
const adminDropdown = document.getElementById("adminDropdown");
const borrowingsTableBody = document.getElementById("borrowingsTableBody");
const topBooksList = document.getElementById("topBooksList");
const overdueList = document.getElementById("overdueList");
const membersList = document.getElementById("membersList");
const inventoryTableBody = document.getElementById("inventoryTableBody");
const chartBars = document.getElementById("chartBars");
const chartLabels = document.getElementById("chartLabels");
const chartLegend = document.getElementById("chartLegend");

// ==================== PAGE INITIALIZATION ====================
document.addEventListener("DOMContentLoaded", async () => {
    // Check for demo mode first
    if (localStorage.getItem('demoMode') === 'true') {
        const user = {
            uid: localStorage.getItem('userId'),
            email: localStorage.getItem('userEmail'),
            displayName: localStorage.getItem('userDisplayName')
        };
        pageLoader.style.display = "none";
        initializeDashboard(user);
        return;
    }

    const sessionUser = getSessionUser();
    if (!sessionUser) {
        window.location.href = "login.html";
        return;
    }

    try {
        const userDoc = await firebase.firestore().collection("users").doc(sessionUser.uid).get();
        if (!userDoc.exists || userDoc.data().role !== "admin") {
            pageLoader.style.display = "none";
            accessDenied.style.display = "flex";
            return;
        }
    } catch (error) {
        console.error("Error checking admin status:", error);
        pageLoader.style.display = "none";
        accessDenied.style.display = "flex";
        return;
    }

    pageLoader.style.display = "none";
    initializeDashboard(sessionUser);
});

function initializeDashboard(user) {
    // Set user info
    const userName = user.displayName || "Admin";
    const initials = userName.charAt(0).toUpperCase();
    const userNameElem = document.getElementById("userName");
    const userAvatarElem = document.getElementById("userAvatar");
    const adminInitialsElem = document.getElementById("adminInitials");
    if (userNameElem) userNameElem.textContent = userName;
    if (userAvatarElem) userAvatarElem.textContent = initials;
    if (adminInitialsElem) adminInitialsElem.textContent = initials;

    // Initialize features
    setGreeting();
    setBannerDate();
    fetchDashboardData()
        .then(() => {
            loadStatsCards();
            renderBorrowingChart();
            renderDonutChart();
            populateBorrowingsTable();
            populateTopBooks();
            populateOverdueAlerts();
            populateNewMembers();
            populateInventoryTable();
        })
        .catch((error) => {
            console.error('Dashboard fetch failed:', error);
            showToast('error', 'Load Error', `Failed to load dashboard data. ${error.message}`);
        });
    // Setup event listeners
    setupEventListeners();
}

function setupEventListeners() {
    // Sidebar toggle
    hamburger.addEventListener("click", () => {
        sidebar.classList.toggle("open");
        sidebarOverlay.classList.toggle("open");
    });

    sidebarClose.addEventListener("click", () => {
        sidebar.classList.remove("open");
        sidebarOverlay.classList.remove("open");
    });

    sidebarOverlay.addEventListener("click", () => {
        sidebar.classList.remove("open");
        sidebarOverlay.classList.remove("open");
    });

    // Close sidebar when menu item clicked
    document.querySelectorAll(".menu-item").forEach(item => {
        item.addEventListener("click", () => {
            if (window.innerWidth <= 1024) {
                sidebar.classList.remove("open");
                sidebarOverlay.classList.remove("open");
            }
        });
    });

    // Notification bell
    notificationBell.addEventListener("click", (e) => {
        e.stopPropagation();
        notificationDropdown.style.display = notificationDropdown.style.display === "none" ? "block" : "none";
        adminDropdown.style.display = "none";
    });

    // Admin avatar
    adminAvatarBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        adminDropdown.style.display = adminDropdown.style.display === "none" ? "block" : "none";
        notificationDropdown.style.display = "none";
    });

    // Close dropdowns on outside click
    document.addEventListener("click", () => {
        notificationDropdown.style.display = "none";
        adminDropdown.style.display = "none";
    });

    // Logout buttons
    logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        handleLogout();
    });

    logoutDropdown.addEventListener("click", handleLogout);

    // Quick action buttons
    document.getElementById("generateReportBtn").addEventListener("click", () => {
        showToast("Report generation started!", "success");
    });

    document.getElementById("sendNoticeBtn").addEventListener("click", () => {
        showToast("Notice sent to members with overdue books!", "success");
    });
}

// ==================== GREETING ====================
function setGreeting() {
    const hour = new Date().getHours();
    let greeting = "Good Night";
    if (hour >= 5 && hour < 12) greeting = "Good Morning";
    else if (hour >= 12 && hour < 17) greeting = "Good Afternoon";
    else if (hour >= 17 && hour < 21) greeting = "Good Evening";

    const userName = document.getElementById("userName").textContent;
    document.getElementById("greeting").textContent = `${greeting}, ${userName}! 👋`;
}

function setBannerDate() {
    const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
    const today = new Date().toLocaleDateString("en-US", options);
    document.getElementById("bannerDate").textContent = today;
}

// ==================== STATS COUNTER ANIMATION ====================
function loadStatsCards() {
    animateCounter(document.getElementById("totalBooksCount"), booksData.length, 1500);
    animateCounter(document.getElementById("totalMembersCount"), membersData.length, 1500);
    const activeBorrowings = borrowingsData.filter(b => b.status === "active").length;
    animateCounter(document.getElementById("activeBorrowingsCount"), activeBorrowings, 1500);
    const returnedToday = borrowingsData.filter(b => {
        if (!b.returnedDate) return false;
        const d = b.returnedDate.toDate ? b.returnedDate.toDate() : new Date(b.returnedDate);
        const now = new Date();
        return d.toDateString() === now.toDateString();
    }).length;
    animateCounter(document.getElementById("returnedTodayCount"), returnedToday, 1500);
}

function animateCounter(element, target, duration) {
    let start = 0;
    const increment = target / (duration / 16);
    let current = start;

    const counter = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target.toLocaleString();
            clearInterval(counter);
        } else {
            element.textContent = Math.floor(current).toLocaleString();
        }
    }, 16);
}

// ==================== BAR CHART ====================
function renderBorrowingChart() {
    const maxValue = Math.max(...borrowingActivityData, 1);

    // Clear existing bars
    chartBars.innerHTML = "";
    chartLabels.innerHTML = "";

    borrowingActivityData.forEach((value, index) => {
        const barHeight = (value / maxValue) * 100;

        // Bar
        const bar = document.createElement("div");
        bar.className = "bar";
        bar.style.height = barHeight + "%";

        const tooltip = document.createElement("div");
        tooltip.className = "bar-tooltip";
        tooltip.textContent = value + " borrows";
        bar.appendChild(tooltip);

        chartBars.appendChild(bar);

        // Label
        const label = document.createElement("div");
        label.textContent = dayLabels[index];
        chartLabels.appendChild(label);
    });
}

// ==================== DONUT CHART ====================
function renderDonutChart() {
    // Calculate donut gradient
    let gradientString = "conic-gradient(";
    let currentAngle = 0;

    genreData.forEach((item, index) => {
        const angle = (item.percentage / 100) * 360;
        const colors = [
            "#667eea",
            "#4facfe",
            "#43e97b",
            "#f7971e",
            "#f5576c",
            "#a0aec0"
        ];
        
        gradientString += colors[index] + " " + currentAngle + "deg " + (currentAngle + angle) + "deg";
        if (index < genreData.length - 1) gradientString += ", ";
        currentAngle += angle;
    });

    gradientString += ")";
    document.getElementById("donutChart").style.background = gradientString;

    // Render legend
    chartLegend.innerHTML = "";
    genreData.forEach((item, index) => {
        const colors = ["#667eea", "#4facfe", "#43e97b", "#f7971e", "#f5576c", "#a0aec0"];
        const legendItem = document.createElement("div");
        legendItem.className = "legend-item";
        legendItem.innerHTML = `
            <div class="legend-color" style="background: ${colors[index]}"></div>
            <div class="legend-label">${item.genre}</div>
            <div class="legend-value">${item.percentage}%</div>
        `;
        chartLegend.appendChild(legendItem);
    });
}

// ==================== TABLE POPULATION ====================
function populateBorrowingsTable() {
    borrowingsTableBody.innerHTML = "";
    borrowingsData.forEach(borrowing => {
        const row = document.createElement("tr");
        if (borrowing.status === "overdue") row.classList.add("overdue");
        const statusClass = `status-badge ${borrowing.status}`;
        const statusText = borrowing.status ? borrowing.status.charAt(0).toUpperCase() + borrowing.status.slice(1) : "";
        const member = findMemberByBorrowing(borrowing);
        const book = booksData.find(b => b.id === borrowing.bookId) || {};
        row.innerHTML = `
            <td>
                <div class="member-cell">
                    <div class="member-avatar">${member.avatar}</div>
                    <div class="member-name">${member.name}</div>
                </div>
            </td>
            <td>
                <div class="book-info">
                    <span>${book.title || "Unknown"}</span>
                    <span class="genre-mini-badge">${book.genre || ""}</span>
                </div>
            </td>
            <td>${borrowing.borrowedDate ? (borrowing.borrowedDate.toDate ? borrowing.borrowedDate.toDate().toLocaleDateString() : new Date(borrowing.borrowedDate).toLocaleDateString()) : ""}</td>
            <td>${borrowing.dueDate ? (borrowing.dueDate.toDate ? borrowing.dueDate.toDate().toLocaleDateString() : new Date(borrowing.dueDate).toLocaleDateString()) : ""}</td>
            <td><span class="${statusClass}">${statusText}</span></td>
            <td><button class="action-btn">View</button></td>
        `;
        borrowingsTableBody.appendChild(row);
    });
}

function populateTopBooks() {
    topBooksList.innerHTML = "";
    const maxCount = topBooks.length > 0 ? topBooks[0].count : 1;
    topBooks.forEach((book, index) => {
        const percentage = maxCount ? (book.count / maxCount) * 100 : 0;
        const item = document.createElement("div");
        item.className = "book-rank-item";
        item.innerHTML = `
            <div class="rank-number">${index + 1}</div>
            <div class="book-rank-info">
                <div class="book-rank-title">${book.title}</div>
                <div class="book-rank-author">by ${book.author}</div>
                <div class="progress-wrapper">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${percentage}%"></div>
                    </div>
                    <div class="progress-label">${book.count} times borrowed</div>
                </div>
            </div>
        `;
        topBooksList.appendChild(item);
    });
}

function populateOverdueAlerts() {
    const overdueItems = borrowingsData.filter(b => b.status === "overdue");
    overdueList.innerHTML = "";
    if (overdueItems.length === 0) {
        overdueList.innerHTML = '<div class="alert-no-issue">✓ All books returned on time!</div>';
        document.getElementById("overdueCount").textContent = "0";
        return;
    }
    document.getElementById("overdueCount").textContent = overdueItems.length;
    overdueItems.forEach(item => {
        const member = findMemberByBorrowing(item);
        const book = booksData.find(b => b.id === item.bookId) || {};
        const alertDiv = document.createElement("div");
        alertDiv.className = "alert-item";
        alertDiv.innerHTML = `
            <div class="alert-content">
                <div class="alert-title">${book.title || "Unknown"} by ${member.name || "Unknown"}</div>
                <div class="alert-message">Overdue</div>
            </div>
            <div class="alert-actions">
                <button class="action-btn-sm">Remind</button>
                <button class="action-btn-sm">Return</button>
            </div>
        `;
        overdueList.appendChild(alertDiv);
    });
}

function populateNewMembers() {
    membersList.innerHTML = "";
    // Show 5 most recent members
    const sorted = [...membersData].sort((a, b) => {
        const d1 = a.joinedDate ? (a.joinedDate.toDate ? a.joinedDate.toDate() : new Date(a.joinedDate)) : new Date();
        const d2 = b.joinedDate ? (b.joinedDate.toDate ? b.joinedDate.toDate() : new Date(b.joinedDate)) : new Date();
        return d2 - d1;
    }).slice(0, 5);
    sorted.forEach(member => {
        const memberDiv = document.createElement("div");
        memberDiv.className = "member-list-item";
        memberDiv.innerHTML = `
            <div class="member-list-info">
                <div class="member-list-name">${member.name}</div>
                <div class="member-list-email">${member.email}</div>
                <div class="member-list-date">Joined: ${member.joinedDate ? (member.joinedDate.toDate ? member.joinedDate.toDate().toLocaleDateString() : new Date(member.joinedDate).toLocaleDateString()) : ""}</div>
            </div>
            <button class="action-btn">View</button>
        `;
        membersList.appendChild(memberDiv);
    });
}

function populateInventoryTable() {
    inventoryTableBody.innerHTML = "";
    inventoryData.forEach(item => {
        const availabilityRate = ((item.available / item.total) * 100).toFixed(0);
        let statusClass = "good";
        let statusText = "Good";
        if (availabilityRate <= 20) {
            statusClass = "critical";
            statusText = "Critical";
        } else if (availabilityRate <= 50) {
            statusClass = "warning";
            statusText = "Low Stock";
        }
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${item.genre}</td>
            <td>${item.total}</td>
            <td>${item.available}</td>
            <td>${item.borrowed}</td>
            <td>
                <div class="availability-bar">
                    <div class="availability-fill" style="width: ${availabilityRate}%"></div>
                </div>
                <small>${availabilityRate}%</small>
            </td>
            <td>
                <div class="status-cell">
                    <div class="status-dot ${statusClass}"></div>
                    <span>${statusText}</span>
                </div>
            </td>
        `;
        inventoryTableBody.appendChild(row);
    });
}

// ==================== LOGOUT ====================
function handleLogout() {
    // Clear demo mode if active
    localStorage.removeItem('demoMode');
    logoutAndRedirect();
}

// ==================== TOAST NOTIFICATIONS ====================
function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("hide");
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ==================== RESPONSIVE SIDEBAR ====================
window.addEventListener("resize", () => {
    if (window.innerWidth > 1024) {
        sidebar.classList.remove("open");
        sidebarOverlay.classList.remove("open");
    }
});
