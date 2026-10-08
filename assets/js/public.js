/* SIPALING LSP UNIMED — halaman layanan publik (asesi / pemohon) */
(function () {
  const { api, esc, $, $$, tgl, rupiah, badge, toast, loading, fileToPayload, formData, busy, copy, icon, SOP, tahapPeserta, store, DEMO, CFG } = window.S;

  const NAV = [
    { group: null, items: [['beranda', 'Beranda', 'home']] },
    { group: 'Informasi', items: [['alur', 'Alur Layanan (SOP)', 'flow'], ['skema', 'Skema Sertifikasi', 'book'], ['dokumen', 'Dokumen Mutu', 'file']] },
    { group: 'Uji Kompetensi', items: [['jadwal', 'Jadwal & Registrasi UK', 'cal'], ['status', 'Status Pendaftaran', 'search'], ['plotting', 'Plotting Jadwal & TUK', 'grid'], ['hasil', 'Hasil Uji Kompetensi', 'check'], ['sertifikat', 'Tracer Sertifikat', 'award']] },
    { group: 'Layanan Pasca-Uji', items: [['banding', 'Banding Asesmen', 'scale'], ['surveilans', 'Surveilans', 'eye'], ['legalisir', 'Legalisir Sertifikat', 'stamp'], ['rcc', 'Perpanjangan (RCC)', 'refresh']] },
    { group: 'Pengaduan & Mutu', items: [['keluhan', 'Keluhan Layanan', 'chat'], ['tiket', 'Lacak Tiket', 'ticket'], ['survei', 'Survei Kepuasan', 'star']] }
  ];
  const TITLES = {}; NAV.forEach(g => g.items.forEach(i => TITLES[i[0]] = i[1])); TITLES.daftar = 'Formulir Pendaftaran';

  let PD = null; // data publik (cache)
  const view = $('#view');

  async function pd(force) {
    if (!PD || force) PD = await api('publicData');
    return PD;
  }

  /* ---------------- Kerangka ---------------- */
  function renderNav(active) {
    $('#nav').innerHTML = NAV.map(g => (g.group ? `<div class="nav-group">${esc(g.group)}</div>` : '') +
      g.items.map(i => `<a href="#/${i[0]}" class="${active === i[0] ? 'active' : ''}">${icon(i[2])}<span>${esc(i[1])}</span></a>`).join('')).join('');
  }

  function footer(p) {
    $('#footer').innerHTML = `<b>${esc(p.nama_lsp || 'LSP UNIMED')}</b>${p.nomor_lisensi ? ' · Lisensi ' + esc(p.nomor_lisensi) : ''}<br>
      ${esc(p.alamat || '')}${p.email ? ' · ' + esc(p.email) : ''}${p.telepon ? ' · ' + esc(p.telepon) : ''}${p.jam_layanan ? ' · Layanan: ' + esc(p.jam_layanan) : ''}`;
  }

  async function router() {
    const parts = (location.hash.replace(/^#\/?/, '') || 'beranda').split('/');
    const page = parts[0];
    renderNav(page === 'daftar' ? 'jadwal' : page);
    $('#pageTitle').textContent = TITLES[page] || 'Beranda';
    document.body.classList.remove('nav-open');
    window.scrollTo(0, 0);
    view.innerHTML = loading();
    try {
      const data = await pd();
      footer(data.pengaturan);
      const fn = PAGES[page] || PAGES.beranda;
      await fn(data, parts.slice(1));
    } catch (e) {
      view.innerHTML = `<div class="notice bad"><b>Gagal memuat.</b> ${esc(e.message)}</div><button class="btn ghost" onclick="location.reload()">Muat ulang</button>`;
    }
  }

  /* ---------------- Komponen lookup peserta ---------------- */
  function lookupForm(id, judul, tombol) {
    const last = JSON.parse(store.get('sipaling_lookup') || '{}');
    return `<div class="card no-print"><h2>${esc(judul)}</h2>
      <p class="muted">Masukkan Nomor Registrasi dan email yang Anda gunakan saat mendaftar.</p>
      <form class="form" id="${id}">
        <div class="row">
          <label class="f">No. Registrasi <input name="no_reg" required placeholder="LSPU-2610-0001" value="${esc(last.no_reg || '')}" autocomplete="off"></label>
          <label class="f">Email terdaftar <input name="email" type="email" required placeholder="nama@email.com" value="${esc(last.email || '')}"></label>
        </div>
        <div><button class="btn" type="submit">${icon('search')} ${esc(tombol)}</button></div>
      </form></div><div id="${id}-out"></div>`;
  }

  function bindLookup(id, render) {
    const f = $('#' + id);
    const out = $('#' + id + '-out');
    const go = async (btn) => {
      const d = formData(f);
      out.innerHTML = loading('Mencari data…');
      try {
        const r = await api('lacak', d);
        store.set('sipaling_lookup', JSON.stringify(d));
        out.innerHTML = render(r);
      } catch (e) { out.innerHTML = `<div class="notice bad">${esc(e.message)}</div>`; }
    };
    f.addEventListener('submit', (e) => { e.preventDefault(); busy($('button[type=submit]', f), go); });
    if ($('[name=no_reg]', f).value && $('[name=email]', f).value) go();
  }

  function identitas(r) {
    return `<dl class="kv">
      <dt>No. Registrasi</dt><dd class="mono">${esc(r.no_reg)}</dd>
      <dt>Nama</dt><dd>${esc(r.nama)}</dd>
      <dt>NIK</dt><dd class="mono">${esc(r.nik)}</dd>
      <dt>Skema</dt><dd>${esc(r.skema)} ${r.kode_skema ? '<small class="mono">(' + esc(r.kode_skema) + ')</small>' : ''}</dd>
      <dt>Jadwal pilihan</dt><dd>${tgl(r.jadwal_tanggal, true)}</dd>
      <dt>Tanggal daftar</dt><dd>${tgl(r.waktu_daftar)}</dd></dl>`;
  }

  function timeline(r) {
    const T = tahapPeserta(r);
    const items = SOP.langkah.filter(l => T[l.no]);
    return `<ul class="timeline">${items.map(l => {
      const t = T[l.no];
      const cls = t.st === 'done' ? 'done' : t.st === 'now' ? 'now' : t.st === 'fail' ? 'fail' : '';
      return `<li class="${cls}"><span class="dot">${t.st === 'done' ? '✓' : t.st === 'fail' ? '!' : l.no}</span>
        <b>${l.no}. ${esc(l.nama)}</b><small>${esc(t.info || (t.st === 'skip' ? 'Tidak berlaku' : 'Belum sampai tahap ini'))}</small></li>`;
    }).join('')}</ul>`;
  }

  /* ---------------- Halaman ---------------- */
  const PAGES = {
    beranda(D) {
      const p = D.pengaturan, s = D.statistik;
      const next = D.jadwal.filter(j => j.bisa_daftar).slice(0, 5);
      view.innerHTML = `
      <section class="hero">
        <h1>SIPALING <em>${esc(p.nama_singkat || 'LSP UNIMED')}</em></h1>
        <div class="sub">${esc(p.tagline || 'Sistem Informasi Pelayanan Sertifikasi Terintegrasi')}</div>
        <p>${esc(p.deskripsi || '')}</p>
        <div class="actions">
          <a class="btn gold" href="#/jadwal">${icon('cal')} Daftar Uji Kompetensi</a>
          <a class="btn light" href="#/status">${icon('search')} Cek Status Pendaftaran</a>
          <a class="btn light" href="#/alur">${icon('flow')} Alur Layanan</a>
        </div>
      </section>
      ${p.pengumuman ? `<div class="notice"><b>Pengumuman.</b> ${esc(p.pengumuman)}</div>` : ''}
      <h2>Statistik Layanan</h2>
      <div class="grid g4" style="margin-bottom:18px">
        <div class="stat"><div class="k">Skema</div><div class="v">${s.skema}</div></div>
        <div class="stat"><div class="k">TUK</div><div class="v">${s.tuk}</div></div>
        <div class="stat"><div class="k">Asesor</div><div class="v">${s.asesor}</div></div>
        <div class="stat"><div class="k">Asesi</div><div class="v">${Number(s.asesi).toLocaleString('id-ID')}</div></div>
      </div>
      <div class="grid g2">
        <div class="card"><div class="card-head"><h3>Jadwal uji yang dibuka</h3><a href="#/jadwal" class="btn sm ghost">Lihat semua</a></div>
          ${next.length ? `<div class="table-wrap"><table><thead><tr><th>Skema</th><th>Tanggal</th><th>Sisa</th></tr></thead><tbody>
            ${next.map(j => `<tr class="clickable" onclick="location.hash='#/daftar/${esc(j.id_jadwal)}'"><td>${esc(j.nama_skema)}</td><td>${tgl(j.tanggal)}</td><td>${+j.kuota ? j.sisa : '∞'}</td></tr>`).join('')}
          </tbody></table></div>` : '<p class="muted">Belum ada jadwal yang dibuka.</p>'}
        </div>
        <div class="card"><h3>Layanan cepat</h3>
          <div class="grid g2">
            <a class="btn ghost" href="#/hasil">${icon('check')} Hasil Uji</a>
            <a class="btn ghost" href="#/sertifikat">${icon('award')} Tracer Sertifikat</a>
            <a class="btn ghost" href="#/plotting">${icon('grid')} Plotting & TUK</a>
            <a class="btn ghost" href="#/keluhan">${icon('chat')} Sampaikan Keluhan</a>
            <a class="btn ghost" href="#/legalisir">${icon('stamp')} Legalisir</a>
            <a class="btn ghost" href="#/survei">${icon('star')} Survei Kepuasan</a>
          </div>
        </div>
      </div>
      <div class="card"><div class="card-head"><h3>Alur pelayanan sertifikasi</h3><small class="mono">${esc(SOP.nomor)} · Rev. ${esc(SOP.revisi)}</small></div>
        <div class="mini-steps">${SOP.langkah.map(l => `<div><b>Langkah ${l.no}</b>${esc(l.nama)}</div>`).join('')}</div>
      </div>`;
    },

    alur() {
      view.innerHTML = `
      <div class="card">
        <div class="card-head"><h2>SOP ${esc(SOP.judul)}</h2><span class="badge info mono">${esc(SOP.nomor)} · Rev. ${esc(SOP.revisi)} · Berlaku ${esc(SOP.berlaku)}</span></div>
        <dl class="kv">
          <dt>Tujuan</dt><dd style="font-weight:500">${esc(SOP.tujuan)}</dd>
          <dt>Ruang lingkup</dt><dd style="font-weight:500">${esc(SOP.ruang)}</dd>
          <dt>Koordinator</dt><dd>${esc(SOP.koordinator)}</dd>
          <dt>Acuan</dt><dd style="font-weight:500"><ol style="margin:0;padding-left:18px">${SOP.acuan.map(a => `<li>${esc(a)}</li>`).join('')}</ol></dd>
        </dl>
      </div>
      <h2>Proses prosedur &amp; layanan di SIPALING</h2>
      <div class="steps">${SOP.langkah.map(l => `
        <div class="step"><div class="num">${l.no}</div><div>
          <h3>${esc(l.nama)}</h3>
          <ol>${l.instruksi.map(i => `<li>${esc(i)}</li>`).join('')}</ol>
          <div class="meta"><span class="badge">Keluaran: ${esc(l.media)}</span><span class="badge warn">PJ: ${esc(l.pj)}</span>
          ${l.fitur.map(f => `<span class="badge ok">${esc(f)}</span>`).join('')}</div>
        </div></div>`).join('')}
      </div>
      <div class="card" style="margin-top:18px">
        <h3>Dokumen terkait</h3><p>${esc(SOP.dokumenTerkait)}</p>
        <h3>Catatan mutu</h3><p style="margin:0">${esc(SOP.catatanMutu)}</p>
      </div>`;
    },

    skema(D) {
      const draw = (q) => {
        const list = D.skema.filter(s => !q || (s.nama_skema + ' ' + s.kode_skema).toLowerCase().indexOf(q) >= 0);
        $('#skList').innerHTML = list.length ? list.map(s => {
          const jd = D.jadwal.filter(j => j.id_skema === s.id_skema && j.bisa_daftar).length;
          return `<div class="card skema-card">
            <div class="code mono">${esc(s.kode_skema)}</div>
            <h3 style="margin:0">${esc(s.nama_skema)}</h3>
            <div><span class="badge info">${esc(s.jenis_skema || 'Skema')}</span> <span class="badge">${esc(s.jumlah_unit || '-')} unit kompetensi</span></div>
            <div><small class="muted">Biaya:</small> <b>${rupiah(s.biaya)}</b></div>
            ${s.persyaratan ? `<div><small class="muted">Persyaratan dasar:</small><ul>${String(s.persyaratan).split(/\n+/).filter(String).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
            <div class="foot">
              ${s.link_dokumen ? `<a class="btn sm ghost" href="${esc(s.link_dokumen)}" target="_blank" rel="noopener">${icon('download')} Dokumen skema</a>` : ''}
              <a class="btn sm ${jd ? 'gold' : 'ghost'}" href="#/jadwal/${esc(s.id_skema)}">${icon('cal')} ${jd ? jd + ' jadwal dibuka' : 'Lihat jadwal'}</a>
            </div></div>`;
        }).join('') : '<div class="empty">Skema tidak ditemukan.</div>';
      };
      view.innerHTML = `<div class="toolbar"><input id="skQ" placeholder="Cari nama atau kode skema…"><span class="badge">${D.skema.length} skema</span></div><div class="grid g3" id="skList"></div>`;
      $('#skQ').oninput = (e) => draw(e.target.value.toLowerCase().trim());
      draw('');
    },

    dokumen(D) {
      const kat = {};
      D.dokumen.forEach(d => (kat[d.kategori || 'Lainnya'] = kat[d.kategori || 'Lainnya'] || []).push(d));
      view.innerHTML = `<div class="notice info">Dokumen mutu dan acuan yang menjadi dasar pelayanan sertifikasi LSP. Formulir dapat diunduh bila tautan tersedia.</div>` +
        Object.keys(kat).map(k => `<div class="card"><h3>${esc(k)}</h3><div class="table-wrap"><table><thead><tr><th style="width:200px">Nomor</th><th>Judul</th><th style="width:120px"></th></tr></thead><tbody>
          ${kat[k].map(d => `<tr><td class="mono">${esc(d.nomor)}</td><td>${esc(d.judul)}</td><td>${d.link ? `<a class="btn sm ghost" target="_blank" rel="noopener" href="${esc(d.link)}">Buka</a>` : '<small class="muted">—</small>'}</td></tr>`).join('')}
        </tbody></table></div></div>`).join('');
    },

    jadwal(D, args) {
      const pre = args[0] || '';
      view.innerHTML = `<div class="toolbar">
        <select id="jdS"><option value="">Semua skema</option>${D.skema.map(s => `<option value="${esc(s.id_skema)}" ${pre === s.id_skema ? 'selected' : ''}>${esc(s.nama_skema)}</option>`).join('')}</select>
        <label class="check" style="flex:none"><input type="checkbox" id="jdO" checked> Hanya yang dibuka</label></div>
        <div class="table-wrap"><table><thead><tr><th>Skema</th><th>Tanggal &amp; waktu</th><th>TUK</th><th>Batas daftar</th><th>Kuota</th><th>Status</th><th></th></tr></thead><tbody id="jdB"></tbody></table></div>
        <p class="muted" style="margin-top:12px">Jadwal final, asesor, dan TUK ditetapkan setelah verifikasi persyaratan (Langkah 3–4 SOP) dan dapat dilihat di menu <a href="#/plotting">Plotting Jadwal &amp; TUK</a>.</p>`;
      const draw = () => {
        const s = $('#jdS').value, o = $('#jdO').checked;
        const list = D.jadwal.filter(j => (!s || j.id_skema === s) && (!o || j.bisa_daftar));
        $('#jdB').innerHTML = list.length ? list.map(j => `<tr>
          <td><b>${esc(j.nama_skema)}</b><br><small class="mono muted">${esc(j.id_jadwal)} ${j.keterangan ? '· ' + esc(j.keterangan) : ''}</small></td>
          <td>${tgl(j.tanggal, true)}<br><small class="muted">${esc(j.waktu || '')}</small></td>
          <td>${esc(j.nama_tuk || '')}</td><td>${tgl(j.batas_daftar)}</td>
          <td>${+j.kuota ? `${j.terisi}/${j.kuota}` : j.terisi + ' pendaftar'}</td>
          <td>${badge(j.bisa_daftar ? 'Dibuka' : j.status === 'Dibuka' ? 'Ditutup' : j.status)}</td>
          <td>${j.bisa_daftar ? `<a class="btn sm gold" href="#/daftar/${esc(j.id_jadwal)}">Daftar</a>` : ''}</td></tr>`).join('')
          : '<tr><td colspan="7" class="empty">Tidak ada jadwal yang sesuai.</td></tr>';
      };
      $('#jdS').onchange = draw; $('#jdO').onchange = draw; draw();
    },

    daftar(D, args) {
      const j = D.jadwal.find(x => x.id_jadwal === args[0]);
      if (!j) { view.innerHTML = '<div class="notice bad">Jadwal tidak ditemukan.</div><a class="btn ghost" href="#/jadwal">Kembali ke jadwal</a>'; return; }
      if (!j.bisa_daftar) { view.innerHTML = '<div class="notice bad">Pendaftaran untuk jadwal ini sudah ditutup atau kuota penuh.</div><a class="btn ghost" href="#/jadwal">Pilih jadwal lain</a>'; return; }
      const sk = D.skema.find(s => s.id_skema === j.id_skema) || {};
      const apl02 = D.pengaturan.link_template_apl02;
      const file = (name, label, req, hint) => `<label class="f">${label} ${req ? '<span class="req">*</span>' : ''}<input type="file" name="${name}" accept=".pdf,.jpg,.jpeg,.png" ${req ? 'required' : ''}><small class="muted">${hint || 'PDF/JPG/PNG, maks. ' + (CFG.MAX_FILE_MB || 2) + ' MB'}</small></label>`;
      view.innerHTML = `
      <div class="card"><div class="card-head"><div><small class="muted">Jadwal dipilih</small><h2 style="margin:0">${esc(j.nama_skema)}</h2></div><a class="btn sm ghost" href="#/jadwal">Ganti jadwal</a></div>
        <dl class="kv"><dt>Tanggal</dt><dd>${tgl(j.tanggal, true)} ${esc(j.waktu || '')}</dd><dt>TUK</dt><dd>${esc(j.nama_tuk || '')}</dd><dt>Batas pendaftaran</dt><dd>${tgl(j.batas_daftar)}</dd>
        ${sk.persyaratan ? `<dt>Persyaratan</dt><dd style="font-weight:500">${esc(sk.persyaratan).replace(/\n/g, '<br>')}</dd>` : ''}</dl></div>
      <form class="card form" id="fDaftar" novalidate>
        <h2>Formulir Permohonan Sertifikasi (APL-01)</h2>
        <fieldset><legend>Data pribadi</legend><div class="form">
          <div class="row"><label class="f">Nama lengkap (sesuai KTP) <span class="req">*</span><input name="nama" required></label>
          <label class="f">NIK <span class="req">*</span><input name="nik" required inputmode="numeric" maxlength="16" pattern="\\d{16}" placeholder="16 digit"></label></div>
          <div class="row r3"><label class="f">Tempat lahir <span class="req">*</span><input name="tempat_lahir" required></label>
          <label class="f">Tanggal lahir <span class="req">*</span><input type="date" name="tanggal_lahir" required></label>
          <label class="f">Jenis kelamin <span class="req">*</span><select name="jenis_kelamin" required><option value="">Pilih…</option><option>Laki-laki</option><option>Perempuan</option></select></label></div>
          <label class="f">Alamat rumah <span class="req">*</span><textarea name="alamat" required style="min-height:60px"></textarea></label>
        </div></fieldset>
        <fieldset><legend>Kontak</legend><div class="row">
          <label class="f">Email aktif <span class="req">*</span><input type="email" name="email" required><small class="muted">Semua informasi resmi dikirim ke email ini.</small></label>
          <label class="f">No. HP / WhatsApp <span class="req">*</span><input name="hp" required inputmode="tel"></label></div></fieldset>
        <fieldset><legend>Pendidikan &amp; pekerjaan</legend><div class="form">
          <div class="row"><label class="f">NIM (jika mahasiswa)<input name="nim"></label>
          <label class="f">Pendidikan terakhir <span class="req">*</span><select name="pendidikan" required><option value="">Pilih…</option><option>SMA/SMK</option><option>D3</option><option>D4/S1</option><option>S2</option><option>S3</option></select></label></div>
          <div class="row"><label class="f">Program studi / instansi<input name="instansi" placeholder="mis. Pendidikan Teknik Mesin, Unimed"></label>
          <label class="f">Pekerjaan / jabatan<input name="pekerjaan" placeholder="mis. Mahasiswa"></label></div>
          <label class="f">Tujuan asesmen <span class="req">*</span><select name="tujuan_asesmen" required><option value="">Pilih…</option><option>Sertifikasi</option><option>Sertifikasi Ulang</option><option>Pengakuan Kompetensi Terkini (PKT)</option><option>Rekognisi Pembelajaran Lampau (RPL)</option><option>Lainnya</option></select></label>
        </div></fieldset>
        <fieldset><legend>Dokumen persyaratan</legend><div class="form">
          <div class="row">${file('file_ktp', 'Scan KTP', true)}${file('file_foto', 'Pas foto berwarna', true, 'JPG/PNG latar merah/biru, maks. ' + (CFG.MAX_FILE_MB || 2) + ' MB')}</div>
          <div class="row">${file('file_ijazah', 'Ijazah / transkrip / KHS', false)}${file('file_apl02', 'APL-02 (asesmen mandiri) yang telah diisi', false, apl02 ? `Unduh template: <a href="${esc(apl02)}" target="_blank" rel="noopener">FR.APL.02</a>` : '')}</div>
          ${file('file_pendukung', 'Bukti pendukung lain (sertifikat pelatihan, surat magang, portofolio)', false, 'Gabungkan dalam satu PDF, maks. ' + (CFG.MAX_FILE_MB || 2) + ' MB')}
        </div></fieldset>
        <label class="check"><input type="checkbox" name="setuju"> <span>Saya menyatakan data dan dokumen yang saya sampaikan benar. Saya bersedia mengikuti asesmen sesuai ketentuan LSP dan memahami bahwa data saya dijaga kerahasiaannya.</span></label>
        <div><button class="btn gold" type="submit">${icon('send')} Kirim permohonan</button></div>
        <div id="dOut"></div>
      </form>`;
      const f = $('#fDaftar');
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        busy($('button[type=submit]', f), async () => {
          const out = $('#dOut'); out.innerHTML = '';
          try {
            const bad = $$('[required]', f).find(el => el.type !== 'file' && !el.value.trim());
            if (bad) { bad.focus(); throw new Error('Lengkapi kolom yang bertanda *.'); }
            const d = formData(f);
            d.id_jadwal = j.id_jadwal;
            d.files = {};
            for (const el of $$('input[type=file]', f)) if (el.files[0]) d.files[el.name] = await fileToPayload(el.files[0]);
            const r = await api('daftar', d);
            store.set('sipaling_lookup', JSON.stringify({ no_reg: r.no_reg, email: d.email.toLowerCase() }));
            PD = null;
            view.innerHTML = `<div class="card"><div class="ticket"><div class="muted">Permohonan diterima. Nomor Registrasi Anda:</div>
              <div class="no mono">${esc(r.no_reg)}</div><button class="btn sm ghost" id="cp">Salin nomor</button></div>
              <div class="notice ok" style="margin-top:16px">Simpan nomor ini. Gunakan bersama email Anda untuk memantau verifikasi, jadwal, hasil, dan sertifikat.
              Berkas Anda akan diverifikasi oleh Bagian Sertifikasi (Langkah 3 SOP).</div>
              <a class="btn" href="#/status">${icon('search')} Pantau status pendaftaran</a></div>`;
            $('#cp').onclick = () => copy(r.no_reg);
          } catch (err) { out.innerHTML = `<div class="notice bad">${esc(err.message)}</div>`; }
        });
      });
    },

    status() {
      view.innerHTML = lookupForm('lkS', 'Cek status pendaftaran', 'Cek status');
      bindLookup('lkS', r => `
        <div class="grid g2">
          <div class="card"><h3>Data permohonan</h3>${identitas(r)}
            ${r.status_verifikasi === 'Perlu Perbaikan' ? `<div class="notice" style="margin-top:14px"><b>Perlu perbaikan:</b> ${esc(r.catatan_verifikasi || 'Hubungi Sekretariat LSP.')}<br><small>Kirim dokumen perbaikan ke email LSP dengan menyebutkan No. Registrasi.</small></div>` : ''}
            ${r.status_verifikasi === 'Tidak Memenuhi Syarat' ? `<div class="notice bad" style="margin-top:14px"><b>Tidak memenuhi syarat.</b> ${esc(r.catatan_verifikasi || '')}</div>` : ''}
            ${r.status_jadwal === 'Terjadwal' ? `<div class="notice info" style="margin-top:14px"><b>Jadwal asesmen:</b> ${tgl(r.tanggal_asesmen, true)} ${esc(r.waktu_asesmen || '')}<br>TUK: ${esc(r.tuk)}${r.tuk_alamat ? ' — ' + esc(r.tuk_alamat) : ''}<br>Asesor: ${esc(r.asesor)}</div>` : ''}
          </div>
          <div class="card"><h3>Tahapan layanan (SOP)</h3>${timeline(r)}</div>
        </div>
        ${r.riwayat && r.riwayat.length ? `<div class="card"><h3>Rekaman pelayanan</h3><div class="table-wrap"><table><thead><tr><th>Waktu</th><th>Langkah</th><th>Aktivitas</th></tr></thead><tbody>
          ${r.riwayat.map(l => `<tr><td>${tgl(l.waktu)}</td><td>${esc(l.langkah_sop)}</td><td>${esc(l.aksi)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}`);
    },

    plotting: async () => {
      const list = await api('plotting');
      const groups = {};
      list.forEach(r => (groups[r.id_jadwal] = groups[r.id_jadwal] || { label: r.jadwal_label, rows: [] }).rows.push(r));
      const keys = Object.keys(groups);
      view.innerHTML = `<div class="notice info">Daftar peserta yang telah ditetapkan asesor, TUK, dan waktu asesmen (Langkah 4 SOP). Nama ditampilkan sebagian untuk menjaga kerahasiaan data peserta.</div>
        <div class="toolbar"><select id="plJ"><option value="">Semua jadwal</option>${keys.map(k => `<option value="${esc(k)}">${esc(groups[k].label)}</option>`).join('')}</select>
        <input id="plQ" placeholder="Cari No. Registrasi…"></div>
        <div class="table-wrap"><table><thead><tr><th>No. Registrasi</th><th>Nama</th><th>Skema</th><th>Tanggal &amp; waktu</th><th>TUK</th><th>Asesor</th></tr></thead><tbody id="plB"></tbody></table></div>`;
      const draw = () => {
        const j = $('#plJ').value, q = $('#plQ').value.trim().toUpperCase();
        const rows = list.filter(r => (!j || r.id_jadwal === j) && (!q || r.no_reg.toUpperCase().indexOf(q) >= 0));
        $('#plB').innerHTML = rows.length ? rows.map(r => `<tr><td class="mono">${esc(r.no_reg)}</td><td>${esc(r.nama)}</td><td>${esc(r.skema)}</td><td>${tgl(r.tanggal, true)}<br><small class="muted">${esc(r.waktu || '')}</small></td><td>${esc(r.tuk)}</td><td>${esc(r.asesor)}</td></tr>`).join('')
          : '<tr><td colspan="6" class="empty">Belum ada plotting jadwal.</td></tr>';
      };
      $('#plJ').onchange = draw; $('#plQ').oninput = draw; draw();
    },

    hasil() {
      view.innerHTML = lookupForm('lkH', 'Hasil uji kompetensi', 'Lihat hasil');
      bindLookup('lkH', r => {
        let box;
        if (r.rekomendasi === 'Kompeten') box = `<div class="result-big ok">${icon('award')}<div><div class="big">KOMPETEN</div>Diputuskan ${tgl(r.tgl_hasil)}. Sertifikat diproses ke BNSP — pantau di <a href="#/sertifikat">Tracer Sertifikat</a>.</div></div>`;
        else if (r.rekomendasi === 'Belum Kompeten') box = `<div class="result-big bad">${icon('scale')}<div><div class="big">BELUM KOMPETEN</div>Diputuskan ${tgl(r.tgl_hasil)}.</div></div>`;
        else box = `<div class="result-big wait">${icon('cal')}<div><div class="big">Belum ada hasil</div>Hasil disampaikan setelah asesmen dan rapat keputusan sertifikasi.</div></div>`;
        return `<div class="card"><h3>${esc(r.nama)} · <span class="mono">${esc(r.no_reg)}</span></h3><p class="muted">${esc(r.skema)}</p>${box}
          ${r.catatan_hasil ? `<p style="margin-top:12px"><b>Catatan:</b> ${esc(r.catatan_hasil)}</p>` : ''}
          ${r.link_surat_hasil ? `<p style="margin-top:12px"><a class="btn" target="_blank" rel="noopener" href="${esc(r.link_surat_hasil)}">${icon('download')} Unduh surat pemberitahuan hasil</a></p>` : ''}
          ${r.rekomendasi ? `<div class="notice info" style="margin-top:16px"><b>Hak banding &amp; keluhan.</b> Jika Anda tidak sepakat dengan keputusan asesmen, Anda berhak mengajukan <a href="#/banding">banding asesmen</a>. Keluhan atas pelayanan dapat disampaikan melalui <a href="#/keluhan">formulir keluhan</a>.</div>
          <a class="btn gold" href="#/survei">${icon('star')} Isi survei kepuasan</a>` : ''}</div>`;
      });
    },

    sertifikat(D) {
      view.innerHTML = lookupForm('lkC', 'Tracer & pengambilan sertifikat fisik', 'Lacak sertifikat');
      const tahap = ['Diajukan ke BNSP', 'Siap Diambil', 'Sudah Diserahkan'];
      bindLookup('lkC', r => {
        if (r.rekomendasi !== 'Kompeten') return `<div class="card"><div class="result-big wait"><div><div class="big">Belum ada sertifikat</div>Sertifikat hanya diterbitkan untuk peserta yang dinyatakan KOMPETEN. Status hasil Anda: ${badge(r.rekomendasi || 'Belum ada hasil')}</div></div></div>`;
        const pos = tahap.indexOf(r.status_sertifikat);
        return `<div class="card"><h3>${esc(r.nama)} · <span class="mono">${esc(r.no_reg)}</span></h3><p class="muted">${esc(r.skema)}</p>
          <ul class="timeline">${tahap.map((t, i) => `<li class="${i < pos || r.status_sertifikat === 'Sudah Diserahkan' ? 'done' : i === pos ? 'now' : ''}"><span class="dot">${i < pos || (i === pos && i === 2) ? '✓' : i + 1}</span><b>${esc(t)}</b>
            <small>${i === 0 ? 'Pengajuan blanko/penerbitan sertifikat ke BNSP' : i === 1 ? 'Sertifikat tersedia di Sekretariat LSP' + (r.no_sertifikat ? ' · No. ' + esc(r.no_sertifikat) : '') : r.tgl_serah ? 'Diserahkan ' + tgl(r.tgl_serah) : 'Tanda terima didokumentasikan'}</small></li>`).join('')}</ul>
          ${r.status_sertifikat === 'Siap Diambil' ? `<div class="notice ok"><b>Sertifikat siap diambil.</b> ${esc(D.pengaturan.info_pengambilan_sertifikat || '')}${D.pengaturan.jam_layanan ? '<br>Jam layanan: ' + esc(D.pengaturan.jam_layanan) : ''}</div>` : ''}</div>`;
      });
    },

    banding(D) { layananPage(D, 'banding'); },
    surveilans(D) { layananPage(D, 'surveilans'); },
    legalisir(D) { layananPage(D, 'legalisir'); },
    rcc(D) { layananPage(D, 'rcc'); },

    keluhan() {
      const last = JSON.parse(store.get('sipaling_lookup') || '{}');
      view.innerHTML = `<div class="notice info">Keluhan dicatat, diberi nomor tiket, dan ditindaklanjuti oleh Bagian Manajemen Mutu sesuai prosedur penanganan keluhan (Langkah 9 SOP). Identitas pelapor dijaga kerahasiaannya.</div>
      <form class="card form" id="fK">
        <h2>Formulir keluhan pelayanan</h2>
        <div class="row"><label class="f">Nama <span class="req">*</span><input name="nama" required></label><label class="f">Email <span class="req">*</span><input type="email" name="email" required value="${esc(last.email || '')}"></label></div>
        <div class="row"><label class="f">No. HP<input name="hp"></label><label class="f">No. Registrasi (jika ada)<input name="no_reg" value="${esc(last.no_reg || '')}"></label></div>
        <label class="f">Kategori <span class="req">*</span><select name="kategori" required><option value="">Pilih…</option><option>Informasi & pendaftaran</option><option>Administrasi & verifikasi</option><option>Jadwal & TUK</option><option>Pelaksanaan asesmen / asesor</option><option>Hasil & sertifikat</option><option>Sikap petugas</option><option>Lainnya</option></select></label>
        <label class="f">Uraian keluhan <span class="req">*</span><textarea name="isi" required placeholder="Ceritakan kejadian, waktu, dan harapan penyelesaian"></textarea></label>
        <div><button class="btn" type="submit">${icon('send')} Kirim keluhan</button></div><div id="kOut"></div>
      </form>`;
      const f = $('#fK');
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        busy($('button[type=submit]', f), async () => {
          try {
            const d = formData(f);
            const r = await api('keluhan', d);
            tiketSukses(r.no_tiket, d.email, 'Keluhan Anda telah diterima dan dicatat.');
          } catch (err) { $('#kOut').innerHTML = `<div class="notice bad">${esc(err.message)}</div>`; }
        });
      });
    },

    tiket(D, args) {
      view.innerHTML = `<form class="card form" id="fT"><h2>Lacak tiket keluhan / layanan</h2>
        <div class="row"><label class="f">Nomor tiket<input name="no" required placeholder="KLH-2610-001 / LGL-… / RCC-…" value="${esc(args[0] || '')}"></label><label class="f">Email<input type="email" name="email" required value="${esc(args[1] ? decodeURIComponent(args[1]) : '')}"></label></div>
        <div><button class="btn" type="submit">${icon('search')} Lacak</button></div></form><div id="tOut"></div>`;
      const f = $('#fT');
      const go = async () => {
        try {
          const r = await api('cekTiket', formData(f));
          $('#tOut').innerHTML = `<div class="card"><div class="card-head"><h3 class="mono">${esc(r.no)}</h3>${badge(r.status)}</div>
            <dl class="kv"><dt>Jenis</dt><dd>${esc(r.jenis)}</dd><dt>Diajukan</dt><dd>${tgl(r.waktu)}</dd><dt>Uraian</dt><dd style="font-weight:500;white-space:pre-line">${esc(r.isi)}</dd>
            <dt>Tanggapan petugas</dt><dd style="white-space:pre-line">${esc(r.tanggapan || 'Belum ada tanggapan.')}</dd>${r.selesai ? `<dt>Selesai</dt><dd>${tgl(r.selesai)}</dd>` : ''}</dl></div>`;
        } catch (err) { $('#tOut').innerHTML = `<div class="notice bad">${esc(err.message)}</div>`; }
      };
      f.addEventListener('submit', (e) => { e.preventDefault(); busy($('button[type=submit]', f), go); });
      if (args[0] && args[1]) go();
    },

    survei() {
      const last = JSON.parse(store.get('sipaling_lookup') || '{}');
      const q = [['skor_informasi', 'Kejelasan informasi skema, biaya, dan jadwal'], ['skor_administrasi', 'Kemudahan pendaftaran & administrasi'], ['skor_asesmen', 'Pelaksanaan asesmen (adil, objektif, tepat waktu)'], ['skor_petugas', 'Sikap dan responsivitas petugas'], ['skor_keseluruhan', 'Kepuasan keseluruhan']];
      view.innerHTML = `<form class="card form" id="fS"><h2>Survei kepuasan pemohon sertifikasi</h2>
        <p class="muted">Skala 1 (sangat tidak puas) – 5 (sangat puas). Hasil survei digunakan untuk perbaikan mutu layanan.</p>
        ${q.map(x => `<div><div style="font-weight:700;margin-bottom:6px">${esc(x[1])}</div><div class="rating">${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="${x[0]}" value="${n}"><span>${n}</span></label>`).join('')}</div></div>`).join('')}
        <label class="f">No. Registrasi (opsional)<input name="no_reg" value="${esc(last.no_reg || '')}"></label>
        <label class="f">Saran perbaikan<textarea name="saran"></textarea></label>
        <div><button class="btn" type="submit">${icon('send')} Kirim survei</button></div><div id="sOut"></div></form>`;
      const f = $('#fS');
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        busy($('button[type=submit]', f), async () => {
          try { await api('survei', formData(f)); view.innerHTML = `<div class="card"><div class="result-big ok">${icon('star')}<div><div class="big">Terima kasih!</div>Penilaian Anda membantu kami meningkatkan mutu layanan sertifikasi.</div></div></div>`; }
          catch (err) { $('#sOut').innerHTML = `<div class="notice bad">${esc(err.message)}</div>`; }
        });
      });
    }
  };

  /* ---------------- Layanan pasca-uji ---------------- */
  const LAYANAN = {
    banding: {
      jenis: 'Banding Asesmen', intro: 'Banding diajukan oleh peserta yang tidak sepakat dengan keputusan asesmen. Banding diperiksa oleh tim yang tidak terlibat dalam asesmen yang dibanding, dan keputusannya disampaikan secara tertulis.',
      extra: [], noReg: true, ket: 'Alasan banding', ketReq: true, file: 'Bukti pendukung (opsional)'
    },
    surveilans: {
      jenis: 'Surveilans', intro: 'Surveilans dilakukan untuk memastikan pemegang sertifikat tetap memelihara kompetensinya selama masa berlaku sertifikat.',
      extra: [['pekerjaan_saat_ini', 'Pekerjaan / jabatan saat ini', 'text'], ['instansi_saat_ini', 'Instansi / tempat kerja', 'text'], ['relevan', 'Apakah pekerjaan saat ini sesuai dengan skema sertifikat?', 'select:Ya, sesuai|Sebagian|Tidak sesuai']],
      noSert: true, ket: 'Uraian kegiatan yang memelihara kompetensi', file: 'Bukti kegiatan / portofolio (opsional)'
    },
    legalisir: {
      jenis: 'Legalisir Sertifikat', intro: 'Pengajuan legalisir fotokopi/salinan sertifikat kompetensi yang diterbitkan melalui LSP ini.',
      extra: [['jumlah_lembar', 'Jumlah lembar', 'number'], ['keperluan', 'Keperluan legalisir', 'text']],
      noSert: true, ket: 'Catatan tambahan', file: 'Scan sertifikat (wajib)', fileReq: true
    },
    rcc: {
      jenis: 'Perpanjangan Sertifikat (RCC)', intro: 'Recertification (RCC) untuk memperpanjang sertifikat kompetensi yang akan atau telah habis masa berlakunya, melalui pembuktian kompetensi terkini.',
      extra: [['masa_berlaku', 'Masa berlaku sertifikat lama berakhir', 'date'], ['pekerjaan_saat_ini', 'Pekerjaan / jabatan saat ini', 'text']],
      noSert: true, ket: 'Ringkasan bukti kompetensi terkini', file: 'Sertifikat lama + portofolio (satu PDF)', fileReq: true
    }
  };

  function layananPage(D, key) {
    const L = LAYANAN[key];
    const last = JSON.parse(store.get('sipaling_lookup') || '{}');
    const field = (x) => {
      const [name, label, type] = x;
      if (type.indexOf('select:') === 0) return `<label class="f">${esc(label)}<select name="x_${name}"><option value="">Pilih…</option>${type.slice(7).split('|').map(o => `<option>${esc(o)}</option>`).join('')}</select></label>`;
      return `<label class="f">${esc(label)}<input type="${type}" name="x_${name}"></label>`;
    };
    view.innerHTML = `<div class="notice info">${esc(L.intro)}</div>
      <form class="card form" id="fL"><h2>Formulir ${esc(L.jenis)}</h2>
        <div class="row"><label class="f">Nama lengkap <span class="req">*</span><input name="nama" required></label><label class="f">Email <span class="req">*</span><input type="email" name="email" required value="${esc(last.email || '')}"></label></div>
        <div class="row"><label class="f">No. HP / WhatsApp <span class="req">*</span><input name="hp" required></label>
          ${L.noReg ? `<label class="f">No. Registrasi uji <span class="req">*</span><input name="no_reg" required value="${esc(last.no_reg || '')}"></label>` : `<label class="f">No. sertifikat <span class="req">*</span><input name="no_sertifikat" required></label>`}</div>
        <label class="f">Skema sertifikasi<select name="skema"><option value="">Pilih…</option>${D.skema.map(s => `<option>${esc(s.nama_skema)}</option>`).join('')}</select></label>
        ${L.extra.length ? `<div class="row">${L.extra.map(field).join('')}</div>` : ''}
        <label class="f">${esc(L.ket)} ${L.ketReq ? '<span class="req">*</span>' : ''}<textarea name="keterangan" ${L.ketReq ? 'required' : ''}></textarea></label>
        <label class="f">${esc(L.file)}<input type="file" name="file" accept=".pdf,.jpg,.jpeg,.png"><small class="muted">PDF/JPG/PNG, maks. ${CFG.MAX_FILE_MB || 2} MB</small></label>
        <div><button class="btn" type="submit">${icon('send')} Ajukan</button></div><div id="lOut"></div>
      </form>`;
    const f = $('#fL');
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      busy($('button[type=submit]', f), async () => {
        try {
          const raw = formData(f);
          const d = { jenis: L.jenis };
          const extra = [];
          Object.keys(raw).forEach(k => {
            if (k.indexOf('x_') === 0) { if (raw[k]) extra.push(L.extra.find(x => 'x_' + x[0] === k)[1] + ': ' + raw[k]); }
            else d[k] = raw[k];
          });
          if (L.ketReq && !d.keterangan) throw new Error(L.ket + ' wajib diisi.');
          d.keterangan = extra.concat(d.keterangan ? [d.keterangan] : []).join('\n');
          const fl = $('input[type=file]', f).files[0];
          if (L.fileReq && !fl) throw new Error(L.file.replace(' (wajib)', '') + ' wajib diunggah.');
          d.file = await fileToPayload(fl);
          const r = await api('layanan', d);
          tiketSukses(r.no_layanan, d.email, 'Permohonan ' + L.jenis + ' telah diterima.');
        } catch (err) { $('#lOut').innerHTML = `<div class="notice bad">${esc(err.message)}</div>`; }
      });
    });
  }

  function tiketSukses(no, email, msg) {
    view.innerHTML = `<div class="card"><div class="ticket"><div class="muted">${esc(msg)} Nomor tiket Anda:</div><div class="no mono">${esc(no)}</div><button class="btn sm ghost" id="cp">Salin nomor</button></div>
      <p style="margin-top:16px">Pantau tanggapan petugas melalui menu Lacak Tiket menggunakan nomor tiket dan email Anda.</p>
      <a class="btn" href="#/tiket/${encodeURIComponent(no)}/${encodeURIComponent(email)}">${icon('ticket')} Lacak tiket</a></div>`;
    $('#cp').onclick = () => copy(no);
  }

  /* ---------------- Mulai ---------------- */
  $('#menuBtn').innerHTML = icon('menu');
  $('#menuBtn').onclick = () => document.body.classList.toggle('nav-open');
  $('#scrim').onclick = () => document.body.classList.remove('nav-open');
  if (CFG.LOGO_URL) { $('#logo').src = CFG.LOGO_URL; }
  $('#brandSub').textContent = CFG.NAMA_LSP || 'LSP UNIMED';
  if (DEMO) { $('#demoFlag').hidden = false; $('#demoFlag').title = 'API_URL di config.js belum diisi — data contoh, tidak tersimpan ke server.'; }
  window.addEventListener('hashchange', router);
  router();
})();
