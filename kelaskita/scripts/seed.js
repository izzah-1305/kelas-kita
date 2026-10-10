import bcrypt from 'bcryptjs';
import db from '../src/db.js';

const hash = bcrypt.hashSync('password123', 10);

const addUser = (name, email, role) =>
  db
    .prepare('INSERT OR IGNORE INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(name, email, hash, role);

addUser('Bu Sari', 'guru@kelaskita.test', 'teacher');
addUser('Budi', 'budi@kelaskita.test', 'student');
addUser('Ani', 'ani@kelaskita.test', 'student');

const guru = db.prepare('SELECT id FROM users WHERE email = ?').get('guru@kelaskita.test');
const budi = db.prepare('SELECT id FROM users WHERE email = ?').get('budi@kelaskita.test');
const ani = db.prepare('SELECT id FROM users WHERE email = ?').get('ani@kelaskita.test');

db.prepare(
  'INSERT OR IGNORE INTO classes (name, description, code, teacher_id) VALUES (?, ?, ?, ?)',
).run('Matematika XI IPA 1', 'Kelas persiapan ujian semester', 'DEMO23', guru.id);
const kelas = db.prepare('SELECT id FROM classes WHERE code = ?').get('DEMO23');

for (const s of [budi, ani]) {
  db.prepare('INSERT OR IGNORE INTO class_members (class_id, user_id) VALUES (?, ?)').run(
    kelas.id,
    s.id,
  );
}

if (!db.prepare('SELECT 1 FROM posts WHERE class_id = ?').get(kelas.id)) {
  db.prepare(
    "INSERT INTO posts (class_id, author_id, type, title, content) VALUES (?, ?, 'announcement', ?, ?)",
  ).run(kelas.id, guru.id, 'Selamat datang!', 'Selamat datang di KelasKita. Mari belajar bersama.');
  db.prepare(
    'INSERT INTO assignments (class_id, title, description, max_score) VALUES (?, ?, ?, 100)',
  ).run(kelas.id, 'Latihan Turunan', 'Kerjakan soal 1-10 halaman 45.');
}

db.prepare(
  "INSERT INTO posts (class_id, author_id, type, title, content, link_url) SELECT ?, ?, 'material', ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM posts WHERE class_id = ? AND type = 'material')",
).run(kelas.id, guru.id, 'Modul: Turunan Fungsi Aljabar', 'Baca modul ini sebelum pertemuan berikutnya.', 'https://id.wikipedia.org/wiki/Turunan', kelas.id);

if (!db.prepare('SELECT 1 FROM threads WHERE class_id = ?').get(kelas.id)) {
  const t = db
    .prepare('INSERT INTO threads (class_id, author_id, title, content) VALUES (?, ?, ?, ?)')
    .run(kelas.id, budi.id, 'Bingung aturan rantai', 'Bu, kapan kita pakai aturan rantai dan bagaimana contohnya?');
  db.prepare('INSERT INTO replies (thread_id, author_id, content) VALUES (?, ?, ?)').run(
    t.lastInsertRowid,
    guru.id,
    'Dipakai saat ada fungsi di dalam fungsi, misalnya (2x+1)^3. Turunkan luar dulu, kalikan turunan dalam.',
  );
  const chat = db.prepare('INSERT INTO messages (class_id, user_id, content) VALUES (?, ?, ?)');
  chat.run(kelas.id, ani.id, 'Halo semua, sudah ada yang kerjakan latihan turunan?');
  chat.run(kelas.id, budi.id, 'Baru nomor 5, ayo belajar bareng!');
}

console.log('Seed selesai.');
console.log('Guru  : guru@kelaskita.test / password123');
console.log('Siswa : budi@kelaskita.test / password123');
console.log('Kode kelas demo: DEMO23');
