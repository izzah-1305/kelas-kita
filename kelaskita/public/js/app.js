/* KelasKita – front-end (vanilla JS SPA, hash routing) */
(() => {
  'use strict';

  /* ---------- Util ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const root = $('#app');
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const state = { user: null, socket: null };
  const ctx = { cls: null, chat: null };
  let cleanup = null;

  const getToken = () => localStorage.getItem('kk_token');
  const fmt = (iso, withTime = true) =>
    iso
      ? new Intl.DateTimeFormat('id-ID', {
          day: 'numeric', month: 'short', year: 'numeric',
          ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
        }).format(new Date(iso))
      : '';
  const clock = (iso) => new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  const initials = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const roleLabel = (r) => (r === 'teacher' ? 'Guru' : 'Siswa');
  const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v != null));
  const loading = '<div class="spinner" role="status" aria-label="Memuat"></div>';
  const isUrl = (u) => /^https?:\/\//i.test(u || '');
  const linkHtml = (u) =>
    isUrl(u) ? `<a class="link" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${icon('link', 15)} ${esc(u)}</a>` : '';
  const empty = (title, text) => `<div class="empty"><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;

  const ICONS = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    clipboard: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    bolt: '<path d="M13 2L3 14h9l-1 8 10-12h-9z"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
    back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
  };
  function icon(name, size = 18) {
    return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
  }
  const logo = `<span class="logo"><span class="logo-mark">${icon('book', 20)}</span><span>Kelas<b>Kita</b></span></span>`;

  /* ---------- API ---------- */
  async function api(path, { method = 'GET', body } = {}) {
    const t = getToken();
    const res = await fetch('/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && t && !path.startsWith('/auth/')) {
        logout(false);
        toast('Sesi berakhir, silakan masuk lagi', 'err');
      }
      const err = new Error(data.details?.[0]?.message || data.error || 'Terjadi kesalahan');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  /* ---------- UI helpers ---------- */
  function toast(msg, type = 'ok') {
    const t = document.createElement('div');
    t.className = 'toast ' + (type === 'err' ? 'err' : '');
    t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 3800);
  }
  function openModal(title, body) {
    closeModal();
    const m = document.createElement('div');
    m.className = 'modal-backdrop';
    m.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-action="close-modal" aria-label="Tutup">&times;</button></div>${body}</div>`;
    m.addEventListener('mousedown', (e) => { if (e.target === m) closeModal(); });
    $('#modal-root').appendChild(m);
    m.querySelector('input:not([type=radio]),textarea')?.focus();
  }
  const closeModal = () => ($('#modal-root').innerHTML = '');
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  const navigate = (hash) => (location.hash === hash ? route() : (location.hash = hash));

  /* ---------- Session ---------- */
  function setSession({ user, token }) {
    localStorage.setItem('kk_token', token);
    state.user = user;
  }
  function logout(render = true) {
    localStorage.removeItem('kk_token');
    state.user = null;
    state.socket?.disconnect();
    state.socket = null;
    cleanup?.(); cleanup = null;
    if (render) { location.hash = '#/login'; viewAuth('login'); }
    else viewAuth('login');
  }
  function getSocket() {
    if (!state.socket) state.socket = io({ auth: (cb) => cb({ token: getToken() }) });
    return state.socket;
  }

  /* ---------- Auth view ---------- */
  function viewAuth(mode = 'login') {
    const loginForm = `
      <form data-form="login">
        <label>Email<input type="email" name="email" required autocomplete="email" placeholder="nama@email.com"></label>
        <label>Password<input type="password" name="password" required autocomplete="current-password"></label>
        <button class="btn primary" style="width:100%" type="submit">Masuk</button>
      </form>
      <div class="demo"><span>Coba akun demo:</span>
        <button class="btn small" type="button" data-action="demo" data-email="guru@kelaskita.test">Guru</button>
        <button class="btn small" type="button" data-action="demo" data-email="budi@kelaskita.test">Siswa</button>
      </div>`;
    const registerForm = `
      <form data-form="register">
        <label>Nama lengkap<input name="name" required minlength="2" maxlength="100" autocomplete="name"></label>
        <label>Email<input type="email" name="email" required autocomplete="email"></label>
        <label>Password <span class="hint">(minimal 8 karakter)</span><input type="password" name="password" required minlength="8" autocomplete="new-password"></label>
        <div class="role-pick">
          <label><input type="radio" name="role" value="student" checked><span>Siswa<small>Gabung ke kelas</small></span></label>
          <label><input type="radio" name="role" value="teacher"><span>Guru<small>Buat &amp; kelola kelas</small></span></label>
        </div>
        <button class="btn primary" style="width:100%" type="submit">Buat Akun</button>
      </form>`;
    root.innerHTML = `
    <div class="auth">
      <aside class="auth-brand on-dark">
        ${logo}
        <h1>Belajar bareng, tumbuh bareng.</h1>
        <p>Ruang belajar kolaboratif tempat guru dan siswa berbagi materi, mengerjakan tugas, berdiskusi, dan mengobrol dalam satu kelas online.</p>
        <ul>
          <li>${icon('check')} Kelas dengan kode undangan</li>
          <li>${icon('check')} Tugas, pengumpulan, dan penilaian</li>
          <li>${icon('check')} Forum diskusi &amp; chat real-time</li>
        </ul>
      </aside>
      <section class="auth-panel">
        <div class="auth-card">
          <div class="seg" role="tablist">
            <button class="${mode === 'login' ? 'on' : ''}" data-action="auth-mode" data-mode="login">Masuk</button>
            <button class="${mode === 'register' ? 'on' : ''}" data-action="auth-mode" data-mode="register">Daftar</button>
          </div>
          ${mode === 'login' ? loginForm : registerForm}
        </div>
      </section>
    </div>`;
  }

  /* ---------- Shell ---------- */
  function shell() {
    if ($('#view')) return;
    root.innerHTML = `
      <header class="topbar">
        <a href="#/" aria-label="Beranda">${logo}</a>
        <div class="topbar-right">
          <div class="who"><span class="avatar">${esc(initials(state.user.name))}</span>
            <span class="who-text"><b>${esc(state.user.name)}</b><small>${roleLabel(state.user.role)}</small></span></div>
          <button class="icon-btn" data-action="logout" title="Keluar" aria-label="Keluar">${icon('logout')}</button>
        </div>
      </header>
      <main class="container" id="view"></main>`;
  }

  /* ---------- Dashboard ---------- */
  async function viewDashboard(view) {
    const { classes } = await api('/classes');
    const isT = state.user.role === 'teacher';
    view.innerHTML = `
      <div class="page-head">
        <div><h1>Halo, ${esc(state.user.name.split(' ')[0])}</h1>
          <p class="muted">${isT ? 'Kelas yang Anda ajar' : 'Kelas yang Anda ikuti'}</p></div>
        <button class="btn primary" data-action="${isT ? 'new-class' : 'join-class'}">${icon('plus')} ${isT ? 'Buat Kelas' : 'Gabung Kelas'}</button>
      </div>
      ${classes.length
        ? `<div class="grid">${classes.map(classCard).join('')}</div>`
        : empty(isT ? 'Belum ada kelas' : 'Belum bergabung ke kelas mana pun',
            isT ? 'Buat kelas pertama Anda, lalu bagikan kodenya ke siswa.' : 'Minta kode kelas dari guru Anda, lalu klik "Gabung Kelas".')}`;
  }
  const classCard = (c) => `
    <a class="class-card" href="#/class/${c.id}">
      <div class="cc-banner c${c.id % 6}"><span>${esc(initials(c.name))}</span></div>
      <div class="cc-body"><h3>${esc(c.name)}</h3>
        <p class="muted clamp">${esc(c.description || 'Tanpa deskripsi')}</p>
        <div class="cc-meta"><span>${icon('users', 14)} ${c.student_count} siswa</span><span>${esc(c.teacher_name)}</span></div>
      </div>
    </a>`;

  /* ---------- Class page ---------- */
  const TABS = [['stream', 'Beranda', 'home'], ['assignments', 'Tugas', 'clipboard'], ['threads', 'Diskusi', 'chat'], ['chat', 'Chat', 'bolt'], ['members', 'Anggota', 'users']];

  async function viewClass(view, id, tab = 'stream', sub) {
    if (!Number.isInteger(id)) throw new Error('Kelas tidak valid');
    if (!TABS.some((t) => t[0] === tab)) tab = 'stream';
    const d = await api(`/classes/${id}`);
    const c = { ...d.class, isOwner: d.is_owner };
    ctx.cls = c;
    view.innerHTML = `
      <a class="back" href="#/">${icon('back', 16)} Semua kelas</a>
      <section class="class-hero c${c.id % 6}">
        <div><h1>${esc(c.name)}</h1>
          ${c.description ? `<p>${esc(c.description)}</p>` : ''}
          <p class="hero-meta">Guru: ${esc(c.teacher_name)} &middot; ${c.student_count} siswa</p></div>
        ${c.isOwner ? `<div class="code-box"><small>Kode kelas</small><div><code>${esc(c.code)}</code>
          <button class="icon-btn light" data-action="copy-code" data-code="${esc(c.code)}" title="Salin kode" aria-label="Salin kode">${icon('copy', 16)}</button>
          <button class="icon-btn light" data-action="regen-code" title="Buat kode baru" aria-label="Buat kode baru">${icon('refresh', 16)}</button></div></div>` : ''}
      </section>
      <nav class="tabs" aria-label="Menu kelas">
        ${TABS.map(([k, label, ic]) => `<a href="#/class/${c.id}/${k}" class="${k === tab ? 'on' : ''}">${icon(ic, 17)} ${label}</a>`).join('')}
      </nav>
      <div id="tab">${loading}</div>`;
    const box = $('#tab');
    await { stream: tabStream, assignments: tabAssignments, threads: tabThreads, chat: tabChat, members: tabMembers }[tab](box, c, sub);
  }

  /* Beranda: pengumuman & materi */
  async function tabStream(box, c) {
    const { posts } = await api(`/classes/${c.id}/posts`);
    const composer = c.isOwner ? `
      <form class="card" data-form="post" style="margin-bottom:18px">
        <h3>Bagikan ke kelas</h3>
        <div class="row">
          <label>Jenis<select name="type"><option value="announcement">Pengumuman</option><option value="material">Materi belajar</option></select></label>
          <label>Judul<input name="title" required minlength="2" maxlength="200" placeholder="Mis. Materi Bab 3"></label>
        </div>
        <label>Isi<textarea name="content" maxlength="10000" placeholder="Tulis sesuatu untuk kelas…"></textarea></label>
        <label>Tautan <span class="hint">(opsional)</span><input type="url" name="link_url" placeholder="https://…"></label>
        <button class="btn primary" type="submit">Posting</button>
      </form>` : '';
    box.innerHTML = composer + `<div class="stack">${posts.length ? posts.map((p) => postCard(p, c)).join('') : empty('Belum ada postingan', c.isOwner ? 'Bagikan pengumuman atau materi pertama Anda.' : 'Guru belum membagikan apa pun.')}</div>`;
  }
  const postCard = (p, c) => `
    <article class="card post">
      <div class="post-icon ${p.type}">${icon(p.type === 'material' ? 'book' : 'bell')}</div>
      <div><span class="chip ${p.type === 'material' ? 'warn' : 'info'}">${p.type === 'material' ? 'Materi' : 'Pengumuman'}</span>
        <h3>${esc(p.title)}</h3>
        <div class="post-meta">${esc(p.author_name)} &middot; ${fmt(p.created_at)}</div>
        ${p.content ? `<p class="prewrap">${esc(p.content)}</p>` : ''}${linkHtml(p.link_url)}</div>
      ${c.isOwner ? `<button class="icon-btn" data-action="del-post" data-id="${p.id}" title="Hapus" aria-label="Hapus">${icon('trash', 17)}</button>` : '<span></span>'}
    </article>`;

  /* Tugas */
  async function tabAssignments(box, c, sub) {
    if (sub) return viewAssignment(box, c, Number(sub));
    const { assignments } = await api(`/classes/${c.id}/assignments`);
    box.innerHTML = `
      ${c.isOwner ? `<div class="toolbar"><button class="btn primary" data-action="new-assignment">${icon('plus')} Buat Tugas</button></div>` : ''}
      <div class="stack">${assignments.length ? assignments.map((a) => assignmentRow(a, c)).join('') : empty('Belum ada tugas', c.isOwner ? 'Buat tugas pertama untuk kelas ini.' : 'Belum ada tugas dari guru.')}</div>`;
  }
  function assignmentRow(a, c) {
    const overdue = a.due_date && new Date(a.due_date) < new Date();
    let status;
    if (c.isOwner) status = `<span class="chip info">${a.submission_count} terkumpul</span>`;
    else if (a.my_submitted) status = a.my_score != null ? `<span class="chip ok">Nilai ${a.my_score}/${a.max_score}</span>` : '<span class="chip info">Dikumpulkan</span>';
    else status = overdue ? '<span class="chip warn">Terlambat</span>' : '<span class="chip">Belum dikumpulkan</span>';
    return `<a class="row-card" href="#/class/${c.id}/assignments/${a.id}">
      <div><h3>${esc(a.title)}</h3><span class="muted">${a.due_date ? 'Tenggat ' + fmt(a.due_date) : 'Tanpa tenggat'}</span></div>${status}</a>`;
  }
  async function viewAssignment(box, c, aid) {
    const d = await api(`/classes/${c.id}/assignments/${aid}`);
    const a = d.assignment;
    const late = (iso) => a.due_date && new Date(iso) > new Date(a.due_date);
    let body = '';
    if (c.isOwner) {
      const { submissions } = await api(`/classes/${c.id}/assignments/${aid}/submissions`);
      body = `<h2>Pengumpulan (${submissions.length})</h2><div class="stack">${
        submissions.length ? submissions.map((s) => `
        <article class="card">
          <div class="sub-head"><b>${esc(s.student_name)}</b><span class="muted">${fmt(s.submitted_at)}</span>${s.is_late ? '<span class="chip warn">Terlambat</span>' : ''}${s.score != null ? '<span class="chip ok">Sudah dinilai</span>' : ''}</div>
          ${s.content ? `<p class="prewrap">${esc(s.content)}</p>` : ''}${linkHtml(s.link_url)}
          <form class="grade-form" data-form="grade" data-sid="${s.id}">
            <input type="number" name="score" min="0" max="${a.max_score}" value="${s.score ?? ''}" placeholder="Nilai" required aria-label="Nilai">
            <span class="muted">/ ${a.max_score}</span>
            <input name="feedback" maxlength="2000" value="${esc(s.feedback || '')}" placeholder="Umpan balik (opsional)" aria-label="Umpan balik">
            <button class="btn small primary" type="submit">Simpan</button>
          </form>
        </article>`).join('') : empty('Belum ada pengumpulan', 'Jawaban siswa akan muncul di sini.')}</div>
        <div class="card danger-zone"><button class="btn danger small" data-action="del-assignment" data-id="${a.id}">${icon('trash', 15)} Hapus tugas ini</button></div>`;
    } else {
      const s = d.my_submission;
      const graded = s && s.graded_at;
      const overdue = a.due_date && new Date(a.due_date) < new Date();
      body = graded ? `
        <div class="card"><h3>Hasil penilaian</h3>
          <p><span class="chip ok">Nilai ${s.score} / ${a.max_score}</span> ${late(s.submitted_at) ? '<span class="chip warn">Dikumpulkan terlambat</span>' : ''}</p>
          ${s.feedback ? `<p><b>Umpan balik:</b> ${esc(s.feedback)}</p>` : ''}
          <hr style="border:0;border-top:1px solid var(--line)"><p class="muted">Jawaban Anda:</p>
          ${s.content ? `<p class="prewrap">${esc(s.content)}</p>` : ''}${linkHtml(s.link_url)}</div>` : `
        <form class="card" data-form="submit" data-aid="${a.id}">
          <h3>${s ? 'Perbarui jawaban' : 'Kumpulkan jawaban'}</h3>
          ${s ? `<p class="muted">Terakhir dikirim ${fmt(s.submitted_at)}. Anda dapat mengubahnya sebelum dinilai.</p>` : ''}
          ${!s && overdue ? '<p><span class="chip warn">Tenggat sudah lewat – jawaban akan ditandai terlambat</span></p>' : ''}
          <label>Jawaban<textarea name="content" maxlength="10000" placeholder="Tulis jawaban Anda…">${esc(s?.content || '')}</textarea></label>
          <label>Tautan <span class="hint">(mis. Google Drive, opsional)</span><input type="url" name="link_url" value="${esc(s?.link_url || '')}" placeholder="https://…"></label>
          <button class="btn primary" type="submit">${s ? 'Perbarui' : 'Kumpulkan'}</button>
        </form>`;
    }
    box.innerHTML = `
      <a class="back" href="#/class/${c.id}/assignments">${icon('back', 16)} Semua tugas</a>
      <article class="card" style="margin-bottom:20px">
        <h2>${esc(a.title)}</h2>
        <p class="muted">${a.due_date ? 'Tenggat ' + fmt(a.due_date) : 'Tanpa tenggat'} &middot; Nilai maksimal ${a.max_score}</p>
        ${a.description ? `<p class="prewrap">${esc(a.description)}</p>` : '<p class="muted">Tidak ada instruksi tambahan.</p>'}
      </article>${body}`;
  }

  /* Diskusi */
  async function tabThreads(box, c, sub) {
    if (sub) return viewThread(box, c, Number(sub));
    const { threads } = await api(`/classes/${c.id}/threads`);
    box.innerHTML = `
      <div class="toolbar"><button class="btn primary" data-action="new-thread">${icon('plus')} Diskusi Baru</button></div>
      <div class="stack">${threads.length ? threads.map((t) => `
        <a class="row-card" href="#/class/${c.id}/threads/${t.id}">
          <div><h3>${esc(t.title)}</h3><span class="muted">${esc(t.author_name)}${t.author_role === 'teacher' ? ' (guru)' : ''} &middot; ${fmt(t.created_at)}</span></div>
          <span class="chip info">${t.reply_count} balasan</span></a>`).join('') : empty('Belum ada diskusi', 'Mulai diskusi pertama dan ajak teman sekelas bertukar pikiran.')}</div>`;
  }
  async function viewThread(box, c, tid) {
    const { thread: t, replies } = await api(`/classes/${c.id}/threads/${tid}`);
    const can = (x) => c.isOwner || x.author_id === state.user.id;
    const who = (x) => `<div class="who-line"><b>${esc(x.author_name)}</b>${x.author_role === 'teacher' ? '<span class="chip info">Guru</span>' : ''}<span class="muted">${fmt(x.created_at)}</span></div>`;
    box.innerHTML = `
      <a class="back" href="#/class/${c.id}/threads">${icon('back', 16)} Semua diskusi</a>
      <article class="card">
        <div style="display:flex;justify-content:space-between;gap:10px"><h2>${esc(t.title)}</h2>
          ${can(t) ? `<button class="icon-btn" data-action="del-thread" data-id="${t.id}" title="Hapus diskusi" aria-label="Hapus diskusi">${icon('trash', 17)}</button>` : ''}</div>
        ${who(t)}<p class="prewrap">${esc(t.content)}</p>
      </article>
      <h3 style="margin:22px 0 6px">${replies.length} Balasan</h3>
      <div class="card" style="padding-top:6px;padding-bottom:6px">${replies.length ? replies.map((r) => `
        <div class="reply">${who(r)}
          <div style="display:flex;justify-content:space-between;gap:10px"><p class="prewrap" style="margin:0">${esc(r.content)}</p>
          ${can(r) ? `<button class="icon-btn" data-action="del-reply" data-tid="${t.id}" data-id="${r.id}" title="Hapus" aria-label="Hapus balasan">${icon('trash', 16)}</button>` : ''}</div>
        </div>`).join('') : '<p class="muted" style="padding:12px 0;margin:0">Belum ada balasan.</p>'}</div>
      <form class="card" data-form="reply" data-tid="${t.id}" style="margin-top:16px">
        <label>Tulis balasan<textarea name="content" required maxlength="5000" placeholder="Bagikan jawaban atau pendapat Anda…"></textarea></label>
        <button class="btn primary" type="submit">Kirim Balasan</button>
      </form>`;
  }

  /* Chat real-time */
  async function tabChat(box, c) {
    box.innerHTML = `
      <div class="chat">
        <div class="chat-top" hidden><button class="btn small ghost" data-action="older">Muat pesan sebelumnya</button></div>
        <div class="chat-log" id="chat-log" aria-live="polite">${loading}</div>
        <div class="typing" id="typing"></div>
        <form class="chat-form" data-form="chat" data-cid="${c.id}">
          <textarea name="content" rows="1" maxlength="2000" required placeholder="Tulis pesan… (Enter untuk kirim)" aria-label="Pesan"></textarea>
          <button class="btn primary" type="submit" aria-label="Kirim">${icon('send')}</button>
        </form>
      </div>`;
    const log = $('#chat-log', box);
    const top = $('.chat-top', box);
    const ta = $('textarea', box);
    const bubble = (m) => {
      const mine = m.user_id === state.user.id;
      return `<div class="msg ${mine ? 'mine' : ''}">${mine ? '' : `<span class="msg-name">${esc(m.user_name)}${m.user_role === 'teacher' ? ' <em>guru</em>' : ''}</span>`}
        <div class="bubble">${esc(m.content)}</div><span class="msg-time">${clock(m.created_at)}</span></div>`;
    };
    const { messages, has_more } = await api(`/classes/${c.id}/messages?limit=50`);
    log.innerHTML = messages.length ? messages.map(bubble).join('') : '<p class="muted" id="no-msg" style="text-align:center;margin:auto">Belum ada pesan. Sapa teman sekelasmu!</p>';
    log.scrollTop = log.scrollHeight;
    top.hidden = !has_more;
    ctx.chat = { cid: c.id, oldest: messages[0]?.id ?? null, log, top, bubble };

    const s = getSocket();
    const join = () => s.emit('class:join', c.id, (r) => { if (!r?.ok) toast(r?.error || 'Gagal terhubung ke chat', 'err'); });
    const onMsg = (m) => {
      if (m.class_id !== c.id) return;
      $('#no-msg')?.remove();
      const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80 || m.user_id === state.user.id;
      log.insertAdjacentHTML('beforeend', bubble(m));
      if (atBottom) log.scrollTop = log.scrollHeight;
    };
    const typers = new Map();
    const paintTyping = () => {
      const names = [...typers.values()].map((v) => v.name);
      $('#typing', box).textContent = names.length ? `${names.join(', ')} sedang mengetik…` : '';
    };
    const onTyping = ({ userId, name, isTyping }) => {
      clearTimeout(typers.get(userId)?.t);
      if (isTyping) typers.set(userId, { name, t: setTimeout(() => { typers.delete(userId); paintTyping(); }, 4000) });
      else typers.delete(userId);
      paintTyping();
    };
    s.on('connect', join); s.on('message:new', onMsg); s.on('typing', onTyping);
    if (s.connected) join();

    let typingTimer, sentTyping = false;
    const stopTyping = () => { if (sentTyping) { sentTyping = false; s.emit('typing', { classId: c.id, isTyping: false }); } };
    ta.addEventListener('input', () => {
      if (!sentTyping) { sentTyping = true; s.emit('typing', { classId: c.id, isTyping: true }); }
      clearTimeout(typingTimer); typingTimer = setTimeout(stopTyping, 1500);
    });
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ta.form.requestSubmit(); }
    });
    ctx.chat.stopTyping = stopTyping;
    cleanup = () => {
      s.off('connect', join); s.off('message:new', onMsg); s.off('typing', onTyping);
      clearTimeout(typingTimer); stopTyping(); s.emit('class:leave', c.id); ctx.chat = null;
    };
  }

  /* Anggota */
  async function tabMembers(box, c) {
    const { teacher, students } = await api(`/classes/${c.id}/members`);
    const person = (u, extra = '') => `
      <div class="person"><span class="avatar">${esc(initials(u.name))}</span>
        <div class="grow"><b>${esc(u.name)}</b><br><small class="muted">${esc(u.email)}</small></div>${extra}</div>`;
    box.innerHTML = `
      <div class="card"><h3>Guru</h3>${person(teacher)}</div>
      <div class="card" style="margin-top:16px"><h3>Siswa (${students.length})</h3>
        ${students.length ? students.map((u) => person(u,
          c.isOwner ? `<button class="btn danger small" data-action="kick" data-id="${u.id}" data-name="${esc(u.name)}">Keluarkan</button>`
          : u.id === state.user.id ? '<button class="btn danger small" data-action="leave">Keluar dari kelas</button>' : '')).join('')
          : '<p class="muted">Belum ada siswa. Bagikan kode kelas untuk mengundang.</p>'}</div>
      ${c.isOwner ? `<div class="card danger-zone"><h3>Zona berbahaya</h3><p class="muted">Menghapus kelas akan menghapus semua materi, tugas, diskusi, dan chat secara permanen.</p>
        <button class="btn danger" data-action="del-class">${icon('trash', 15)} Hapus kelas</button></div>` : ''}`;
  }

  /* ---------- Actions (klik) ---------- */
  const reload = () => route();
  const actions = {
    'close-modal': closeModal,
    'auth-mode': (el) => viewAuth(el.dataset.mode),
    demo: (el) => {
      $('[name=email]').value = el.dataset.email;
      $('[name=password]').value = 'password123';
      $('form[data-form=login]').requestSubmit();
    },
    logout: () => logout(true),
    'new-class': () => openModal('Buat Kelas Baru', `
      <form data-form="new-class">
        <label>Nama kelas<input name="name" required minlength="3" maxlength="100" placeholder="Mis. Matematika XI IPA 1"></label>
        <label>Deskripsi <span class="hint">(opsional)</span><textarea name="description" maxlength="1000"></textarea></label>
        <div class="modal-actions"><button type="button" class="btn" data-action="close-modal">Batal</button><button class="btn primary" type="submit">Buat Kelas</button></div>
      </form>`),
    'join-class': () => openModal('Gabung ke Kelas', `
      <form data-form="join-class">
        <label>Kode kelas<input name="code" required minlength="6" maxlength="6" placeholder="ABC123" style="text-transform:uppercase;letter-spacing:.2em;font-weight:700" autocomplete="off"></label>
        <p class="muted">Minta kode 6 karakter dari gurumu.</p>
        <div class="modal-actions"><button type="button" class="btn" data-action="close-modal">Batal</button><button class="btn primary" type="submit">Gabung</button></div>
      </form>`),
    'copy-code': async (el) => {
      try { await navigator.clipboard.writeText(el.dataset.code); toast('Kode kelas disalin'); }
      catch { toast('Kode: ' + el.dataset.code); }
    },
    'regen-code': async () => {
      if (!confirm('Buat kode baru? Kode lama tidak bisa dipakai lagi untuk bergabung.')) return;
      await api(`/classes/${ctx.cls.id}/regenerate-code`, { method: 'POST' });
      toast('Kode kelas diperbarui'); reload();
    },
    'del-post': async (el) => {
      if (!confirm('Hapus postingan ini?')) return;
      await api(`/classes/${ctx.cls.id}/posts/${el.dataset.id}`, { method: 'DELETE' }); reload();
    },
    'new-assignment': () => openModal('Buat Tugas', `
      <form data-form="new-assignment">
        <label>Judul<input name="title" required minlength="2" maxlength="200"></label>
        <label>Instruksi<textarea name="description" maxlength="10000"></textarea></label>
        <div class="row">
          <label>Tenggat <span class="hint">(opsional)</span><input type="datetime-local" name="due"></label>
          <label>Nilai maksimal<input type="number" name="max_score" min="1" max="1000" value="100" required></label>
        </div>
        <div class="modal-actions"><button type="button" class="btn" data-action="close-modal">Batal</button><button class="btn primary" type="submit">Simpan</button></div>
      </form>`),
    'del-assignment': async (el) => {
      if (!confirm('Hapus tugas beserta semua pengumpulannya?')) return;
      await api(`/classes/${ctx.cls.id}/assignments/${el.dataset.id}`, { method: 'DELETE' });
      navigate(`#/class/${ctx.cls.id}/assignments`);
    },
    'new-thread': () => openModal('Diskusi Baru', `
      <form data-form="thread">
        <label>Judul<input name="title" required minlength="3" maxlength="200" placeholder="Apa yang ingin dibahas?"></label>
        <label>Isi<textarea name="content" required maxlength="10000"></textarea></label>
        <div class="modal-actions"><button type="button" class="btn" data-action="close-modal">Batal</button><button class="btn primary" type="submit">Posting</button></div>
      </form>`),
    'del-thread': async (el) => {
      if (!confirm('Hapus diskusi ini beserta balasannya?')) return;
      await api(`/classes/${ctx.cls.id}/threads/${el.dataset.id}`, { method: 'DELETE' });
      navigate(`#/class/${ctx.cls.id}/threads`);
    },
    'del-reply': async (el) => {
      if (!confirm('Hapus balasan ini?')) return;
      await api(`/classes/${ctx.cls.id}/threads/${el.dataset.tid}/replies/${el.dataset.id}`, { method: 'DELETE' }); reload();
    },
    older: async () => {
      const ch = ctx.chat; if (!ch || !ch.oldest) return;
      const { messages, has_more } = await api(`/classes/${ch.cid}/messages?limit=50&before=${ch.oldest}`);
      if (messages.length) {
        const prev = ch.log.scrollHeight;
        ch.log.insertAdjacentHTML('afterbegin', messages.map(ch.bubble).join(''));
        ch.log.scrollTop += ch.log.scrollHeight - prev;
        ch.oldest = messages[0].id;
      }
      ch.top.hidden = !has_more;
    },
    kick: async (el) => {
      if (!confirm(`Keluarkan ${el.dataset.name} dari kelas?`)) return;
      await api(`/classes/${ctx.cls.id}/members/${el.dataset.id}`, { method: 'DELETE' }); reload();
    },
    leave: async () => {
      if (!confirm('Keluar dari kelas ini?')) return;
      await api(`/classes/${ctx.cls.id}/members/${state.user.id}`, { method: 'DELETE' });
      toast('Anda telah keluar dari kelas'); navigate('#/');
    },
    'del-class': async () => {
      if (!confirm(`Hapus kelas "${ctx.cls.name}" secara permanen?`)) return;
      await api(`/classes/${ctx.cls.id}`, { method: 'DELETE' });
      toast('Kelas dihapus'); navigate('#/');
    },
  };

  /* ---------- Forms (submit) ---------- */
  const cid = () => ctx.cls.id;
  const forms = {
    login: async (d) => {
      setSession(await api('/auth/login', { method: 'POST', body: d }));
      navigate('#/');
    },
    register: async (d) => {
      setSession(await api('/auth/register', { method: 'POST', body: d }));
      toast('Akun berhasil dibuat. Selamat datang!'); navigate('#/');
    },
    'new-class': async (d) => {
      const { class: c } = await api('/classes', { method: 'POST', body: clean(d) });
      closeModal(); toast(`Kelas dibuat! Kode: ${c.code}`); navigate(`#/class/${c.id}`);
    },
    'join-class': async (d) => {
      const r = await api('/classes/join', { method: 'POST', body: { code: d.code.trim() } });
      closeModal(); toast(r.joined ? 'Berhasil bergabung ke kelas' : 'Anda sudah ada di kelas ini'); navigate(`#/class/${r.class.id}`);
    },
    post: async (d) => {
      await api(`/classes/${cid()}/posts`, { method: 'POST', body: clean(d) }); toast('Berhasil diposting'); reload();
    },
    'new-assignment': async (d) => {
      await api(`/classes/${cid()}/assignments`, {
        method: 'POST',
        body: { title: d.title, description: d.description, max_score: Number(d.max_score), due_date: d.due ? new Date(d.due).toISOString() : undefined },
      });
      closeModal(); toast('Tugas dibuat'); reload();
    },
    submit: async (d, form) => {
      await api(`/classes/${cid()}/assignments/${form.dataset.aid}/submissions`, { method: 'POST', body: clean(d) });
      toast('Jawaban terkirim'); reload();
    },
    grade: async (d, form) => {
      const aid = location.hash.split('/')[4];
      await api(`/classes/${cid()}/assignments/${aid}/submissions/${form.dataset.sid}/grade`, {
        method: 'PATCH', body: { score: Number(d.score), feedback: d.feedback || '' },
      });
      toast('Nilai tersimpan');
    },
    thread: async (d) => {
      const { thread } = await api(`/classes/${cid()}/threads`, { method: 'POST', body: d });
      closeModal(); navigate(`#/class/${cid()}/threads/${thread.id}`);
    },
    reply: async (d, form) => {
      await api(`/classes/${cid()}/threads/${form.dataset.tid}/replies`, { method: 'POST', body: d }); reload();
    },
    chat: (d, form) => new Promise((resolve) => {
      const content = (d.content || '').trim();
      if (!content) return resolve();
      getSocket().emit('message:send', { classId: Number(form.dataset.cid), content }, (r) => {
        if (r?.ok) { form.reset(); ctx.chat?.stopTyping(); } else toast(r?.error || 'Pesan gagal dikirim', 'err');
        resolve();
      });
    }),
  };

  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-action]');
    const fn = el && actions[el.dataset.action];
    if (!fn) return;
    try { await fn(el, e); } catch (err) { toast(err.message, 'err'); }
  });
  document.addEventListener('submit', async (e) => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    if (btn) btn.disabled = true;
    try { await forms[form.dataset.form](Object.fromEntries(new FormData(form)), form); }
    catch (err) { toast(err.message, 'err'); }
    finally { if (btn) btn.disabled = false; }
  });

  /* ---------- Router ---------- */
  async function route() {
    cleanup?.(); cleanup = null;
    closeModal();
    if (!state.user) return viewAuth($('.seg .on')?.dataset.mode || 'login');
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (parts[0] === 'login') return navigate('#/');
    shell();
    const view = $('#view');
    view.innerHTML = loading;
    window.scrollTo(0, 0);
    try {
      if (parts[0] === 'class') await viewClass(view, Number(parts[1]), parts[2], parts[3]);
      else await viewDashboard(view);
    } catch (err) {
      if (!state.user) return;
      view.innerHTML = `<div class="empty"><h3>${err.status === 404 ? 'Tidak ditemukan' : err.status === 403 ? 'Akses ditolak' : 'Terjadi masalah'}</h3>
        <p>${esc(err.message)}</p><a class="btn" href="#/">Kembali ke beranda</a></div>`;
    }
  }
  window.addEventListener('hashchange', route);

  /* ---------- Boot ---------- */
  (async () => {
    if (getToken()) {
      try { state.user = (await api('/auth/me')).user; } catch { localStorage.removeItem('kk_token'); }
    }
    route();
  })();
})();
