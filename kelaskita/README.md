# KelasKita

**KelasKita: ruang belajar kolaboratif online** (back-end + front-end dalam satu proyek).

**Stack:** Node.js 18+, Express, SQLite (better-sqlite3), JWT, Zod, Socket.IO. Front-end: HTML/CSS/JavaScript murni (tanpa build step) di folder `public/`, dilayani langsung oleh Express.

## Menjalankan

```bash
npm install
cp .env.example .env      # lalu ganti JWT_SECRET
npm run seed              # (opsional) data demo
npm run dev               # atau: npm start
```

**Buka `http://localhost:3000` di browser**: aplikasi langsung siap dipakai. API ada di `/api` (cek: `GET /api/health`).

Akun demo (setelah seed), password `password123`:
- Guru: `guru@kelaskita.test`
- Siswa: `budi@kelaskita.test`
- Kode kelas: `DEMO23`

## Fitur

- Registrasi & login (peran **teacher** / **student**), JWT, password di-hash bcrypt
- Kelas: guru membuat kelas, siswa bergabung dengan **kode 6 karakter**
- Pengumuman & materi belajar (guru)
- Tugas: guru membuat, siswa mengumpulkan, guru memberi nilai & umpan balik
- Forum diskusi (thread + balasan) untuk semua anggota kelas
- Chat kelas **real-time** (Socket.IO) + riwayat via REST
- Keamanan: helmet, CORS, rate limit login, validasi Zod, cek hak akses per kelas

## Endpoint REST

Semua endpoint selain `/auth/*` dan `/health` butuh header `Authorization: Bearer <token>`.
Prefix: `/api`.

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| POST | `/auth/register` | publik | `{name,email,password,role}` |
| POST | `/auth/login` | publik | `{email,password}` |
| GET | `/auth/me` | login | profil saya |
| POST | `/classes` | guru | `{name,description}` |
| GET | `/classes` | login | kelas yang saya ikuti / ajar |
| POST | `/classes/join` | siswa | `{code}` |
| GET | `/classes/:classId` | anggota | detail kelas |
| PATCH | `/classes/:classId` | pemilik | ubah nama/deskripsi |
| DELETE | `/classes/:classId` | pemilik | hapus kelas |
| POST | `/classes/:classId/regenerate-code` | pemilik | kode kelas baru |
| GET | `/classes/:classId/members` | anggota | daftar guru & siswa |
| DELETE | `/classes/:classId/members/:userId` | pemilik / diri sendiri | keluarkan / keluar |
| GET | `/classes/:classId/posts?type=` | anggota | pengumuman & materi |
| POST | `/classes/:classId/posts` | pemilik | `{type,title,content,link_url?}` |
| DELETE | `/classes/:classId/posts/:postId` | pemilik | |
| GET | `/classes/:classId/assignments` | anggota | daftar tugas |
| POST | `/classes/:classId/assignments` | pemilik | `{title,description,due_date?,max_score?}` |
| GET | `/classes/:classId/assignments/:id` | anggota | detail (+ jawaban saya untuk siswa) |
| DELETE | `/classes/:classId/assignments/:id` | pemilik | |
| POST | `/classes/:classId/assignments/:id/submissions` | siswa | `{content?,link_url?}` (bisa diperbarui sebelum dinilai) |
| GET | `/classes/:classId/assignments/:id/submissions` | pemilik | semua pengumpulan |
| PATCH | `/classes/:classId/assignments/:id/submissions/:sid/grade` | pemilik | `{score,feedback}` |
| GET | `/classes/:classId/threads` | anggota | daftar diskusi |
| POST | `/classes/:classId/threads` | anggota | `{title,content}` |
| GET | `/classes/:classId/threads/:threadId` | anggota | diskusi + balasan |
| POST | `/classes/:classId/threads/:threadId/replies` | anggota | `{content}` |
| DELETE | `/classes/:classId/threads/:threadId` | penulis / pemilik | |
| DELETE | `/classes/:classId/threads/:threadId/replies/:replyId` | penulis / pemilik | |
| GET | `/classes/:classId/messages?before=&limit=` | anggota | riwayat chat |
| POST | `/classes/:classId/messages` | anggota | kirim chat via REST |

Error selalu berbentuk `{ "error": "pesan", "details": [...] }`.

## Chat Real-time (Socket.IO)

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', { auth: { token } });

socket.emit('class:join', classId, (res) => console.log(res)); // { ok: true }
socket.on('message:new', (msg) => console.log(msg));
socket.emit('message:send', { classId, content: 'Halo semua!' }, (res) => {});

socket.emit('typing', { classId, isTyping: true });
socket.on('typing', ({ userId, name, isTyping }) => {});
```

## Contoh cURL

```bash
# Login
curl -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"guru@kelaskita.test","password":"password123"}'

# Buat kelas
curl -X POST localhost:3000/api/classes -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"name":"Fisika X","description":"Gerak lurus"}'

# Siswa join
curl -X POST localhost:3000/api/classes/join -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H 'Content-Type: application/json' -d '{"code":"DEMO23"}'
```

## Struktur Proyek

```
public/              # FRONT-END
  index.html
  css/style.css
  js/app.js          # SPA (routing hash, API client, chat real-time)
src/
  server.js          # entry point (HTTP + Socket.IO)
  app.js             # konfigurasi Express
  socket.js          # event real-time
  config.js  db.js  utils.js
  middleware/        # auth, classAccess, validate, error
  routes/            # auth, classes, posts, assignments, threads, messages
  services/chat.js
scripts/seed.js
```

## Saran Pengembangan

- Upload file tugas/materi (multer + penyimpanan cloud)
- Kuis pilihan ganda otomatis dinilai
- Notifikasi & refresh token
- Ganti SQLite ke PostgreSQL bila pengguna banyak
