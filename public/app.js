// Global state variables
let currentUser = null;
let currentCategoryId = null;
let quizQuestions = [];
let categoriesList = [];
let studentChart = null;

// Page initialization
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
});

// ----------------------------------------------------
// AUTHENTICATION UTILS
// ----------------------------------------------------
function checkAuth() {
  fetch('/api/auth/me')
    .then(res => {
      if (!res.ok) throw new Error('Unauthorized');
      return res.json();
    })
    .then(user => {
      currentUser = user;
      
      // Update username in header if element exists
      const usernameHeader = document.getElementById('usernameHeader');
      if (usernameHeader) {
        usernameHeader.innerText = user.username;
      }

      // Role check based on current page URL
      const path = window.location.pathname;
      if (path.includes('admin.html') && user.role !== 'admin') {
        window.location.href = '/dashboard.html';
      } else if (path.includes('dashboard.html') && user.role === 'admin') {
        window.location.href = '/admin.html';
      }

      // Initial data fetch based on page loaded
      if (path.includes('dashboard.html')) {
        loadCategories();
      } else if (path.includes('admin.html')) {
        loadAdminStats();
      }
    })
    .catch(() => {
      // If not authenticated, redirect to login page unless already there
      const path = window.location.pathname;
      if (!path.includes('login.html') && path !== '/' && path !== '/index.html') {
        window.location.href = '/login.html';
      }
    });
}

function handleLogout() {
  fetch('/api/auth/logout', { method: 'POST' })
    .then(() => {
      window.location.href = '/';
    })
    .catch(err => console.error('Logout error:', err));
}

// ----------------------------------------------------
// STUDENT PORTAL / DASHBOARD LOGIC
// ----------------------------------------------------

// Tab View switching
function switchView(viewId) {
  // Hide all views
  document.querySelectorAll('.dashboard-view').forEach(view => {
    view.classList.remove('active');
  });

  // Remove active state from sidebar items
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.classList.remove('active');
  });

  // Activate target view
  const targetView = document.getElementById(viewId);
  if (targetView) targetView.classList.add('active');

  // Activate target menu item
  if (viewId === 'categories-view' || viewId === 'drugs-view') {
    document.getElementById('menuCategories').classList.add('active');
  } else if (viewId === 'stats-view') {
    document.getElementById('menuStats').classList.add('active');
    loadStudentStats();
  }

  // Hide quiz result screen if switching back
  if (viewId !== 'quiz-view') {
    document.getElementById('quizForm').style.display = 'block';
    document.getElementById('quizResultScreen').style.display = 'none';
  }
}

// Fetch and render Categories
function loadCategories() {
  showLoader(true);
  fetch('/api/categories')
    .then(res => res.json())
    .then(categories => {
      categoriesList = categories;
      const grid = document.getElementById('categoryGrid');
      grid.innerHTML = '';
      
      categories.forEach(cat => {
        const card = document.createElement('div');
        card.className = 'glass-panel category-card';
        card.innerHTML = `
          <h3>${cat.name}</h3>
          <p>${cat.description}</p>
          <div style="margin-top: 1rem; color: var(--primary-hover); font-weight:600; display:flex; align-items:center; gap:0.5rem;">
            O'rganish va test topshirish <span>&rarr;</span>
          </div>
        `;
        card.onclick = () => loadCategoryDrugs(cat.id, cat.name, cat.description);
        grid.appendChild(card);
      });
      showLoader(false);
    })
    .catch(err => {
      console.error(err);
      showLoader(false);
    });
}

// Fetch and render Drugs within a category
function loadCategoryDrugs(categoryId, categoryName, categoryDesc) {
  currentCategoryId = categoryId;
  showLoader(true);
  
  // Log user activity
  fetch('/api/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action_details: `"${categoryName}" o'quv bo'limiga kirdi` })
  }).catch(err => console.error(err));

  fetch(`/api/drugs?category_id=${categoryId}`)
    .then(res => res.json())
    .then(drugs => {
      document.getElementById('categoryTitle').innerText = categoryName;
      document.getElementById('categoryDesc').innerText = categoryDesc;
      
      const listContainer = document.getElementById('drugList');
      listContainer.innerHTML = '';

      if (drugs.length === 0) {
        listContainer.innerHTML = '<p>Ushbu bo\'limda hozircha dori ma\'lumotlari mavjud emas.</p>';
      } else {
        drugs.forEach(drug => {
          const card = document.createElement('div');
          card.className = 'glass-panel drug-card';
          const rxBadge = drug.prescription_status === 'Retseptsiz'
            ? `<span style="background:rgba(16,185,129,0.18);color:#10b981;border:1px solid rgba(16,185,129,0.4);padding:0.2rem 0.7rem;border-radius:999px;font-size:0.75rem;font-weight:600;">Retseptsiz</span>`
            : `<span style="background:rgba(245,158,11,0.18);color:#f59e0b;border:1px solid rgba(245,158,11,0.4);padding:0.2rem 0.7rem;border-radius:999px;font-size:0.75rem;font-weight:600;">Retsept bilan</span>`;
          card.innerHTML = `
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
              <div>
                <h3 style="margin:0 0 0.25rem;">${drug.name}</h3>
                <p style="margin:0;color:#94a3b8;font-size:0.9rem;">Ta'sir etuvchi modda: <strong style="color:#c4b5fd;">${drug.active_substance || '—'}</strong></p>
              </div>
              <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">
                ${rxBadge}
              </div>
            </div>
            <div class="drug-metadata" style="margin-top:1rem;">
              <div class="metadata-section">
                <h4>&#127812; Qo'llanilishi</h4>
                <p>${drug.indications || '—'}</p>
              </div>
              <div class="metadata-section" style="border-left: 3px solid rgba(239,68,68,0.6);">
                <h4 style="color:#f87171;">&#128683; Qo'llash mumkin bo'lmagan holatlar</h4>
                <p>${drug.contraindications || '—'}</p>
              </div>
              <div class="metadata-section">
                <h4>&#128138; Qo'llash usuli</h4>
                <p>${drug.administration_method || '—'}</p>
              </div>
              <div class="metadata-section">
                <h4>&#9878; Doza va dozalanishi</h4>
                <p>${drug.dosage || '—'}</p>
              </div>
              <div class="metadata-section">
                <h4>&#9888;&#65039; Nojo'ya ta'sirlari</h4>
                <p>${drug.side_effects || '—'}</p>
              </div>
              <div class="metadata-section">
                <h4>&#129809; Homiladorlarda qo'llash</h4>
                <p>${drug.pregnancy_safety || '—'}</p>
              </div>
            </div>
          `;
          listContainer.appendChild(card);
        });
      }

      // Configure start quiz button
      const startQuizBtn = document.getElementById('startQuizBtn');
      startQuizBtn.onclick = () => startCategoryQuiz(categoryId, categoryName);

      showLoader(false);
      switchView('drugs-view');
    })
    .catch(err => {
      console.error(err);
      showLoader(false);
    });
}

// Quiz / Exam execution
function startCategoryQuiz(categoryId, categoryName) {
  showLoader(true);
  
  // Log activity
  fetch('/api/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action_details: `"${categoryName}" bo'limi test topshirishni boshladi` })
  }).catch(err => console.error(err));

  fetch(`/api/tests?category_id=${categoryId}`)
    .then(res => res.json())
    .then(tests => {
      quizQuestions = tests;
      document.getElementById('quizCategoryTitle').innerText = `"${categoryName}" bo'limi bo'yicha test`;
      
      const container = document.getElementById('quizQuestionsContainer');
      container.innerHTML = '';

      if (tests.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:2rem;">Ushbu bo\'limda hozircha test savollari mavjud emas.</p>';
        document.querySelector('#quizForm button[type="submit"]').style.display = 'none';
      } else {
        document.querySelector('#quizForm button[type="submit"]').style.display = 'block';
        tests.forEach((test, index) => {
          const card = document.createElement('div');
          card.className = 'glass-panel question-card';
          card.innerHTML = `
            <div class="question-text">${index + 1}. ${test.question}</div>
            <div class="options-list">
              <label class="option-item" onclick="selectOption(this)">
                <input type="radio" name="question_${test.id}" value="A" required>
                <span class="option-prefix">A</span>
                <span class="option-text">${test.option_a}</span>
              </label>
              <label class="option-item" onclick="selectOption(this)">
                <input type="radio" name="question_${test.id}" value="B">
                <span class="option-prefix">B</span>
                <span class="option-text">${test.option_b}</span>
              </label>
              <label class="option-item" onclick="selectOption(this)">
                <input type="radio" name="question_${test.id}" value="C">
                <span class="option-prefix">C</span>
                <span class="option-text">${test.option_c}</span>
              </label>
              <label class="option-item" onclick="selectOption(this)">
                <input type="radio" name="question_${test.id}" value="D">
                <span class="option-prefix">D</span>
                <span class="option-text">${test.option_d}</span>
              </label>
            </div>
          `;
          container.appendChild(card);
        });
      }

      showLoader(false);
      switchView('quiz-view');
    })
    .catch(err => {
      console.error(err);
      showLoader(false);
    });
}

function selectOption(labelElement) {
  // Deselect other options in same question card
  const card = labelElement.closest('.question-card');
  card.querySelectorAll('.option-item').forEach(opt => {
    opt.classList.remove('selected');
  });
  // Select current
  labelElement.classList.add('selected');
}

function confirmExitQuiz() {
  if (confirm("Haqiqatan ham testdan chiqmoqchimisiz? Natijalar saqlanmaydi.")) {
    switchView('categories-view');
  }
}

function handleQuizSubmit(e) {
  e.preventDefault();
  
  const answers = {};
  quizQuestions.forEach(q => {
    const selected = document.querySelector(`input[name="question_${q.id}"]:checked`);
    answers[q.id] = selected ? selected.value : null;
  });

  showLoader(true);
  
  fetch('/api/tests/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category_id: currentCategoryId, answers })
  })
  .then(res => res.json())
  .then(resData => {
    showLoader(false);
    
    // Hide form, show results screen
    document.getElementById('quizForm').style.display = 'none';
    const resultScreen = document.getElementById('quizResultScreen');
    resultScreen.style.display = 'block';
    
    // Render score
    document.getElementById('resultScore').innerText = `${resData.correct_answers}/${resData.total_questions}`;
    
    const percentage = Math.round((resData.correct_answers / resData.total_questions) * 100);
    const resultTitle = document.getElementById('resultTitle');
    const resultText = document.getElementById('resultText');

    if (percentage >= 80) {
      resultTitle.innerText = "A'lo natija!";
      resultText.innerText = `Siz bo'limni a'lo darajada o'zlashtirdingiz! Bilimingiz: ${percentage}%`;
    } else if (percentage >= 50) {
      resultTitle.innerText = "Yaxshi natija!";
      resultText.innerText = `Mavzuni yetarli darajada o'zlashtirdingiz. Bilimingiz: ${percentage}%`;
    } else {
      resultTitle.innerText = "Qoniqarsiz natija.";
      resultText.innerText = `Mavzuni qayta o'qib chiqishingizni maslahat beramiz. Bilimingiz: ${percentage}%`;
    }

    // Render detailed feedback in the question cards (we display it at the bottom of the result screen)
    // First, restore the questions card view but make it read-only and colored
    const feedbackContainer = document.createElement('div');
    feedbackContainer.style.marginTop = '2rem';
    feedbackContainer.style.textAlign = 'left';
    feedbackContainer.innerHTML = '<h3 style="margin-bottom:1rem; border-bottom:1px solid var(--glass-border); padding-bottom:0.5rem;">Xatolarni tahlil qilish</h3>';

    resData.feedback.forEach((f, idx) => {
      const isCorrect = f.is_correct;
      const originalQuestion = quizQuestions.find(q => q.id === f.question_id);
      
      let userAnsText = "Javob berilmadi";
      let correctAnsText = "";
      
      if (originalQuestion) {
        if (f.user_answer === 'A') userAnsText = originalQuestion.option_a;
        else if (f.user_answer === 'B') userAnsText = originalQuestion.option_b;
        else if (f.user_answer === 'C') userAnsText = originalQuestion.option_c;
        else if (f.user_answer === 'D') userAnsText = originalQuestion.option_d;
        
        if (f.correct_answer === 'A') correctAnsText = originalQuestion.option_a;
        else if (f.correct_answer === 'B') correctAnsText = originalQuestion.option_b;
        else if (f.correct_answer === 'C') correctAnsText = originalQuestion.option_c;
        else if (f.correct_answer === 'D') correctAnsText = originalQuestion.option_d;
      } else {
        userAnsText = f.user_answer;
        correctAnsText = f.correct_answer;
      }

      const fCard = document.createElement('div');
      fCard.className = `glass-panel question-card`;
      fCard.style.borderLeftColor = isCorrect ? 'var(--success)' : 'var(--accent)';
      fCard.innerHTML = `
        <div class="question-text">${idx+1}. ${f.question}</div>
        <div style="font-size:0.9rem; margin-top:0.5rem;">
          <span style="color:${isCorrect ? 'var(--success)' : '#fda4af'}; font-weight:600;">
            Sizning javobingiz: ${f.user_answer}) ${userAnsText} ${isCorrect ? '✓' : '✗'}
          </span>
          ${!isCorrect ? `<br><span style="color:var(--success); font-weight:600;">To'g'ri javob: ${f.correct_answer}) ${correctAnsText}</span>` : ''}
        </div>
      `;
      feedbackContainer.appendChild(fCard);
    });

    resultScreen.appendChild(feedbackContainer);
  })
  .catch(err => {
    console.error(err);
    showLoader(false);
  });
}

// Student statistics loader
function loadStudentStats() {
  fetch('/api/stats/my-results')
    .then(res => res.json())
    .then(results => {
      const tbody = document.getElementById('statsTableBody');
      tbody.innerHTML = '';

      if (results.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Hozircha test topshirilmagan</td></tr>';
        return;
      }

      // Arrays for chart
      const labels = [];
      const scores = [];

      results.slice().reverse().forEach(resVal => {
        const date = new Date(resVal.completed_at).toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const tr = document.createElement('tr');
        const pct = Math.round((resVal.correct_answers / resVal.total_questions) * 100);
        tr.innerHTML = `
          <td><strong>${resVal.category_name}</strong></td>
          <td>${resVal.total_questions}</td>
          <td><span style="color: var(--success); font-weight:700;">${resVal.correct_answers}</span></td>
          <td><span style="color: var(--accent); font-weight:700;">${resVal.wrong_answers}</span></td>
          <td><span style="font-size:0.8rem;">${date}</span></td>
        `;
        tbody.appendChild(tr);

        // Chart data
        labels.push(`${resVal.category_name} (${new Date(resVal.completed_at).toLocaleDateString('uz-UZ', {day: 'numeric', month:'numeric'})})`);
        scores.push(pct);
      });

      // Render chart
      renderStudentChart(labels, scores);
    })
    .catch(err => console.error(err));
}

function renderStudentChart(labels, data) {
  const ctx = document.getElementById('studentStatsChart').getContext('2d');
  if (studentChart) {
    studentChart.destroy();
  }

  studentChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'O\'zlashtirish (%)',
        data: data,
        borderColor: '#0d9488',
        backgroundColor: 'rgba(13, 148, 136, 0.15)',
        borderWidth: 3,
        tension: 0.3,
        fill: true,
        pointBackgroundColor: '#14b8a6',
        pointRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: 100,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8' }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8', font: { size: 9 } }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

// ----------------------------------------------------
// ADMIN DASHBOARD / MANAGEMENT LOGIC
// ----------------------------------------------------



function switchAdminView(viewId) {
  // Toggle active views
  document.querySelectorAll('.dashboard-view').forEach(view => {
    view.classList.remove('active');
  });
  
  // Toggle sidebar active item
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.classList.remove('active');
  });

  const targetView = document.getElementById(viewId);
  if (targetView) targetView.classList.add('active');

  if (viewId === 'stats-view') {
    document.getElementById('menuStats').classList.add('active');
    loadAdminStats();
  } else if (viewId === 'logs-view') {
    document.getElementById('menuLogs').classList.add('active');
    loadAdminLogs();
  } else if (viewId === 'categories-crud-view') {
    document.getElementById('menuCategories').classList.add('active');
    loadAdminCategories();
  } else if (viewId === 'drugs-view') {
    document.getElementById('menuDrugs').classList.add('active');
    loadAdminDrugs();
  } else if (viewId === 'tests-view') {
    document.getElementById('menuTests').classList.add('active');
    loadAdminTests();
  }
}

// Load stats bar and test history
function loadAdminStats() {
  showAdminLoader(true);
  
  Promise.all([
    fetch('/api/admin/stats').then(res => res.json()),
    fetch('/api/admin/test-results').then(res => res.json())
  ])
  .then(([stats, results]) => {
    // Populate stats counters
    document.getElementById('statUsers').innerText = stats.users;
    document.getElementById('statDrugs').innerText = stats.drugs;
    document.getElementById('statTests').innerText = stats.tests;
    document.getElementById('statAvgScore').innerText = `${stats.averageScore}%`;

    // Populate test attempts table
    const tbody = document.getElementById('adminTestResultsTable');
    tbody.innerHTML = '';

    if (results.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Hozircha hech qanday test topshirilmagan.</td></tr>';
    } else {
      results.forEach(resVal => {
        const date = new Date(resVal.completed_at).toLocaleString('uz-UZ');
        const percentage = Math.round((resVal.correct_answers / resVal.total_questions) * 100);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${resVal.username}</strong></td>
          <td>${resVal.category_name}</td>
          <td>${resVal.total_questions}</td>
          <td><span style="color:var(--success); font-weight:700;">${resVal.correct_answers}</span></td>
          <td><span style="color:var(--accent); font-weight:700;">${resVal.wrong_answers}</span></td>
          <td><span class="status-pill ${percentage >= 80 ? 'status-success' : 'status-student'}" style="font-size:0.8rem;">${percentage}% (${date})</span></td>
        `;
        tbody.appendChild(tr);
      });
    }
    showAdminLoader(false);
  })
  .catch(err => {
    console.error(err);
    showAdminLoader(false);
  });
}

// Load user activity logs
function loadAdminLogs() {
  showAdminLoader(true);
  fetch('/api/admin/logs')
    .then(res => res.json())
    .then(logs => {
      const tbody = document.getElementById('adminLogsTable');
      tbody.innerHTML = '';

      if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Harakatlar tarixi bo\'sh.</td></tr>';
      } else {
        logs.forEach(log => {
          const date = new Date(log.created_at).toLocaleString('uz-UZ');
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${log.username}</strong></td>
            <td>${log.action_details}</td>
            <td><span style="font-size:0.8rem;">${date}</span></td>
          `;
          tbody.appendChild(tr);
        });
      }
      showAdminLoader(false);
    })
    .catch(err => {
      console.error(err);
      showAdminLoader(false);
    });
}

// CATEGORIES CRUD OPERATIONS

function loadAdminCategories() {
  showAdminLoader(true);
  fetch('/api/categories')
    .then(res => res.json())
    .then(categories => {
      const tbody = document.getElementById('adminCategoriesTable');
      tbody.innerHTML = '';

      if (categories.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Bo\'limlar ro\'yxati bo\'sh.</td></tr>';
      } else {
        categories.forEach(c => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${c.name}</strong></td>
            <td>${c.description}</td>
            <td style="text-align:center; display:flex; gap:0.5rem; justify-content:center;">
              <button class="btn btn-secondary" style="padding:0.35rem 0.75rem; font-size:0.8rem;" onclick="openCategoryModal('edit', ${c.id})">Tahrirlash</button>
              <button class="btn btn-danger" style="padding:0.35rem 0.75rem; font-size:0.8rem;" onclick="deleteCategory(${c.id})">O'chirish</button>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }
      showAdminLoader(false);
    })
    .catch(err => {
      console.error(err);
      showAdminLoader(false);
    });
}

function openCategoryModal(mode, categoryId = null) {
  const modal = document.getElementById('categoryModal');
  const title = document.getElementById('categoryModalTitle');
  const form = document.getElementById('categoryForm');
  
  form.reset();

  if (mode === 'add') {
    title.innerText = 'Yangi bo\'lim qo\'shish';
    document.getElementById('categoryId').value = '';
    modal.classList.add('active');
  } else {
    title.innerText = 'Bo\'limni tahrirlash';
    document.getElementById('categoryId').value = categoryId;
    
    // Fetch details
    fetch('/api/categories')
      .then(res => res.json())
      .then(categories => {
        const cat = categories.find(c => c.id === categoryId);
        if (cat) {
          document.getElementById('categoryName').value = cat.name;
          document.getElementById('categoryDesc').value = cat.description;
          modal.classList.add('active');
        }
      });
  }
}

function closeCategoryModal() {
  document.getElementById('categoryModal').classList.remove('active');
}

function handleCategorySubmit(e) {
  e.preventDefault();
  const id = document.getElementById('categoryId').value;
  const name = document.getElementById('categoryName').value.trim();
  const description = document.getElementById('categoryDesc').value.trim();

  const url = id ? `/api/admin/categories/${id}` : '/api/admin/categories';
  const method = id ? 'PUT' : 'POST';

  fetch(url, {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description })
  })
  .then(res => {
    if (!res.ok) throw new Error('Bo\'limni saqlashda xatolik.');
    return res.json();
  })
  .then(() => {
    closeCategoryModal();
    loadAdminCategories();
    alert('Muvaffaqiyatli saqlandi!');
  })
  .catch(err => alert(err.message));
}

function deleteCategory(id) {
  if (confirm("Haqiqatan ham ushbu bo'limni o'chirmoqchimisiz? Bo'limga tegishli barcha dorilar va testlar ham o'chib ketadi!")) {
    fetch(`/api/admin/categories/${id}`, { method: 'DELETE' })
      .then(res => {
        if (!res.ok) throw new Error('O\'chirishda xatolik.');
        loadAdminCategories();
        alert('Bo\'lim muvaffaqiyatli o\'chirildi.');
      })
      .catch(err => alert(err.message));
  }
}


// DRUGS CRUD OPERATIONS

function loadAdminDrugs() {
  showAdminLoader(true);
  fetch('/api/drugs')
    .then(res => res.json())
    .then(drugs => {
      const tbody = document.getElementById('adminDrugsTable');
      tbody.innerHTML = '';

      if (drugs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Dorilar ro\'yxati bo\'sh.</td></tr>';
      } else {
        drugs.forEach(d => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${d.name}</strong><br><small style="color:#94a3b8;">${d.active_substance || ''}</small></td>
            <td><span class="status-pill status-student">${d.category_name}</span></td>
            <td style="font-size:0.85rem; max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${d.indications || d.description || ''}</td>
            <td style="text-align:center; display:flex; gap:0.5rem; justify-content:center;">
              <button class="btn btn-secondary" style="padding:0.35rem 0.75rem; font-size:0.8rem;" onclick="openDrugModal('edit', ${d.id})">Tahrirlash</button>
              <button class="btn btn-danger" style="padding:0.35rem 0.75rem; font-size:0.8rem;" onclick="deleteDrug(${d.id})">O'chirish</button>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }
      showAdminLoader(false);
    })
    .catch(err => {
      console.error(err);
      showAdminLoader(false);
    });
}

function openDrugModal(mode, drugId = null) {
  const modal = document.getElementById('drugModal');
  const title = document.getElementById('drugModalTitle');
  const form = document.getElementById('drugForm');
  
  form.reset();
  
  // Load categories in dropdown
  fetch('/api/categories')
    .then(res => res.json())
    .then(categories => {
      const select = document.getElementById('drugCategory');
      select.innerHTML = '';
      categories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.innerText = c.name;
        select.appendChild(opt);
      });
      
      if (mode === 'add') {
        title.innerText = 'Yangi dori qo\'shish';
        document.getElementById('drugId').value = '';
        modal.classList.add('active');
      } else {
        title.innerText = 'Dorini tahrirlash';
        document.getElementById('drugId').value = drugId;
        
        // Fetch specific drug detail
        fetch('/api/drugs')
          .then(res => res.json())
          .then(drugs => {
            const drug = drugs.find(d => d.id === drugId);
            if (drug) {
              document.getElementById('drugCategory').value = drug.category_id;
              document.getElementById('drugName').value = drug.name;
              document.getElementById('drugActiveSubstance').value = drug.active_substance || '';
              document.getElementById('drugIndications').value = drug.indications || '';
              document.getElementById('drugContraindications').value = drug.contraindications || '';
              document.getElementById('drugAdminMethod').value = drug.administration_method || '';
              document.getElementById('drugDosage').value = drug.dosage || '';
              document.getElementById('drugSideEffects').value = drug.side_effects || '';
              document.getElementById('drugPregnancy').value = drug.pregnancy_safety || '';
              document.getElementById('drugPrescription').value = drug.prescription_status || '';
              modal.classList.add('active');
            }
          });
      }
    });
}

function closeDrugModal() {
  document.getElementById('drugModal').classList.remove('active');
}

function handleDrugSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('drugId').value;
  const category_id = document.getElementById('drugCategory').value;
  const name = document.getElementById('drugName').value.trim();
  const active_substance = document.getElementById('drugActiveSubstance').value.trim();
  const indications = document.getElementById('drugIndications').value.trim();
  const contraindications = document.getElementById('drugContraindications').value.trim();
  const administration_method = document.getElementById('drugAdminMethod').value.trim();
  const dosage = document.getElementById('drugDosage').value.trim();
  const side_effects = document.getElementById('drugSideEffects').value.trim();
  const pregnancy_safety = document.getElementById('drugPregnancy').value;
  const prescription_status = document.getElementById('drugPrescription').value;

  const url = id ? `/api/admin/drugs/${id}` : '/api/admin/drugs';
  const method = id ? 'PUT' : 'POST';

  fetch(url, {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category_id, name, active_substance, indications, contraindications, administration_method, dosage, side_effects, pregnancy_safety, prescription_status })
  })
  .then(res => {
    if (!res.ok) throw new Error('Dori ma\'lumotlarini saqlashda xatolik.');
    return res.json();
  })
  .then(() => {
    closeDrugModal();
    loadAdminDrugs();
    alert('Muvaffaqiyatli saqlandi!');
  })
  .catch(err => alert(err.message));
}

function deleteDrug(id) {
  if (confirm("Haqiqatan ham ushbu dorini o'chirmoqchimisiz?")) {
    fetch(`/api/admin/drugs/${id}`, { method: 'DELETE' })
      .then(res => {
        if (!res.ok) throw new Error('O\'chirishda xatolik.');
        loadAdminDrugs();
        alert('Dori muvaffaqiyatli o\'chirildi.');
      })
      .catch(err => alert(err.message));
  }
}

// TESTS CRUD OPERATIONS

function loadAdminTests() {
  showAdminLoader(true);
  fetch('/api/admin/tests-list')
    .then(res => res.json())
    .then(tests => {
      const tbody = document.getElementById('adminTestsTable');
      tbody.innerHTML = '';

      if (tests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Testlar ro\'yxati bo\'sh.</td></tr>';
      } else {
        tests.forEach(t => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${t.question}</strong></td>
            <td><span class="status-pill status-student">${t.category_name}</span></td>
            <td style="font-size:0.8rem; line-height:1.2;">
              A: ${t.option_a}<br>
              B: ${t.option_b}<br>
              C: ${t.option_c}<br>
              D: ${t.option_d}
            </td>
            <td style="text-align:center;"><span class="status-pill status-success" style="font-weight:700;">${t.correct_option}</span></td>
            <td style="text-align:center; display:flex; gap:0.5rem; justify-content:center;">
              <button class="btn btn-secondary" style="padding:0.35rem 0.75rem; font-size:0.8rem;" onclick="openTestModal('edit', ${t.id})">Tahrirlash</button>
              <button class="btn btn-danger" style="padding:0.35rem 0.75rem; font-size:0.8rem;" onclick="deleteTest(${t.id})">O'chirish</button>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }
      showAdminLoader(false);
    })
    .catch(err => {
      console.error(err);
      showAdminLoader(false);
    });
}

function openTestModal(mode, testId = null) {
  const modal = document.getElementById('testModal');
  const title = document.getElementById('testModalTitle');
  const form = document.getElementById('testForm');
  
  form.reset();

  fetch('/api/categories')
    .then(res => res.json())
    .then(categories => {
      const select = document.getElementById('testCategory');
      select.innerHTML = '';
      categories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.innerText = c.name;
        select.appendChild(opt);
      });

      if (mode === 'add') {
        title.innerText = 'Yangi test qo\'shish';
        document.getElementById('testId').value = '';
        modal.classList.add('active');
      } else {
        title.innerText = 'Testni tahrirlash';
        document.getElementById('testId').value = testId;

        fetch('/api/admin/tests-list')
          .then(res => res.json())
          .then(tests => {
            const test = tests.find(t => t.id === testId);
            if (test) {
              document.getElementById('testCategory').value = test.category_id;
              document.getElementById('testQuestion').value = test.question;
              document.getElementById('testOptA').value = test.option_a;
              document.getElementById('testOptB').value = test.option_b;
              document.getElementById('testOptC').value = test.option_c;
              document.getElementById('testOptD').value = test.option_d;
              document.getElementById('testCorrect').value = test.correct_option;
              modal.classList.add('active');
            }
          });
      }
    });
}

function closeTestModal() {
  document.getElementById('testModal').classList.remove('active');
}

function handleTestSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('testId').value;
  const category_id = document.getElementById('testCategory').value;
  const question = document.getElementById('testQuestion').value.trim();
  const option_a = document.getElementById('testOptA').value.trim();
  const option_b = document.getElementById('testOptB').value.trim();
  const option_c = document.getElementById('testOptC').value.trim();
  const option_d = document.getElementById('testOptD').value.trim();
  const correct_option = document.getElementById('testCorrect').value;

  const url = id ? `/api/admin/tests/${id}` : '/api/admin/tests';
  const method = id ? 'PUT' : 'POST';

  fetch(url, {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category_id, question, option_a, option_b, option_c, option_d, correct_option })
  })
  .then(res => {
    if (!res.ok) throw new Error('Testni saqlashda xatolik.');
    return res.json();
  })
  .then(() => {
    closeTestModal();
    loadAdminTests();
    alert('Test muvaffaqiyatli saqlandi!');
  })
  .catch(err => alert(err.message));
}

function deleteTest(id) {
  if (confirm("Haqiqatan ham ushbu test savolini o'chirmoqchimisiz?")) {
    fetch(`/api/admin/tests/${id}`, { method: 'DELETE' })
      .then(res => {
        if (!res.ok) throw new Error('O\'chirishda xatolik.');
        loadAdminTests();
        alert('Test muvaffaqiyatli o\'chirildi.');
      })
      .catch(err => alert(err.message));
  }
}

// ----------------------------------------------------
// UI HELPERS (LOADERS)
// ----------------------------------------------------
function showLoader(show) {
  const loader = document.getElementById('loader');
  if (loader) loader.style.display = show ? 'block' : 'none';
}

function showAdminLoader(show) {
  const loader = document.getElementById('adminLoader');
  if (loader) loader.style.display = show ? 'block' : 'none';
}
