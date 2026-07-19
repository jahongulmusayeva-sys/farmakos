const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to SQLite Database
const dbPath = path.join(__dirname, 'db', 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Database connection error:", err.message);
  } else {
    console.log("Connected to SQLite database.");
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'farmakos-super-secret-key-12345',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Helpers to run DB queries as promises
const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

// Authentication Middleware
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Tizimga kirish talab etiladi." });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId || req.session.userRole !== 'admin') {
    return res.status(403).json({ error: "Ruxsat etilmagan. Faqat adminlar uchun." });
  }
  next();
}

// ----------------------------------------------------
// AUTHENTICATION API
// ----------------------------------------------------

// Register Student
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Foydalanuvchi nomi va parol kiritilishi shart." });
  }

  try {
    const existingUser = await dbGet("SELECT * FROM users WHERE username = ?", [username]);
    if (existingUser) {
      return res.status(400).json({ error: "Ushbu foydalanuvchi nomi band." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await dbRun(
      "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
      [username, passwordHash, 'student']
    );

    req.session.userId = result.lastID;
    req.session.username = username;
    req.session.userRole = 'student';

    // Log the registration
    await dbRun("INSERT INTO user_logs (user_id, action_details) VALUES (?, ?)", [result.lastID, "Tizimda yangi ro'yxatdan o'tdi"]);

    res.status(201).json({ success: true, user: { id: result.lastID, username, role: 'student' } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Foydalanuvchi nomi va parol kiritilishi shart." });
  }

  try {
    const user = await dbGet("SELECT * FROM users WHERE username = ?", [username]);
    if (!user) {
      return res.status(400).json({ error: "Foydalanuvchi nomi yoki parol noto'g'ri." });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: "Foydalanuvchi nomi yoki parol noto'g'ri." });
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.userRole = user.role;

    // Log login
    await dbRun("INSERT INTO user_logs (user_id, action_details) VALUES (?, ?)", [user.id, "Tizimga kirdi"]);

    res.json({ success: true, user: { id: user.id, username: user.username, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Logout
app.post('/api/auth/logout', requireAuth, async (req, res) => {
  try {
    await dbRun("INSERT INTO user_logs (user_id, action_details) VALUES (?, ?)", [req.session.userId, "Tizimdan chiqdi"]);
  } catch (err) {
    console.error(err);
  }
  
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Tizimdan chiqishda xatolik." });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true, message: "Tizimdan muvaffaqiyatli chiqildi." });
  });
});

// Get Profile Info
app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Tizimga kirmagansiz." });
  }
  res.json({
    id: req.session.userId,
    username: req.session.username,
    role: req.session.userRole
  });
});

// ----------------------------------------------------
// STUDENT PORTAL / MAIN PORTAL API
// ----------------------------------------------------

// Get all categories
app.get('/api/categories', requireAuth, async (req, res) => {
  try {
    const categories = await dbAll("SELECT * FROM categories");
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get drugs in a category (or all drugs)
app.get('/api/drugs', requireAuth, async (req, res) => {
  const { category_id } = req.query;
  try {
    let sql = "SELECT drugs.*, categories.name as category_name FROM drugs JOIN categories ON drugs.category_id = categories.id";
    let params = [];
    if (category_id) {
      sql += " WHERE drugs.category_id = ?";
      params.push(category_id);
    }
    const drugs = await dbAll(sql, params);
    res.json(drugs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get tests for a category (optionally filtered by category_id)
app.get('/api/tests', requireAuth, async (req, res) => {
  const { category_id } = req.query;
  if (!category_id) {
    return res.status(400).json({ error: "category_id talab etiladi." });
  }
  try {
    // Hide correct_option from the client
    const tests = await dbAll(
      "SELECT id, category_id, question, option_a, option_b, option_c, option_d FROM tests WHERE category_id = ?",
      [category_id]
    );
    res.json(tests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit test answers and grade them
app.post('/api/tests/submit', requireAuth, async (req, res) => {
  const { category_id, answers } = req.body; // answers is an object: { questionId: "A/B/C/D" }
  if (!category_id || !answers) {
    return res.status(400).json({ error: "category_id va javoblar (answers) talab etiladi." });
  }

  try {
    const dbTests = await dbAll("SELECT id, question, correct_option FROM tests WHERE category_id = ?", [category_id]);
    if (dbTests.length === 0) {
      return res.status(400).json({ error: "Ushbu bo'limda testlar mavjud emas." });
    }

    let correctCount = 0;
    let wrongCount = 0;
    const feedback = [];

    dbTests.forEach(test => {
      const userAnswer = answers[test.id];
      const isCorrect = userAnswer === test.correct_option;
      if (isCorrect) {
        correctCount++;
      } else {
        wrongCount++;
      }
      feedback.push({
        question_id: test.id,
        question: test.question,
        user_answer: userAnswer || "Javob berilmadi",
        correct_answer: test.correct_option,
        is_correct: isCorrect
      });
    });

    const totalQuestions = dbTests.length;

    // Save results
    await dbRun(
      "INSERT INTO test_results (user_id, category_id, total_questions, correct_answers, wrong_answers) VALUES (?, ?, ?, ?, ?)",
      [req.session.userId, category_id, totalQuestions, correctCount, wrongCount]
    );

    // Get category name for logging
    const category = await dbGet("SELECT name FROM categories WHERE id = ?", [category_id]);
    const categoryName = category ? category.name : "noma'lum bo'lim";

    // Log this action
    await dbRun(
      "INSERT INTO user_logs (user_id, action_details) VALUES (?, ?)",
      [req.session.userId, `${categoryName} testini topshirdi. Natija: ${correctCount}/${totalQuestions}`]
    );

    res.json({
      success: true,
      total_questions: totalQuestions,
      correct_answers: correctCount,
      wrong_answers: wrongCount,
      feedback: feedback
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Log student navigation activity
app.post('/api/logs', requireAuth, async (req, res) => {
  const { action_details } = req.body;
  if (!action_details) {
    return res.status(400).json({ error: "action_details kiritilishi shart." });
  }
  try {
    await dbRun("INSERT INTO user_logs (user_id, action_details) VALUES (?, ?)", [req.session.userId, action_details]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get individual student test history
app.get('/api/stats/my-results', requireAuth, async (req, res) => {
  try {
    const results = await dbAll(
      `SELECT test_results.*, categories.name as category_name 
       FROM test_results 
       JOIN categories ON test_results.category_id = categories.id 
       WHERE test_results.user_id = ? 
       ORDER BY test_results.completed_at DESC`,
      [req.session.userId]
    );
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ----------------------------------------------------
// ADMIN DASHBOARD / MANAGEMENT API
// ----------------------------------------------------

// Admin Dashboard Summary
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const userCount = await dbGet("SELECT COUNT(*) as count FROM users WHERE role = 'student'");
    const drugCount = await dbGet("SELECT COUNT(*) as count FROM drugs");
    const testCount = await dbGet("SELECT COUNT(*) as count FROM tests");
    const avgScore = await dbGet("SELECT AVG((correct_answers * 1.0 / total_questions) * 100) as avg FROM test_results");

    res.json({
      users: userCount.count,
      drugs: drugCount.count,
      tests: testCount.count,
      averageScore: avgScore.avg ? parseFloat(avgScore.avg.toFixed(1)) : 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin get student logs
app.get('/api/admin/logs', requireAdmin, async (req, res) => {
  try {
    const logs = await dbAll(
      `SELECT user_logs.*, users.username 
       FROM user_logs 
       JOIN users ON user_logs.user_id = users.id 
       ORDER BY user_logs.created_at DESC 
       LIMIT 100`
    );
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin clear all logs
app.delete('/api/admin/logs', requireAdmin, async (req, res) => {
  try {
    await dbRun("DELETE FROM user_logs");
    res.json({ message: "Barcha faoliyat jurnallari o'chirildi." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin delete single log
app.delete('/api/admin/logs/:id', requireAdmin, async (req, res) => {
  try {
    await dbRun("DELETE FROM user_logs WHERE id = ?", [req.params.id]);
    res.json({ message: "Harakat jurnali o'chirildi." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin get all test results
app.get('/api/admin/test-results', requireAdmin, async (req, res) => {
  try {
    const results = await dbAll(
      `SELECT test_results.*, users.username, categories.name as category_name 
       FROM test_results 
       JOIN users ON test_results.user_id = users.id 
       JOIN categories ON test_results.category_id = categories.id 
       ORDER BY test_results.completed_at DESC`
    );
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ADMIN CRUD FOR CATEGORIES

// Create category
app.post('/api/admin/categories', requireAdmin, async (req, res) => {
  const { name, description } = req.body;
  if (!name || !description) {
    return res.status(400).json({ error: "Barcha maydonlarni to'ldirish shart." });
  }
  try {
    const result = await dbRun(
      "INSERT INTO categories (name, description) VALUES (?, ?)",
      [name, description]
    );
    res.status(201).json({ success: true, id: result.lastID });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update category
app.put('/api/admin/categories/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  if (!name || !description) {
    return res.status(400).json({ error: "Barcha maydonlarni to'ldirish shart." });
  }
  try {
    await dbRun(
      "UPDATE categories SET name = ?, description = ? WHERE id = ?",
      [name, description, id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete category
app.delete('/api/admin/categories/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await dbRun("DELETE FROM categories WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ADMIN CRUD FOR DRUGS

// Create drug
app.post('/api/admin/drugs', requireAdmin, async (req, res) => {
  const { category_id, name, active_substance, indications, contraindications, administration_method, dosage, side_effects, pregnancy_safety, prescription_status } = req.body;
  if (!category_id || !name || !active_substance || !indications || !contraindications || !administration_method || !dosage || !side_effects || !pregnancy_safety || !prescription_status) {
    return res.status(400).json({ error: "Barcha maydonlarni to'ldirish shart." });
  }
  try {
    const result = await dbRun(
      "INSERT INTO drugs (category_id, name, active_substance, indications, contraindications, administration_method, dosage, side_effects, pregnancy_safety, prescription_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [category_id, name, active_substance, indications, contraindications, administration_method, dosage, side_effects, pregnancy_safety, prescription_status]
    );
    res.status(201).json({ success: true, id: result.lastID });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update drug
app.put('/api/admin/drugs/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { category_id, name, active_substance, indications, contraindications, administration_method, dosage, side_effects, pregnancy_safety, prescription_status } = req.body;
  if (!category_id || !name || !active_substance || !indications || !contraindications || !administration_method || !dosage || !side_effects || !pregnancy_safety || !prescription_status) {
    return res.status(400).json({ error: "Barcha maydonlarni to'ldirish shart." });
  }
  try {
    await dbRun(
      "UPDATE drugs SET category_id = ?, name = ?, active_substance = ?, indications = ?, contraindications = ?, administration_method = ?, dosage = ?, side_effects = ?, pregnancy_safety = ?, prescription_status = ? WHERE id = ?",
      [category_id, name, active_substance, indications, contraindications, administration_method, dosage, side_effects, pregnancy_safety, prescription_status, id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete drug
app.delete('/api/admin/drugs/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await dbRun("DELETE FROM drugs WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ADMIN CRUD FOR TESTS

// Create test
app.post('/api/admin/tests', requireAdmin, async (req, res) => {
  const { category_id, question, option_a, option_b, option_c, option_d, correct_option } = req.body;
  if (!category_id || !question || !option_a || !option_b || !option_c || !option_d || !correct_option) {
    return res.status(400).json({ error: "Barcha maydonlarni to'ldirish shart." });
  }
  try {
    const result = await dbRun(
      "INSERT INTO tests (category_id, question, option_a, option_b, option_c, option_d, correct_option) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [category_id, question, option_a, option_b, option_c, option_d, correct_option]
    );
    res.status(201).json({ success: true, id: result.lastID });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update test
app.put('/api/admin/tests/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { category_id, question, option_a, option_b, option_c, option_d, correct_option } = req.body;
  if (!category_id || !question || !option_a || !option_b || !option_c || !option_d || !correct_option) {
    return res.status(400).json({ error: "Barcha maydonlarni to'ldirish shart." });
  }
  try {
    await dbRun(
      "UPDATE tests SET category_id = ?, question = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_option = ? WHERE id = ?",
      [category_id, question, option_a, option_b, option_c, option_d, correct_option, id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete test
app.delete('/api/admin/tests/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await dbRun("DELETE FROM tests WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route to fetch full list of tests for admin management (includes correct answers)
app.get('/api/admin/tests-list', requireAdmin, async (req, res) => {
  try {
    const tests = await dbAll(
      `SELECT tests.*, categories.name as category_name 
       FROM tests 
       JOIN categories ON tests.category_id = categories.id`
    );
    res.json(tests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// Catch-all route to serve the SPA (Redirect to login if not logged in)
// ----------------------------------------------------
app.get('*', (req, res, next) => {
  // If requesting api, do not serve html
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
