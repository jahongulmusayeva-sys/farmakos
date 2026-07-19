const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(async () => {
  console.log("Initializing database...");

  // Drop tables if they exist to start fresh
  db.run("DROP TABLE IF EXISTS user_logs");
  db.run("DROP TABLE IF EXISTS test_results");
  db.run("DROP TABLE IF EXISTS tests");
  db.run("DROP TABLE IF EXISTS drugs");
  db.run("DROP TABLE IF EXISTS categories");
  db.run("DROP TABLE IF EXISTS users");

  // Create tables
  db.run(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'student')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE drugs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER,
    name TEXT NOT NULL,
    active_substance TEXT NOT NULL,
    indications TEXT NOT NULL,
    contraindications TEXT NOT NULL,
    administration_method TEXT NOT NULL,
    dosage TEXT NOT NULL,
    side_effects TEXT NOT NULL,
    pregnancy_safety TEXT NOT NULL,
    prescription_status TEXT NOT NULL,
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER,
    question TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option TEXT NOT NULL CHECK(correct_option IN ('A', 'B', 'C', 'D')),
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE test_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    category_id INTEGER,
    total_questions INTEGER NOT NULL,
    correct_answers INTEGER NOT NULL,
    wrong_answers INTEGER NOT NULL,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE user_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action_details TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  console.log("Tables created successfully.");

  // Insert Users
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const studentPasswordHash = await bcrypt.hash('talaba123', 10);

  db.run("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", ['admin', adminPasswordHash, 'admin']);
  db.run("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", ['talaba', studentPasswordHash, 'student']);

  console.log("Default users inserted (admin/admin123, talaba/talaba123).");

  // Insert Categories
  const categories = [
    { name: "Antibiyotiklar", description: "Bakterial infeksiyalarga qarshi kurashuvchi va bakteriyalar o'sishini to'xtatuvchi dorilar guruhi." },
    { name: "Analgetiklar", description: "Og'riq hissini kamaytirish yoki butunlay yo'qotish uchun mo'ljallangan dorilar guruhi." },
    { name: "Antigipertenziv vositalar", description: "Qon bosimini tushirish va yurak-qon tomir tizimini himoya qilish uchun ishlatiladigan dorilar." },
    { name: "Vitaminlar va Minerallar", description: "Organizmning normal ishlashi va immun tizimini mustahkamlash uchun zarur bo'lgan moddalar." }
  ];

  const stmtCat = db.prepare("INSERT INTO categories (name, description) VALUES (?, ?)");
  categories.forEach(cat => {
    stmtCat.run(cat.name, cat.description);
  });
  stmtCat.finalize();
  console.log("Categories seeded.");

  // Insert Drugs
  // Note: category IDs will be 1, 2, 3, 4 based on insertion order
  const drugs = [
    {
      category_id: 1,
      name: "Amoksitsillin",
      active_substance: "Amoksitsillin trigidrati",
      indications: "Bakterial tonzillit, pnevmoniya, bronxit, otit, siydik yo'llari infeksiyalari",
      contraindications: "Penitsillinlar va sefalosporinlarga allergiya; infektsion mononukleoz; jigar yetishmovchiligi",
      administration_method: "Og'iz orqali (ichishga), butunlay suv bilan yutiladi",
      dosage: "Kattalarga 500 mg dan kuniga 3 mahal yoki 1000 mg dan kuniga 2 mahal",
      side_effects: "Ko'ngil aynishi, diareya, terida allergik toshmalar, qorin og'rig'i",
      pregnancy_safety: "Shifokor tavsiyasi bilan mumkin (foyda xavfdan ustun bo'lganda)",
      prescription_status: "Retsept bilan"
    },
    {
      category_id: 1,
      name: "Azitromitsin",
      active_substance: "Azitromitsin digidrati",
      indications: "Loringit, sinusit, tonzillit, pnevmoniya, teri va yumshoq to'qima infeksiyalari",
      contraindications: "Makrolidlarga allergiya; og'ir jigar va buyrak yetishmovchiligi; EKG da QT intervali uzayishi",
      administration_method: "Og'iz orqali (ichishga), ovqatdan 1 soat oldin yoki 2 soat keyin",
      dosage: "Kuniga 1 mahal 500 mg dan, davolash kursi 3 kun",
      side_effects: "Qorin og'rig'i, ich ketishi, bosh aylanishi, qusish",
      pregnancy_safety: "Mumkin emas (faqat o'ta zarur hollarda shifokor nazoratida)",
      prescription_status: "Retsept bilan"
    },
    {
      category_id: 2,
      name: "Paratsetamol",
      active_substance: "Paratsetamol",
      indications: "Turli kelib chiqishga ega og'riqlar (bosh, tish, mushak og'riqlari), yuqori tana harorati (isitma)",
      contraindications: "Paratsetamolga yuqori sezuvchanlik; og'ir jigar yetishmovchiligi; spirtli ichimliklar bilan birgalikda qabul qilish",
      administration_method: "Og'iz orqali (ichishga), ovqatdan keyin ko'p suv bilan",
      dosage: "Kattalarga 500 mg - 1 g dan bir qabulda, sutkalik doza 4 g dan oshmasligi kerak",
      side_effects: "Jigar faoliyati buzilishi (doza oshib ketganda), terida allergiya",
      pregnancy_safety: "Mumkin (qisqa muddatli va minimal dozalarda)",
      prescription_status: "Retseptsiz"
    },
    {
      category_id: 2,
      name: "Ibuprofen",
      active_substance: "Ibuprofen",
      indications: "Bosh og'rig'i, tish og'rig'i, bo'g'im va mushak og'riqlari, isitma bilan kechuvchi infeksiyalar",
      contraindications: "Oshqozon yarasi va ichak kasalliklari; og'ir buyrak va jigar yetishmovchiligi; aspirin va NSAIDga allergiya; yurak kasalliklari",
      administration_method: "Og'iz orqali, ovqatdan keyin ichish tavsiya etiladi",
      dosage: "Kuniga 3-4 marta 200-400 mg dan, sutkalik maksimal doza - 1200 mg",
      side_effects: "Oshqozonda og'riq, jigar yoki buyraklarga ta'siri, qon bosimi oshishi",
      pregnancy_safety: "Homiladorlikning 1 va 2-uch oyligida shifokor ruxsati bilan, 3-uch oyligida mumkin emas",
      prescription_status: "Retseptsiz"
    },
    {
      category_id: 3,
      name: "Enalapril",
      active_substance: "Enalapril maleati",
      indications: "Arterial gipertenziya (yuqori qon bosimi), surunkali yurak yetishmovchiligi",
      contraindications: "Homiladorlik va emizish davri; AKF ingibitorlariga allergiya; angionevroti shish tarixi; og'ir buyrak arteriyasi stenozu",
      administration_method: "Og'iz orqali, ovqatlanishdan qat'iy nazar",
      dosage: "Boshlang'ich doza kuniga 5 mg, asta-sekin shifokor nazoratida oshiriladi",
      side_effects: "Quruq yo'tal, bosh aylanishi, charchoq, qon bosimining keskin pasayishi",
      pregnancy_safety: "Mutlaqo mumkin emas (homilaga salbiy ta'sir ko'rsatadi)",
      prescription_status: "Retsept bilan"
    },
    {
      category_id: 3,
      name: "Amlodipin",
      active_substance: "Amlodipin besilati",
      indications: "Arterial gipertenziya (yuqori qon bosimi), barqaror stenokardiya",
      contraindications: "Amlodipin yoki digidropiridinlarga allergiya; og'ir gipotenziya (past qon bosimi); kardiyogen shok; og'ir aorta stenozu",
      administration_method: "Og'iz orqali, har kuni bir xil vaqtda suv bilan",
      dosage: "Kuniga 1 marta 5 mg dan, maksimal sutkalik doza - 10 mg",
      side_effects: "Oyoqlarda shishlar (shishlar paydo bo'lishi), bosh og'rig'i, yuz qizarishi",
      pregnancy_safety: "Faqat shifokor o'ta zarur deb topganda (xavfsizligi to'liq isbotlanmagan)",
      prescription_status: "Retsept bilan"
    },
    {
      category_id: 4,
      name: "Vitamin C (Askorbin kislotasi)",
      active_substance: "Askorbin kislotasi",
      indications: "Gipovitaminoz C (vitamin yetishmovchiligi), shamollash profilaktikasi va davolash",
      contraindications: "Oksalat toshli siydik kasalligi (oksaluriya); giperoksaluriya; glyukoza-6-fosfat degidrogena yetishmovchiligi",
      administration_method: "Og'iz orqali, ovqatdan keyin shimiladi yoki chaynaladi",
      dosage: "Profilaktika uchun kuniga 50-100 mg, davolash uchun 500 mg gacha",
      side_effects: "Yuqori dozalarda siydik-tosh kasalligi rivojlanish xavfi, oshqozon achishishi",
      pregnancy_safety: "Mumkin (sutkalik me'yordan oshmagan holda)",
      prescription_status: "Retseptsiz"
    },
    {
      category_id: 4,
      name: "Kalsiy D3 Nyukomed",
      active_substance: "Kalsiy karbonat + Vitamin D3 (Xolekalsiferol)",
      indications: "Kalsiy va vitamin D3 yetishmovchiligini to'ldirish, osteoporoz profilaktikasi",
      contraindications: "Giperkaltsemiya (qonda kalsiy ortiqchaligi); giperkaltsiyuriya; D vitamini toksikozu; sarkoidas; oshqozon-ichak adsorbentlari va antibiyotiklar bilan birgalikda qabul qilish",
      administration_method: "Og'iz orqali, chaynash yoki so'rish orqali",
      dosage: "Kattalarga va 12 yoshdan oshgan bolalarga kuniga 2 mahal 1 tadan tabletka",
      side_effects: "Qon va siydikda kalsiy miqdori oshishi, qabziyat, qorin dam bo'lishi",
      pregnancy_safety: "Mumkin (ammo kalsiyning maksimal sutkalik dozasi 1500 mg dan oshmasligi kerak)",
      prescription_status: "Retseptsiz"
    }
  ];

  const stmtDrug = db.prepare("INSERT INTO drugs (category_id, name, active_substance, indications, contraindications, administration_method, dosage, side_effects, pregnancy_safety, prescription_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  drugs.forEach(d => {
    stmtDrug.run(d.category_id, d.name, d.active_substance, d.indications, d.contraindications, d.administration_method, d.dosage, d.side_effects, d.pregnancy_safety, d.prescription_status);
  });
  stmtDrug.finalize();
  console.log("Drugs seeded.");

  // Insert Tests
  const tests = [
    {
      category_id: 1,
      question: "Amoksitsillin qaysi guruh antibiyotiklariga kiradi?",
      option_a: "Makrolidlar",
      option_b: "Penitsillinlar",
      option_c: "Sefalosporinlar",
      option_d: "Tetratsiklinlar",
      correct_option: "B"
    },
    {
      category_id: 1,
      question: "Azitromitsin dori vositasining asosiy ta'sir mexanizmi nima?",
      option_a: "Bakteriya devorini parchalash",
      option_b: "Bakteriya RNK sintezini ingibitsiya qilish",
      option_c: "Bakterial oqsil sintezini to'xtatish",
      option_d: "DNK replikatsiyasini bloklash",
      correct_option: "C"
    },
    {
      category_id: 1,
      question: "Antibiyotiklar qaysi infeksiyalarga qarshi samarasiz hisoblanadi?",
      option_a: "Bakterial infeksiyalar",
      option_b: "Virusli infeksiyalar (gripp, shamollash)",
      option_c: "Tirishish keltirib chiqaruvchi bakteriyalar",
      option_d: "Tizimli infeksiyalar",
      correct_option: "B"
    },
    {
      category_id: 2,
      question: "Paratsetamolning asosiy shifobaxsh xususiyatlari qaysilar?",
      option_a: "Yallig'lanishga qarshi va og'riq qoldiruvchi",
      option_b: "Isitma tushiruvchi va og'riq qoldiruvchi",
      option_c: "Spazmolitik va yallig'lanishga qarshi",
      option_d: "Antiseptik va isitma tushiruvchi",
      correct_option: "B"
    },
    {
      category_id: 2,
      question: "Oshqozon-ichak traktiga nojo'ya ta'siri eng yuqori bo'lgan og'riq qoldiruvchi guruh qaysi?",
      option_a: "Nosteroid yallig'lanishga qarshi vositalar (NYQV)",
      option_b: "Vitaminlar guruhlari",
      option_c: "Antigipertenziv vositalar",
      option_d: "Spazmolitiklar",
      correct_option: "A"
    },
    {
      category_id: 3,
      question: "Enalapril preparatining asosiy farmakologik ta'siri qanday?",
      option_a: "Qon bosimini ko'tarish",
      option_b: "Yurak urish sonini kamaytirish",
      option_c: "Qon bosimini tushirish (tomirlarni kengaytirish)",
      option_d: "Qon shakarini nazorat qilish",
      correct_option: "C"
    },
    {
      category_id: 3,
      question: "Amlodipin dori vositasi uchun eng ko'p kuzatiladigan nojo'ya ta'sir qaysi?",
      option_a: "Quruq yo'tal",
      option_b: "Oyoqlarda shish (shishlar paydo bo'lishi)",
      option_c: "Oshqozonda yara paydo bo'lishi",
      option_d: "Terining sarg'ayishi",
      correct_option: "B"
    },
    {
      category_id: 4,
      question: "Kollagen sintezi va immun tizimi uchun eng muhim hisoblangan vitamin qaysi?",
      option_a: "Vitamin D3",
      option_b: "Vitamin B12",
      option_c: "Vitamin C (Askorbin kislotasi)",
      option_d: "Vitamin A",
      correct_option: "C"
    },
    {
      category_id: 4,
      question: "Kalsiyning organizmda yaxshi so'rilishi uchun qaysi vitamin qo'shimcha sifatida talab qilinadi?",
      option_a: "Vitamin C",
      option_b: "Vitamin D3",
      option_c: "Vitamin B6",
      option_d: "Vitamin E",
      correct_option: "B"
    }
  ];

  const stmtTest = db.prepare("INSERT INTO tests (category_id, question, option_a, option_b, option_c, option_d, correct_option) VALUES (?, ?, ?, ?, ?, ?, ?)");
  tests.forEach(t => {
    stmtTest.run(t.category_id, t.question, t.option_a, t.option_b, t.option_c, t.option_d, t.correct_option);
  });
  stmtTest.finalize();
  console.log("Tests seeded.");

  // Insert some mock activity logs and test results for initial dashboard rendering
  db.run("INSERT INTO test_results (user_id, category_id, total_questions, correct_answers, wrong_answers) VALUES (2, 1, 3, 2, 1)");
  db.run("INSERT INTO test_results (user_id, category_id, total_questions, correct_answers, wrong_answers) VALUES (2, 2, 2, 1, 1)");
  db.run("INSERT INTO user_logs (user_id, action_details) VALUES (2, 'Tizimga kirdi')");
  db.run("INSERT INTO user_logs (user_id, action_details) VALUES (2, 'Antibiyotiklar bo''limini o''rgandi')");
  db.run("INSERT INTO user_logs (user_id, action_details) VALUES (2, 'Antibiyotiklar testini topshirdi. Natija: 2/3')");

  console.log("Mock data for testing seeded.");
  console.log("Database initialization finished successfully!");
  db.close();
});
