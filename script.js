/**
 * CSE - Section E Academic Portal
 * Real-time event handling, countdown timers, search & filtering, and local persistence.
 */

// Storage Key
const STORAGE_KEY = 'csee_important_dates_v1';

// Initial default dates generator (relative to current date for realistic preview)
function getDefaultEvents() {
  const today = new Date();

  function offsetDate(days) {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  return [
    {
      id: 'evt-1',
      title: 'Operating Systems - Mid Term Exam',
      category: 'exam',
      priority: 'high',
      date: offsetDate(2),
      time: '10:00',
      location: 'LH-301 & LH-302',
      description: 'Covers Units 1 to 3 (Processes, CPU Scheduling, Synchronization). Bring physical ID card and scientific calculator.'
    },
    {
      id: 'evt-2',
      title: 'Database Systems Lab Submission',
      category: 'assignment',
      priority: 'high',
      date: offsetDate(4),
      time: '23:59',
      location: 'Google Classroom',
      description: 'Submit normalized ER schemas, SQL queries, and PL/SQL procedures report with execution screenshots.'
    },
    {
      id: 'evt-3',
      title: 'Web Dev & Cloud Mini-Project Review',
      category: 'project',
      priority: 'medium',
      date: offsetDate(7),
      time: '14:30',
      location: 'Software Lab 3',
      description: 'Phase 1 Review: Architecture diagram, GitHub repository link, and live demonstration of REST API endpoints.'
    },
    {
      id: 'evt-4',
      title: 'National Hackathon Registration Deadline',
      category: 'event',
      priority: 'medium',
      date: offsetDate(10),
      time: '18:00',
      location: 'Online Portal',
      description: 'Team registration for Smart India Hackathon internal university shortlist. Minimum 4 members per team.'
    },
    {
      id: 'evt-5',
      title: 'Computer Networks - Unit Test 2',
      category: 'exam',
      priority: 'medium',
      date: offsetDate(14),
      time: '11:30',
      location: 'Classroom 405',
      description: 'Topics: Data Link Layer protocols, CRC error detection, Sliding Window, and IPv4 subnetting.'
    },
    {
      id: 'evt-6',
      title: 'Semester Mid-Term Break / Festival Holiday',
      category: 'holiday',
      priority: 'low',
      date: offsetDate(20),
      time: '',
      location: 'Campus Closed',
      description: 'University holidays for festive week. Library and labs remain closed.'
    }
  ];
}

// State Management
let events = [];
let currentCategory = 'all';
let searchQuery = '';
let currentSort = 'date-asc';
let currentView = 'grid'; // 'grid' | 'timeline'

// DOM Elements
const eventsGrid = document.getElementById('eventsGrid');
const eventsTimeline = document.getElementById('eventsTimeline');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearch');
const categoryPills = document.getElementById('categoryPills');
const sortSelect = document.getElementById('sortSelect');
const gridViewBtn = document.getElementById('gridViewBtn');
const timelineViewBtn = document.getElementById('timelineViewBtn');
const openAddModalBtn = document.getElementById('openAddModalBtn');
const eventModal = document.getElementById('eventModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const eventForm = document.getElementById('eventForm');
const modalTitle = document.getElementById('modalTitle');
const toastNotification = document.getElementById('toastNotification');
const announcementBar = document.getElementById('announcementBar');
const closeAnnouncement = document.getElementById('closeAnnouncement');
const restoreDefaultsBtn = document.getElementById('restoreDefaultsBtn');
const exportDatesBtn = document.getElementById('exportDatesBtn');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');

// Stat Counters
const statDueSoon = document.getElementById('statDueSoon');
const statExams = document.getElementById('statExams');
const statAssignments = document.getElementById('statAssignments');
const statTotal = document.getElementById('statTotal');

// Clock Elements
const liveClock = document.getElementById('liveClock');
const liveDate = document.getElementById('liveDate');

// Init
function init() {
  loadEvents();
  setupEventListeners();
  startClock();
  render();
}

// Load Events from LocalStorage
function loadEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      events = JSON.parse(raw);
    } else {
      events = getDefaultEvents();
      saveEvents();
    }
  } catch (e) {
    console.error('Failed to parse stored events, resetting to defaults', e);
    events = getDefaultEvents();
  }
}

// Save Events to LocalStorage
function saveEvents() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

// Live Clock
function startClock() {
  function updateTime() {
    const now = new Date();
    liveClock.textContent = now.toLocaleTimeString('en-US', { hour12: false });
    liveDate.textContent = now.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
  updateTime();
  setInterval(updateTime, 1000);
}

// Toast Helper
function showToast(message) {
  toastNotification.textContent = message;
  toastNotification.classList.add('show');
  setTimeout(() => {
    toastNotification.classList.remove('show');
  }, 3200);
}

// Calculate Days Remaining
function getCountdownData(dateString) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const eventDate = new Date(dateString);
  eventDate.setHours(0, 0, 0, 0);

  const diffTime = eventDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { text: `${Math.abs(diffDays)}d ago`, class: 'overdue', days: diffDays };
  } else if (diffDays === 0) {
    return { text: 'Today!', class: 'today urgent', days: diffDays };
  } else if (diffDays === 1) {
    return { text: 'Tomorrow', class: 'urgent', days: diffDays };
  } else if (diffDays <= 5) {
    return { text: `${diffDays} days left`, class: 'urgent', days: diffDays };
  } else {
    return { text: `${diffDays} days left`, class: '', days: diffDays };
  }
}

// Format Human Readable Date
function formatDate(dateString) {
  const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
  const d = new Date(dateString + 'T00:00:00');
  return d.toLocaleDateString('en-US', options);
}

// Format Time (12hr)
function formatTime(timeString) {
  if (!timeString) return '';
  const [hours, minutes] = timeString.split(':');
  const h = parseInt(hours, 10);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${minutes} ${suffix}`;
}

// Helper: Escape HTML
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Generate Google Calendar Link
function getGoogleCalendarUrl(event) {
  const title = encodeURIComponent(event.title);
  const details = encodeURIComponent(event.description || '');
  const location = encodeURIComponent(event.location || '');

  // Dates formatting
  const dateFormatted = event.date.replace(/-/g, '');
  let datesParam = `${dateFormatted}/${dateFormatted}`;

  if (event.time) {
    const timeFormatted = event.time.replace(/:/g, '') + '00';
    datesParam = `${dateFormatted}T${timeFormatted}/${dateFormatted}T${timeFormatted}`;
  }

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}&dates=${datesParam}`;
}

// Filter and Sort Events
function getFilteredEvents() {
  return events
    .filter(event => {
      // Category Filter
      if (currentCategory !== 'all' && event.category !== currentCategory) {
        return false;
      }
      // Search Filter
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matchTitle = event.title.toLowerCase().includes(query);
        const matchDesc = (event.description || '').toLowerCase().includes(query);
        const matchLoc = (event.location || '').toLowerCase().includes(query);
        if (!matchTitle && !matchDesc && !matchLoc) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      if (currentSort === 'date-asc') {
        return new Date(a.date) - new Date(b.date);
      } else if (currentSort === 'date-desc') {
        return new Date(b.date) - new Date(a.date);
      } else if (currentSort === 'title-asc') {
        return a.title.localeCompare(b.title);
      } else if (currentSort === 'priority') {
        const pWeight = { high: 3, medium: 2, low: 1 };
        return (pWeight[b.priority] || 1) - (pWeight[a.priority] || 1);
      }
      return 0;
    });
}

// Update Overview Stats
function updateStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let dueSoonCount = 0;
  let examCount = 0;
  let assignCount = 0;

  events.forEach(evt => {
    const evtDate = new Date(evt.date);
    evtDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((evtDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays >= 0 && diffDays <= 7) {
      dueSoonCount++;
    }
    if (evt.category === 'exam') {
      examCount++;
    }
    if (evt.category === 'assignment' || evt.category === 'project') {
      assignCount++;
    }
  });

  statDueSoon.textContent = dueSoonCount;
  statExams.textContent = examCount;
  statAssignments.textContent = assignCount;
  statTotal.textContent = events.length;
}

// Render Event Card Element
function createEventCard(event) {
  const countdown = getCountdownData(event.date);
  const timeFormatted = event.time ? ` &bull; ${formatTime(event.time)}` : '';
  const gcalUrl = getGoogleCalendarUrl(event);

  const card = document.createElement('article');
  card.className = `event-card category-${event.category}`;
  card.innerHTML = `
    <div class="card-top">
      <span class="category-tag tag-${event.category}">${event.category}</span>
      <span class="countdown-pill ${countdown.class}">${countdown.text}</span>
    </div>

    <h3 class="card-title">${escapeHtml(event.title)}</h3>

    <div class="card-date-meta">
      <div class="date-row">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <span>${formatDate(event.date)}${timeFormatted}</span>
      </div>
      ${
        event.location
          ? `<div class="location-row">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <span>${escapeHtml(event.location)}</span>
            </div>`
          : ''
      }
    </div>

    <p class="card-desc">${escapeHtml(event.description || 'No specific instructions provided.')}</p>

    <div class="card-footer">
      <div class="priority-flag">
        <span class="priority-dot ${event.priority}"></span>
        <span>${event.priority.toUpperCase()} PRIORITY</span>
      </div>

      <div class="card-actions">
        <a href="${gcalUrl}" target="_blank" rel="noopener noreferrer" class="btn-icon" title="Add to Google Calendar" aria-label="Add to Google Calendar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </a>
        <button class="btn-icon edit" data-id="${event.id}" title="Edit Date" aria-label="Edit Date">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
        </button>
        <button class="btn-icon delete" data-id="${event.id}" title="Delete Date" aria-label="Delete Date">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  `;
  return card;
}

// Render Timeline Item
function createTimelineItem(event) {
  const countdown = getCountdownData(event.date);
  const timeFormatted = event.time ? ` &bull; ${formatTime(event.time)}` : '';

  const item = document.createElement('div');
  item.className = 'timeline-item';
  item.innerHTML = `
    <div class="timeline-node"></div>
    <div class="event-card category-${event.category}">
      <div class="card-top">
        <span class="category-tag tag-${event.category}">${event.category}</span>
        <span class="countdown-pill ${countdown.class}">${countdown.text}</span>
      </div>
      <h3 class="card-title">${escapeHtml(event.title)}</h3>
      <div class="card-date-meta">
        <div class="date-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <span>${formatDate(event.date)}${timeFormatted}</span>
        </div>
      </div>
      <p class="card-desc">${escapeHtml(event.description || '')}</p>
      <div class="card-footer">
        <div class="priority-flag">
          <span class="priority-dot ${event.priority}"></span>
          <span>${event.priority.toUpperCase()}</span>
        </div>
        <div class="card-actions">
          <button class="btn-icon edit" data-id="${event.id}" title="Edit Date">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
          </button>
          <button class="btn-icon delete" data-id="${event.id}" title="Delete Date">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
  return item;
}

// Main Render Function
function render() {
  updateStats();
  const filtered = getFilteredEvents();

  if (filtered.length === 0) {
    eventsGrid.style.display = 'none';
    eventsTimeline.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  if (currentView === 'grid') {
    eventsGrid.style.display = 'grid';
    eventsTimeline.style.display = 'none';
    eventsGrid.innerHTML = '';
    filtered.forEach(evt => {
      eventsGrid.appendChild(createEventCard(evt));
    });
  } else {
    eventsGrid.style.display = 'none';
    eventsTimeline.style.display = 'block';
    eventsTimeline.innerHTML = '';
    filtered.forEach(evt => {
      eventsTimeline.appendChild(createTimelineItem(evt));
    });
  }

  attachCardActionListeners();
}

// Attach Edit & Delete handlers to dynamically generated cards
function attachCardActionListeners() {
  document.querySelectorAll('.btn-icon.delete').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (confirm('Are you sure you want to remove this date entry?')) {
        events = events.filter(item => item.id !== id);
        saveEvents();
        render();
        showToast('Date entry removed.');
      }
    };
  });

  document.querySelectorAll('.btn-icon.edit').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const target = events.find(item => item.id === id);
      if (target) {
        openEditModal(target);
      }
    };
  });
}

// Modal Handlers
function openAddModal() {
  modalTitle.textContent = 'Add Important Date';
  eventForm.reset();
  document.getElementById('eventId').value = '';

  // Default to tomorrow's date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('eventDate').value = tomorrow.toISOString().split('T')[0];

  eventModal.classList.add('active');
}

function openEditModal(event) {
  modalTitle.textContent = 'Edit Important Date';
  document.getElementById('eventId').value = event.id;
  document.getElementById('eventTitle').value = event.title;
  document.getElementById('eventCategory').value = event.category;
  document.getElementById('eventPriority').value = event.priority;
  document.getElementById('eventDate').value = event.date;
  document.getElementById('eventTime').value = event.time || '';
  document.getElementById('eventLocation').value = event.location || '';
  document.getElementById('eventDesc').value = event.description || '';

  eventModal.classList.add('active');
}

function closeModal() {
  eventModal.classList.remove('active');
}

// Event Listeners
function setupEventListeners() {
  // Search
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
    render();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.style.display = 'none';
    render();
  });

  // Category Pills
  categoryPills.addEventListener('click', (e) => {
    const btn = e.target.closest('.pill-btn');
    if (!btn) return;
    document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentCategory = btn.getAttribute('data-category');
    render();
  });

  // Sort Select
  sortSelect.addEventListener('change', (e) => {
    currentSort = e.target.value;
    render();
  });

  // View Switcher
  gridViewBtn.addEventListener('click', () => {
    gridViewBtn.classList.add('active');
    timelineViewBtn.classList.remove('active');
    currentView = 'grid';
    render();
  });

  timelineViewBtn.addEventListener('click', () => {
    timelineViewBtn.classList.add('active');
    gridViewBtn.classList.remove('active');
    currentView = 'timeline';
    render();
  });

  // Modals
  openAddModalBtn.addEventListener('click', openAddModal);
  closeModalBtn.addEventListener('click', closeModal);
  cancelModalBtn.addEventListener('click', closeModal);

  eventModal.addEventListener('click', (e) => {
    if (e.target === eventModal) closeModal();
  });

  // Modal Form Submit
  eventForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const id = document.getElementById('eventId').value || `evt-${Date.now()}`;
    const title = document.getElementById('eventTitle').value.trim();
    const category = document.getElementById('eventCategory').value;
    const priority = document.getElementById('eventPriority').value;
    const date = document.getElementById('eventDate').value;
    const time = document.getElementById('eventTime').value;
    const location = document.getElementById('eventLocation').value.trim();
    const description = document.getElementById('eventDesc').value.trim();

    const newEvent = { id, title, category, priority, date, time, location, description };

    const existingIdx = events.findIndex(item => item.id === id);
    if (existingIdx !== -1) {
      events[existingIdx] = newEvent;
      showToast('Date updated successfully!');
    } else {
      events.push(newEvent);
      showToast('New date scheduled!');
    }

    saveEvents();
    render();
    closeModal();
  });

  // Announcement close
  closeAnnouncement.addEventListener('click', () => {
    announcementBar.style.display = 'none';
  });

  // Reset Filters
  resetFiltersBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.style.display = 'none';
    currentCategory = 'all';
    document.querySelectorAll('.pill-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-category') === 'all');
    });
    render();
  });

  // Reset to default sample events
  restoreDefaultsBtn.addEventListener('click', () => {
    if (confirm('Reset all dates to sample schedule data? Any custom entries will be replaced.')) {
      events = getDefaultEvents();
      saveEvents();
      render();
      showToast('Sample dates restored!');
    }
  });

  // Export JSON
  exportDatesBtn.addEventListener('click', () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(events, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'csee_important_dates.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Dates exported as JSON!');
  });
}

// Start Application
document.addEventListener('DOMContentLoaded', init);
