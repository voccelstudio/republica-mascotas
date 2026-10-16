const App = {
  currentView: 'dashboard',
  currentPatientId: null,
  editingPatientId: null,
  _currentClientKey: null,
  _searchDebounceTimers: {},
  _saving: false,

  async init() {
    const settings = await DB.getClinicSettings();
    if (settings.clinicName) {
      document.getElementById('sidebar-clinic-name').textContent = settings.clinicName;
      const mobName = document.getElementById('mobile-sidebar-clinic-name');
      if (mobName) mobName.textContent = settings.clinicName;
    }
    if (settings.clinicLogo) {
      const sidebarLogo = document.getElementById('sidebar-logo-img');
      if (sidebarLogo) sidebarLogo.src = settings.clinicLogo;
      const mobLogo = document.getElementById('mobile-sidebar-logo-img');
      if (mobLogo) mobLogo.src = settings.clinicLogo;
    }
    this.applyTheme(settings.themePrimary, settings.themeSecondary, settings.themeDarkMode);
    this.loadSpeciesFilter();
    this.loadServiceTypes();
    this.navigate('dashboard');
    this.checkBackupReminder();
    document.getElementById('global-search').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.searchPatients(e.target.value);
    });
  },

  // ===== NAVIGATION =====
  navigate(view) {
    this.currentView = view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    const target = document.getElementById('view-' + view);
    if (target) target.classList.add('active');
    const link = document.querySelector(`.sidebar-link[data-view="${view}"]`);
    if (link) link.classList.add('active');

    switch (view) {
      case 'dashboard': this.loadDashboard(); break;
      case 'agenda': this.loadAgenda(); break;
      case 'patients': this.loadPatients(); break;
      case 'clients': this.loadClients(); break;
      case 'services': this.loadServices(); break;
      case 'procedures': this.loadProcedures(); break;
      case 'inventory': this.loadInventory(); break;
      case 'settings': this.loadSettingsForm(); break;
    }
  },

  toggleMobileSidebar() {
    const sidebar = document.getElementById('mobile-sidebar');
    const overlay = document.getElementById('mobile-sidebar-overlay');
    const isOpen = !sidebar.classList.contains('-translate-x-full');
    if (isOpen) {
      sidebar.classList.add('-translate-x-full');
      overlay.classList.add('hidden');
    } else {
      sidebar.classList.remove('-translate-x-full');
      overlay.classList.remove('hidden');
    }
  },

  // ── Helpers ──
  patientFullName(p) {
    return p ? (p.lastName ? `${p.name} ${p.lastName}` : p.name) : '—';
  },
  _safeImgSrc(src) {
    if (!src) return '';
    if (src.startsWith('data:image/')) return src;
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('assets/')) return src;
    return '';
  },

  async _withGuard(fn) {
    if (this._saving) return;
    this._saving = true;
    try { await fn(); } finally { this._saving = false; }
  },

  _showLoading(containerId) {
    const el = document.getElementById(containerId);
    if (el && !el.querySelector('.loading-spinner')) {
      el.innerHTML = `<div class="loading-spinner flex items-center justify-center py-12"><span class="material-symbols-outlined animate-spin text-3xl text-outline">sync</span></div>`;
    }
  },

  // ===== DASHBOARD =====
  async loadDashboard() {
    const stats = await DB.getDashboardStats();
    document.getElementById('stat-patients').textContent = stats.totalPatients;
    document.getElementById('stat-month-services').textContent = stats.monthServices;
    const settings = await DB.getClinicSettings();
    document.getElementById('dashboard-greeting').textContent = `Panel General — ¡Hola! Bienvenido a ${settings.clinicName || 'República Mascota'}`;
    document.getElementById('dashboard-subtitle').textContent = `${getTodayDisplay()} — ${stats.totalPatients} pacientes registrados.`;
    document.getElementById('top-date').textContent = getTodayDisplay();

    if (settings.clinicName) {
      document.getElementById('sidebar-clinic-name').textContent = settings.clinicName;
      const mobName = document.getElementById('mobile-sidebar-clinic-name');
      if (mobName) mobName.textContent = settings.clinicName;
    }
    if (settings.clinicLogo) {
      const sidebarLogo = document.getElementById('sidebar-logo-img');
      if (sidebarLogo) sidebarLogo.src = settings.clinicLogo;
      const mobLogo = document.getElementById('mobile-sidebar-logo-img');
      if (mobLogo) mobLogo.src = settings.clinicLogo;
    }

    await this.renderDashboardServices();
    await this.renderDashboardAgenda();
    await this.renderSpeciesChart();
    await this.renderDashboardVaccineReminders();
    await this.renderDashboardProcedureReminders();
    this._initComparisonSelectors();
  },

  async renderDashboardServices() {
    const services = await DB.getRecentServices(5);
    const container = document.getElementById('dashboard-services-table');
    if (services.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="icon material-symbols-outlined">medical_services</div><p>No hay servicios registrados aún</p></div>`;
      return;
    }
    let html = `<table class="data-table"><thead><tr><th>Paciente</th><th>Servicio</th><th>Fecha</th><th>Profesional</th></tr></thead><tbody>`;
    for (const s of services) {
      const patient = s.patientId ? await DB.getPatient(s.patientId) : null;
      html += `<tr>
        <td class="font-medium">${escapeHtml(this.patientFullName(patient))}</td>
        <td>${escapeHtml(s.serviceType)}</td>
        <td class="text-on-surface-variant">${formatDateShort(s.date)}</td>
        <td>${escapeHtml(s.performedBy || '—')}</td>
      </tr>`;
    }
    html += `</tbody></table>`;
    container.innerHTML = html;
  },

  async renderDashboardAgenda() {
    const today = getToday();
    const appointments = await DB.getAppointmentsByDate(today);
    const container = document.getElementById('dashboard-agenda');
    const statusLabels = { pending: 'Pendiente', confirmed: 'Confirmado', completed: 'Atendido', cancelled: 'Cancelado' };
    if (appointments.length === 0) {
      container.innerHTML = `<div class="empty-state !p-4"><div class="icon material-symbols-outlined">event</div><p class="text-sm">Sin turnos para hoy</p>
        <button class="btn-primary text-sm py-1.5 mt-2" onclick="App.openAppointmentForm()">Programar turno</button>
      </div>`;
      return;
    }
    const sorted = appointments.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    let html = `<div class="space-y-2">`;
    for (const a of sorted) {
      const patient = await DB.getPatient(a.patientId);
      const sl = statusLabels[a.status] || 'Pendiente';
      html += `<div class="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-container-low transition-colors border-l-4 ${a.status === 'cancelled' ? 'border-outline-variant opacity-60' : 'border-primary'}">
        <div class="text-center min-w-[50px]"><p class="font-bold text-sm">${a.time || '--:--'}</p></div>
        <div class="flex-1"><p class="font-bold text-sm">${escapeHtml(this.patientFullName(patient))}</p>
          <p class="text-xs text-on-surface-variant">${escapeHtml(a.type || 'Cita')} · ${sl}</p>
        </div>
        ${(patient && a.status !== 'completed' && a.status !== 'cancelled') ? `
          <button class="p-1.5 hover:bg-surface-container rounded-lg flex items-center justify-center" style="color: ${App._getProximityColor(a.date)};" onclick="App.sendWhatsAppReminder('appointment', '${a.id}')" title="Enviar recordatorio de WhatsApp">
            <span class="material-symbols-outlined text-lg">chat</span>
          </button>
        ` : ''}
      </div>`;
    }
    html += `</div>`;
    container.innerHTML = html;
  },

  async renderSpeciesChart() {
    const patients = await DB.getAllPatients();
    const container = document.getElementById('species-chart');
    if (patients.length === 0) {
      container.innerHTML = `<div class="empty-state !p-4"><div class="icon material-symbols-outlined">pets</div><p class="text-sm">Sin datos</p></div>`;
      return;
    }
    const counts = {};
    const colors = ['#00366b', '#006a63', '#293939', '#a7c8ff', '#8bf1e6', '#d4e6e5', '#1b4d89', '#737781'];
    patients.forEach(p => { counts[p.species] = (counts[p.species] || 0) + 1; });
    const total = patients.length;
    let html = '';
    let i = 0;
    for (const [species, count] of Object.entries(counts)) {
      const pct = Math.round((count / total) * 100);
      html += `<div>
        <div class="flex justify-between text-sm mb-1"><span>${escapeHtml(species)}</span><span class="font-bold">${count}</span></div>
        <div class="h-2 w-full bg-surface-variant rounded-full overflow-hidden">
          <div class="h-full rounded-full" style="width:${pct}%;background:${colors[i % colors.length]};"></div>
        </div>
      </div>`;
      i++;
    }
    container.innerHTML = html;
  },

  async renderDashboardVaccineReminders() {
    const container = document.getElementById('dashboard-vaccine-reminders');
    try {
      const due = await DB.getVaccinationsDueSoon(30);
      const overdue = await DB.getVaccinationsOverdue();
      const all = [...overdue, ...due];
      if (all.length === 0) {
        container.innerHTML = `<div class="empty-state !p-4"><div class="icon material-symbols-outlined">vaccines</div><p class="text-sm">Sin vacunas próximas</p></div>`;
        return;
      }
      let html = `<div class="space-y-2">`;
      for (const v of all) {
        const patient = await DB.getPatient(v.patientId);
        const isOverdue = overdue.includes(v);
        html += `<div class="flex items-center gap-3 p-3 rounded-lg ${isOverdue ? 'bg-error-container border-l-4' : 'bg-surface-container-low border-l-4'} ${isOverdue ? '' : 'border-l-secondary'} transition-colors">
          <div class="flex-1">
            <p class="font-bold text-sm">${escapeHtml(this.patientFullName(patient))}</p>
            <p class="text-xs text-on-surface-variant">${escapeHtml(v.vaccineName)}</p>
            <p class="text-xs ${isOverdue ? 'text-on-error-container font-bold' : 'text-on-surface-variant'}">${isOverdue ? 'VENCIDA: ' : 'Próxima: '}${formatDateShort(v.nextDoseDate)}</p>
          </div>
          ${patient ? `
            <button class="p-1.5 hover:bg-surface-container rounded-lg flex items-center justify-center" style="color: ${App._getProximityColor(v.nextDoseDate)};" onclick="App.sendWhatsAppReminder('vaccine', '${v.id}')" title="Enviar recordatorio de vacuna">
              <span class="material-symbols-outlined text-lg">chat</span>
            </button>
          ` : ''}
        </div>`;
      }
      html += `</div>`;
      container.innerHTML = html;
    } catch (e) {
      container.innerHTML = `<div class="empty-state !p-4"><p class="text-sm">Sin datos</p></div>`;
    }
  },

  async renderDashboardProcedureReminders() {
    const container = document.getElementById('dashboard-procedure-reminders');
    try {
      const due = await DB.getPatientProceduresDueSoon(30);
      const overdue = await DB.getPatientProceduresOverdue();
      const all = [...overdue, ...due];
      if (all.length === 0) {
        container.innerHTML = `<div class="empty-state !p-4"><div class="icon material-symbols-outlined">stethoscope</div><p class="text-sm">Sin procedimientos próximos</p></div>`;
        return;
      }
      let html = `<div class="space-y-2">`;
      for (const p of all) {
        const patient = await DB.getPatient(p.patientId);
        const isOverdue = overdue.includes(p);
        html += `<div class="flex items-center gap-3 p-3 rounded-lg ${isOverdue ? 'bg-error-container border-l-4' : 'bg-surface-container-low border-l-4'} ${isOverdue ? '' : 'border-l-secondary'} transition-colors">
          <div class="flex-1">
            <p class="font-bold text-sm">${escapeHtml(this.patientFullName(patient))}</p>
            <p class="text-xs text-on-surface-variant">${escapeHtml(p.category)}: ${escapeHtml(p.procedureName)}</p>
            <p class="text-xs ${isOverdue ? 'text-on-error-container font-bold' : 'text-on-surface-variant'}">${isOverdue ? 'VENCIDA: ' : 'Próxima: '}${formatDateShort(p.nextDate)}</p>
          </div>
        </div>`;
      }
      html += `</div>`;
      container.innerHTML = html;
    } catch (e) {
      container.innerHTML = `<div class="empty-state !p-4"><p class="text-sm">Sin datos</p></div>`;
    }
  },

  _initComparisonSelectors() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];
    const selectors = [
      { monthId: 'cmp-month-a', yearId: 'cmp-year-a' },
      { monthId: 'cmp-month-b', yearId: 'cmp-year-b' }
    ];
    selectors.forEach((sel, idx) => {
      const monthEl = document.getElementById(sel.monthId);
      const yearEl = document.getElementById(sel.yearId);
      if (!monthEl || !yearEl) return;
      monthEl.innerHTML = MONTH_NAMES.map((name, i) =>
        `<option value="${i}" ${i === now.getMonth() - idx ? 'selected' : ''}>${name}</option>`
      ).join('');
      yearEl.innerHTML = years.map(y =>
        `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`
      ).join('');
    });
  },

  async renderMonthComparison() {
    const container = document.getElementById('comparison-results');
    const mA = parseInt(document.getElementById('cmp-month-a').value);
    const yA = parseInt(document.getElementById('cmp-year-a').value);
    const mB = parseInt(document.getElementById('cmp-month-b').value);
    const yB = parseInt(document.getElementById('cmp-year-b').value);

    if (yA === yB && mA === mB) {
      container.innerHTML = `<div class="empty-state !p-6"><div class="icon material-symbols-outlined">info</div><p class="text-sm text-on-surface-variant">Elegí dos meses diferentes para comparar.</p></div>`;
      return;
    }

    container.innerHTML = `<div class="flex items-center justify-center py-8"><span class="material-symbols-outlined animate-spin text-2xl text-primary">sync</span></div>`;

    try {
      const data = await DB.getComparisonData(yA, mA, yB, mB);
      const labelA = `${MONTH_NAMES[mA]} ${yA}`;
      const labelB = `${MONTH_NAMES[mB]} ${yB}`;

      this._lastComparison = { labelA, labelB, data };

      function trend(valA, valB) {
        if (valB === 0 && valA === 0) return { icon: 'remove', color: 'text-on-surface-variant', text: '—' };
        if (valB === 0) return { icon: 'trending_up', color: 'text-tertiary', text: `+${valA}` };
        const diff = valA - valB;
        const pct = Math.round((diff / valB) * 100);
        if (diff > 0) return { icon: 'trending_up', color: 'text-tertiary', text: `+${pct}%` };
        if (diff < 0) return { icon: 'trending_down', color: 'text-error', text: `${pct}%` };
        return { icon: 'remove', color: 'text-on-surface-variant', text: '=' };
      }

      function renderMetric(label, valA, valB, icon) {
        const t = trend(valA, valB);
        return `<div class="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low">
          <div class="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container shrink-0">
            <span class="material-symbols-outlined text-lg">${icon}</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs text-on-surface-variant uppercase tracking-wider">${label}</p>
            <div class="flex items-center gap-2 mt-0.5">
              <span class="font-bold text-on-surface">${valA}</span>
              <span class="text-xs text-on-surface-variant">vs</span>
              <span class="font-bold text-on-surface">${valB}</span>
              <span class="material-symbols-outlined text-sm ${t.color}">${t.icon}</span>
              <span class="text-xs font-semibold ${t.color}">${t.text}</span>
            </div>
          </div>
        </div>`;
      }

      let html = `<div class="mb-3 flex items-center gap-2 flex-wrap">
        <span class="badge badge-primary text-xs font-bold">${escapeHtml(labelA)}</span>
        <span class="text-on-surface-variant text-xs">vs</span>
        <span class="badge badge-secondary text-xs font-bold">${escapeHtml(labelB)}</span>
        <span class="flex-1"></span>
        <button class="btn-outline text-xs py-1.5 px-3" onclick="App.downloadComparisonPDF()">
          <span class="material-symbols-outlined text-sm">picture_as_pdf</span> Descargar PDF
        </button>
      </div>`;
      html += `<div class="space-y-2">`;
      html += renderMetric('Servicios', data.a.services, data.b.services, 'medical_services');
      html += renderMetric('Turnos', data.a.appointments, data.b.appointments, 'calendar_month');
      html += renderMetric('Pacientes Atendidos', data.a.uniquePatients, data.b.uniquePatients, 'pets');
      html += renderMetric('Vacunaciones', data.a.vaccinations, data.b.vaccinations, 'vaccines');
      html += `</div>`;

      html += `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">`;
      html += `<div class="p-3 rounded-lg bg-surface-container-low">
        <p class="text-xs text-on-surface-variant uppercase tracking-wider mb-1">Top Servicio (${escapeHtml(labelA)})</p>
        <p class="font-bold text-sm">${escapeHtml(data.a.topServiceType)}</p>
      </div>`;
      html += `<div class="p-3 rounded-lg bg-surface-container-low">
        <p class="text-xs text-on-surface-variant uppercase tracking-wider mb-1">Top Servicio (${escapeHtml(labelB)})</p>
        <p class="font-bold text-sm">${escapeHtml(data.b.topServiceType)}</p>
      </div>`;
      html += `<div class="p-3 rounded-lg bg-surface-container-low">
        <p class="text-xs text-on-surface-variant uppercase tracking-wider mb-1">Top Profesional (${escapeHtml(labelA)})</p>
        <p class="font-bold text-sm">${escapeHtml(data.a.topProfessional)}</p>
      </div>`;
      html += `<div class="p-3 rounded-lg bg-surface-container-low">
        <p class="text-xs text-on-surface-variant uppercase tracking-wider mb-1">Top Profesional (${escapeHtml(labelB)})</p>
        <p class="font-bold text-sm">${escapeHtml(data.b.topProfessional)}</p>
      </div>`;
      html += `</div>`;

      container.innerHTML = html;
    } catch (e) {
      container.innerHTML = `<div class="empty-state !p-6"><div class="icon material-symbols-outlined">error</div><p class="text-sm">Error al cargar la comparativa.</p></div>`;
    }
  },

  async downloadComparisonPDF() {
    if (!this._lastComparison) {
      alert('Primero hacé una comparación antes de descargar el PDF.');
      return;
    }
    const { labelA, labelB, data } = this._lastComparison;
    await generateComparisonPDF(labelA, labelB, data);
  },

  // ===== AGENDA =====
  async loadAgenda() {
    this._agendaFilter = this._agendaFilter || 'today';
    this._agendaStatusFilter = this._agendaStatusFilter || '';
    await this.renderAgenda();
  },

  async renderAgenda() {
    const allAppointments = await DB.getAllAppointments();
    const filter = this._agendaFilter || 'today';
    const statusFilter = this._agendaStatusFilter || '';

    let filtered = [...allAppointments];
    if (filter === 'today') {
      const today = getToday();
      filtered = filtered.filter(a => a.date === today);
    } else if (filter === 'week') {
      const w = getWeekRange();
      filtered = filtered.filter(a => a.date >= w.start && a.date <= w.end);
    } else if (filter === 'month') {
      const m = getMonthRange();
      filtered = filtered.filter(a => a.date >= m.start && a.date <= m.end);
    }
    if (statusFilter) {
      filtered = filtered.filter(a => a.status === statusFilter);
    }
    filtered.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

    const container = document.getElementById('agenda-table-container');
    if (filtered.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="icon material-symbols-outlined">calendar_month</div><h4 class="font-bold text-lg mb-2">Sin turnos</h4><p class="mb-4">No hay turnos para esta selección.</p><button class="btn-primary" onclick="App.openAppointmentForm()">Nuevo Turno</button></div>`;
      return;
    }
    const statusLabels = { pending: 'Pendiente', confirmed: 'Confirmado', completed: 'Atendido', cancelled: 'Cancelado' };
    const statusColors = { pending: 'bg-yellow-100 text-yellow-800', confirmed: 'bg-blue-100 text-blue-800', completed: 'bg-green-100 text-green-800', cancelled: 'bg-gray-100 text-gray-500' };

    let html = `<table class="data-table"><thead><tr><th>Fecha</th><th>Hora</th><th>Paciente</th><th>Tipo</th><th>Estado</th><th></th></tr></thead><tbody>`;
    for (const a of filtered) {
      const patient = a.patientId ? await DB.getPatient(a.patientId) : null;
      const sl = statusLabels[a.status] || 'Pendiente';
      const sc = statusColors[a.status] || statusColors.pending;
      html += `<tr>
        <td class="text-on-surface-variant">${formatDateShort(a.date)}</td>
        <td class="font-bold">${a.time || '--:--'}</td>
        <td class="font-bold text-primary">${escapeHtml(this.patientFullName(patient))}</td>
        <td>${escapeHtml(a.type || '')}</td>
        <td><span class="badge ${sc}">${sl}</span></td>
        <td>
          <div class="flex gap-1 items-center">
            <select class="form-select text-xs border border-outline-variant rounded pl-2 pr-8 py-1 bg-surface-container-low w-32 cursor-pointer focus:ring-1 focus:ring-primary/30 outline-none" onchange="App.updateAppointmentStatus('${a.id}', this.value)">
              <option value="pending" ${a.status==='pending'?'selected':''}>Pendiente</option>
              <option value="confirmed" ${a.status==='confirmed'?'selected':''}>Confirmado</option>
              <option value="completed" ${a.status==='completed'?'selected':''}>Atendido</option>
              <option value="cancelled" ${a.status==='cancelled'?'selected':''}>Cancelado</option>
            </select>
            ${(patient && a.status !== 'completed' && a.status !== 'cancelled') ? `
              <button class="btn-ghost p-1 hover:bg-[#25D366]/10" style="color: ${App._getProximityColor(a.date)};" onclick="App.sendWhatsAppReminder('appointment', '${a.id}')" title="Recordatorio WhatsApp"><span class="material-symbols-outlined text-sm">chat</span></button>
            ` : ''}
            <button class="btn-ghost p-1 text-error" onclick="App.showDeleteAppointment('${a.id}')" title="Eliminar"><span class="material-symbols-outlined text-sm">delete</span></button>
          </div>
        </td>
      </tr>`;
    }
    html += `</tbody></table>`;
    container.innerHTML = html;
  },

  filterAgenda(filter) {
    this._agendaFilter = filter;
    document.querySelectorAll('.agenda-filter').forEach(el => el.classList.remove('active-filtr'));
    document.querySelector(`.agenda-filter[data-filter="${filter}"]`).classList.add('active-filtr');
    this.renderAgenda();
  },

  filterAgendaStatus(status) {
    this._agendaStatusFilter = status;
    document.querySelectorAll('.status-filter').forEach(el => el.classList.remove('active-filtr'));
    document.querySelector(`.status-filter[data-status="${status}"]`).classList.add('active-filtr');
    this.renderAgenda();
  },

  async openAppointmentForm(appointmentId) {
    const modal = document.getElementById('appointment-form-modal');
    const select = document.getElementById('af-patient');
    select.innerHTML = '<option value="">Seleccionar paciente...</option>';
    const patients = await DB.getAllPatients();
    patients.forEach(p => {
      select.innerHTML += `<option value="${p.id}">${escapeHtml(this.patientFullName(p))} (${escapeHtml(p.species)})</option>`;
    });
    document.getElementById('af-date').value = getToday();
    document.getElementById('af-time').value = '';
    document.getElementById('af-type').value = '';
    document.getElementById('af-notes').value = '';
    document.getElementById('af-status').value = 'pending';
    modal.classList.add('open');
  },

  async saveAppointmentForm() {
    await this._withGuard(async () => {
      const patientId = document.getElementById('af-patient').value;
      if (!patientId) { alert('Seleccioná un paciente.'); return; }
      const date = document.getElementById('af-date').value;
      if (!date) { alert('Seleccioná una fecha.'); return; }
      await DB.addAppointment({
        id: generateId('TUR'),
        patientId,
        type: document.getElementById('af-type').value.trim(),
        date,
        time: document.getElementById('af-time').value,
        status: document.getElementById('af-status').value,
        notes: document.getElementById('af-notes').value.trim()
      });
      this.closeModal('appointment-form-modal');
      if (this.currentView === 'agenda') await this.renderAgenda();
      else if (this.currentView === 'dashboard') await this.loadDashboard();
    });
  },

  async updateAppointmentStatus(id, status) {
    await DB.updateAppointment(id, { status });
    await this.renderAgenda();
  },

  showDeleteAppointment(id) {
    this.showConfirm('Eliminar Turno', '¿Eliminar este turno?', async () => {
      await DB.deleteAppointment(id);
      await this.renderAgenda();
    });
  },

  // ===== VACCINATIONS =====
  async openVaccinationForm(patientId) {
    if (!patientId) return;
    document.getElementById('vf-date').value = getToday();
    document.getElementById('vf-name').value = '';
    document.getElementById('vf-next').value = '';
    document.getElementById('vf-lot').value = '';
    document.getElementById('vf-notes').value = '';
    this._vacPatientId = patientId;
    document.getElementById('vaccination-form-modal').classList.add('open');
  },

  async saveVaccinationForm() {
    await this._withGuard(async () => {
      const name = document.getElementById('vf-name').value.trim();
      if (!name) { alert('Ingresá el nombre de la vacuna.'); return; }
      const date = document.getElementById('vf-date').value;
      if (!date) { alert('Seleccioná la fecha de aplicación.'); return; }
      const nextDose = document.getElementById('vf-next').value;
      const data = {
        id: generateId('VAC'),
        patientId: this._vacPatientId,
        vaccineName: name,
        dateApplied: date,
        nextDoseDate: nextDose || '',
        lot: document.getElementById('vf-lot').value.trim(),
        notes: document.getElementById('vf-notes').value.trim()
      };
      await DB.addVaccination(data);
      this.closeModal('vaccination-form-modal');
      if (this.currentView === 'patient-detail' && this.currentPatientId) {
        await this.renderPatientVaccines(this.currentPatientId);
      }
    });
  },

  async renderPatientVaccines(patientId) {
    const vaccines = await DB.getVaccinationsByPatient(patientId);
    vaccines.sort((a, b) => b.dateApplied.localeCompare(a.dateApplied));
    const container = document.getElementById('patient-vaccines');
    if (vaccines.length === 0) {
      container.innerHTML = `<div class="empty-state !p-6"><div class="icon material-symbols-outlined">vaccines</div><p>Sin vacunas registradas</p></div>`;
      return;
    }
    let html = `<table class="data-table"><thead><tr><th>Vacuna</th><th>Aplicada</th><th>Próxima Dosis</th><th>Lote</th><th></th></tr></thead><tbody>`;
    for (const v of vaccines) {
      const isOverdue = v.nextDoseDate && v.nextDoseDate < getToday();
      html += `<tr>
        <td class="font-medium">${escapeHtml(v.vaccineName)}</td>
        <td>${formatDateShort(v.dateApplied)}</td>
        <td>${v.nextDoseDate ? `<span class="${isOverdue ? 'text-error font-bold' : ''}">${formatDateShort(v.nextDoseDate)}${isOverdue ? ' ⚠' : ''}</span>` : '—'}</td>
        <td class="text-on-surface-variant">${escapeHtml(v.lot || '—')}</td>
        <td>
          <div class="flex gap-1 items-center">
            ${v.nextDoseDate ? `
              <button class="btn-ghost p-1 hover:bg-[#25D366]/10" style="color: ${App._getProximityColor(v.nextDoseDate)};" onclick="App.sendWhatsAppReminder('vaccine', '${v.id}')" title="Recordatorio WhatsApp"><span class="material-symbols-outlined text-sm">chat</span></button>
            ` : ''}
            <button class="btn-ghost p-1 text-error" onclick="App.showDeleteVaccination('${v.id}')" title="Eliminar"><span class="material-symbols-outlined text-sm">delete</span></button>
          </div>
        </td>
      </tr>`;
    }
    html += `</tbody></table>`;
    container.innerHTML = html;
  },

  showDeleteVaccination(id) {
    this.showConfirm('Eliminar Vacuna', '¿Eliminar este registro de vacuna?', async () => {
      await DB.deleteVaccination(id);
      if (this.currentPatientId) await this.renderPatientVaccines(this.currentPatientId);
    });
  },

  // ===== PRESCRIPTIONS =====
  async openPrescriptionForm(patientId) {
    if (!patientId) return;
    const patient = await DB.getPatient(patientId);
    if (!patient) return;
    document.getElementById('rf-patient-name').value = this.patientFullName(patient) + ' (' + patient.species + ')';
    document.getElementById('rf-date').value = getToday();
    document.getElementById('rf-vet').value = '';
    document.getElementById('rf-indications').value = '';
    // Reset medications to one empty row
    const container = document.getElementById('medications-container');
    container.innerHTML = App._medicationRowHtml();
    this._rxPatientId = patientId;
    document.getElementById('prescription-form-modal').classList.add('open');
  },

  _medicationRowHtml() {
    return `<div class="med-row grid grid-cols-12 gap-2 items-end p-3 bg-surface-container-low rounded-lg">
      <div class="col-span-3">
        <label class="text-[10px] text-on-surface-variant font-semibold">Medicamento</label>
        <input class="form-input text-sm py-2 mt-1" placeholder="Nombre" list="med-list">
      </div>
      <div class="col-span-2">
        <label class="text-[10px] text-on-surface-variant font-semibold">Dosis</label>
        <input class="form-input text-sm py-2 mt-1" placeholder="Ej: 500mg">
      </div>
      <div class="col-span-3">
        <label class="text-[10px] text-on-surface-variant font-semibold">Frecuencia</label>
        <input class="form-input text-sm py-2 mt-1" placeholder="Ej: Cada 12hs">
      </div>
      <div class="col-span-2">
        <label class="text-[10px] text-on-surface-variant font-semibold">Duración</label>
        <input class="form-input text-sm py-2 mt-1" placeholder="Ej: 7 días">
      </div>
      <div class="col-span-2 flex items-end">
        <button class="btn-ghost p-1 text-error" onclick="App.removeMedicationRow(this)" title="Quitar">
          <span class="material-symbols-outlined text-sm">remove_circle</span>
        </button>
      </div>
    </div>`;
  },

  addMedicationRow() {
    const container = document.getElementById('medications-container');
    container.insertAdjacentHTML('beforeend', App._medicationRowHtml());
  },

  removeMedicationRow(btn) {
    const row = btn.closest('.med-row');
    if (document.querySelectorAll('.med-row').length <= 1) {
      row.querySelectorAll('input').forEach(i => i.value = '');
      return;
    }
    row.remove();
  },

  async savePrescriptionForm() {
    const medRows = document.querySelectorAll('.med-row');
    if (medRows.length === 0) { alert('Agregá al menos un medicamento.'); return; }
    const medications = [];
    medRows.forEach(row => {
      const inputs = row.querySelectorAll('input');
      if (inputs[0].value.trim()) {
        medications.push({
          name: inputs[0].value.trim(),
          dose: inputs[1].value.trim(),
          frequency: inputs[2].value.trim(),
          duration: inputs[3].value.trim()
        });
      }
    });
    if (medications.length === 0) { alert('Completá al menos un medicamento.'); return; }

    const data = {
      id: generateId('REC'),
      patientId: this._rxPatientId,
      date: document.getElementById('rf-date').value || getToday(),
      veterinarian: document.getElementById('rf-vet').value.trim(),
      medications,
      indications: document.getElementById('rf-indications').value.trim()
    };
    await DB.addPrescription(data);
    this.closeModal('prescription-form-modal');
    if (this.currentView === 'patient-detail' && this.currentPatientId) {
      await this.renderPatientPrescriptions(this.currentPatientId);
    }
  },

  async renderPatientPrescriptions(patientId) {
    const prescriptions = await DB.getPrescriptionsByPatient(patientId);
    const container = document.getElementById('patient-prescriptions');
    if (prescriptions.length === 0) {
      container.innerHTML = `<div class="empty-state !p-6"><div class="icon material-symbols-outlined">description</div><p>Sin recetas registradas</p></div>`;
      return;
    }
    let html = `<table class="data-table"><thead><tr><th>Fecha</th><th>Medicamentos</th><th>Veterinario</th><th></th></tr></thead><tbody>`;
    for (const rx of prescriptions) {
      const meds = rx.medications.map(m => m.name).join(', ');
      html += `<tr>
        <td class="text-on-surface-variant">${formatDateShort(rx.date)}</td>
        <td class="font-medium">${escapeHtml(meds)}</td>
        <td>${escapeHtml(rx.veterinarian || '—')}</td>
        <td>
          <button class="btn-primary text-xs py-1.5 px-3" onclick="App.exportPrescriptionPDF('${rx.id}')">
            <span class="material-symbols-outlined text-sm">picture_as_pdf</span> PDF
          </button>
        </td>
      </tr>`;
    }
    html += `</tbody></table>`;
    container.innerHTML = html;
  },

  async exportPrescriptionPDF(rxId) {
    try {
      await generatePrescriptionPDF(rxId);
    } catch (e) {
      console.error(e);
      alert('Error al generar PDF de receta.');
    }
  },

  // ===== PATIENTS =====
  async loadPatients() {
    this._showLoading('patients-table-container');
    const patients = await DB.getAllPatients();
    this.renderPatientsList(patients);
  },

  renderPatientsList(patients) {
    const container = document.getElementById('patients-table-container');
    if (patients.length === 0) {
      container.innerHTML = `<div class="empty-state">
        <div class="icon material-symbols-outlined">pets</div>
        <h4 class="font-bold text-lg mb-2">No hay pacientes</h4>
        <p class="mb-4">Comienza registrando tu primer paciente.</p>
        <button class="btn-primary" onclick="App.openPatientForm()"><span class="material-symbols-outlined">add</span> Registrar Paciente</button>
      </div>`;
      return;
    }
    let html = `<table class="data-table"><thead><tr><th style="width:44px"></th><th>Nombre</th><th>Especie</th><th>Raza</th><th>Dueño</th><th>Teléfono</th><th></th></tr></thead><tbody>`;
    for (const p of patients) {
      const thumb = p.photo
        ? `<img src="${escapeHtml(this._safeImgSrc(p.photo))}" class="w-8 h-8 rounded-full object-cover border border-outline-variant">`
        : `<div class="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center"><span class="material-symbols-outlined text-sm text-primary">pets</span></div>`;
      const fullName = p.lastName ? `${escapeHtml(p.name)} ${escapeHtml(p.lastName)}` : escapeHtml(p.name);
      html += `<tr class="cursor-pointer hover:bg-surface-container-low" onclick="App.viewPatient('${p.id}')">
        <td>${thumb}</td>
        <td class="font-bold text-primary">${fullName}</td>
        <td><span class="badge badge-secondary">${escapeHtml(p.species)}</span></td>
        <td>${escapeHtml(p.breed)}</td>
        <td>${escapeHtml(p.ownerName)}</td>
        <td class="text-on-surface-variant">${escapeHtml(p.ownerPhone)}</td>
        <td onclick="event.stopPropagation()">
          <div class="flex gap-1">
            <button class="btn-ghost p-1" onclick="App.openPatientForm('${p.id}')" title="Editar"><span class="material-symbols-outlined text-sm">edit</span></button>
            <button class="btn-ghost p-1" onclick="App.showDeletePatient('${p.id}')" title="Eliminar"><span class="material-symbols-outlined text-sm text-error">delete</span></button>
          </div>
        </td>
      </tr>`;
    }
    html += `</tbody></table>`;
    container.innerHTML = html;
  },

  _debounce(key, fn, delay) {
    clearTimeout(this._searchDebounceTimers[key]);
    this._searchDebounceTimers[key] = setTimeout(fn, delay);
  },

  async searchPatients(query) {
    this._debounce('searchPatients', async () => {
      const patients = await DB.searchPatients(query);
      const speciesFilter = document.getElementById('species-filter')?.value;
      const filtered = speciesFilter ? patients.filter(p => p.species === speciesFilter) : patients;
      this.renderPatientsList(filtered);
    }, 250);
  },

  async filterPatients() {
    const query = document.getElementById('patient-search').value;
    await this.searchPatients(query);
  },

  // ===== CLIENTS =====
  async loadClients() {
    this._showLoading('clients-table-container');
    const clients = await this._aggregateClients();
    this.renderClientsList(clients);
  },

  async _aggregateClients(searchQuery) {
    const patients = await DB.getAllPatients();
    const q = searchQuery ? searchQuery.toLowerCase() : '';
    const map = {};
    for (const p of patients) {
      const key = (p.ownerName || '').toLowerCase().trim() + '|' + (p.ownerPhone || '');
      if (!key.startsWith('|')) { // skip patients without owner name
        if (!map[key]) {
          map[key] = {
            name: p.ownerName || '',
            phone: p.ownerPhone || '',
            email: p.ownerEmail || '',
            address: p.ownerAddress || '',
            patients: []
          };
        }
        map[key].patients.push(p);
      }
    }
    let result = Object.values(map);
    if (q) {
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.patients.some(p => (p.name + ' ' + (p.lastName || '')).toLowerCase().includes(q))
      );
    }
    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  },

  renderClientsList(clients) {
    const container = document.getElementById('clients-table-container');
    if (clients.length === 0) {
      const searchVal = document.getElementById('client-search').value.trim();
      container.innerHTML = searchVal
        ? `<div class="empty-state"><div class="icon material-symbols-outlined">search_off</div><h4 class="font-bold text-lg mb-2">Sin resultados</h4><p class="mb-4">No se encontraron clientes con ese criterio de búsqueda.</p></div>`
        : `<div class="empty-state"><div class="icon material-symbols-outlined">people</div><h4 class="font-bold text-lg mb-2">No hay clientes</h4><p class="mb-4">Los clientes aparecerán automáticamente cuando registres pacientes con datos de dueño.</p></div>`;
      return;
    }
    let html = `<table class="data-table"><thead><tr><th>Nombre</th><th>Teléfono</th><th>Email</th><th>Dirección</th><th>Mascotas</th></tr></thead><tbody>`;
    for (const c of clients) {
      const petTags = c.patients.map(p =>
        `<span class="badge badge-secondary cursor-pointer hover:opacity-80" onclick="App.viewPatient('${p.id}')" title="Ver paciente">${escapeHtml(p.name)}${p.lastName ? ' ' + escapeHtml(p.lastName) : ''}</span>`
      ).join(' ');
      html += `<tr class="cursor-pointer hover:bg-surface-container-low" onclick="App.viewClient('${escapeHtml(c.name.replace(/'/g, "\\'"))}','${escapeHtml(c.phone.replace(/'/g, "\\'"))}')">
        <td class="font-bold text-primary">${escapeHtml(c.name)}</td>
        <td class="text-on-surface-variant">${escapeHtml(c.phone)}</td>
        <td class="text-on-surface-variant">${escapeHtml(c.email || '—')}</td>
        <td class="text-on-surface-variant max-w-xs truncate">${escapeHtml(c.address || '—')}</td>
        <td><div class="flex flex-wrap gap-1">${petTags}</div></td>
      </tr>`;
    }
    html += `</tbody></table>`;
    container.innerHTML = html;
  },

  async searchClients(query) {
    this._debounce('searchClients', async () => {
      const clients = await this._aggregateClients(query);
      this.renderClientsList(clients);
    }, 250);
  },

  async viewClient(ownerName, ownerPhone) {
    const clients = await this._aggregateClients();
    const client = clients.find(c =>
      c.name === ownerName && c.phone === ownerPhone
    );
    if (!client) return;
    this._currentClientKey = { name: ownerName, phone: ownerPhone };
    this.currentView = 'client-detail';
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-client-detail').classList.add('active');
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    const link = document.querySelector('.sidebar-link[data-view="clients"]');
    if (link) link.classList.add('active');
    this.renderClientDetail(client);
  },

  renderClientDetail(client) {
    document.getElementById('cd-owner-name').textContent = client.name;
    document.getElementById('cd-owner-count').textContent = `${client.patients.length} mascota${client.patients.length !== 1 ? 's' : ''} registrada${client.patients.length !== 1 ? 's' : ''}`;
    document.getElementById('cd-phone').textContent = client.phone || '—';
    document.getElementById('cd-email').textContent = client.email || '—';
    document.getElementById('cd-address').textContent = client.address || '—';

    const container = document.getElementById('cd-pets-container');
    if (client.patients.length === 0) {
      container.innerHTML = `<div class="empty-state !p-4"><div class="icon material-symbols-outlined">pets</div><p class="text-sm">Sin mascotas registradas</p></div>`;
      return;
    }
    let html = `<table class="data-table"><thead><tr><th style="width:44px"></th><th>Nombre</th><th>Especie</th><th>Raza</th><th>Sexo</th><th>Edad</th></tr></thead><tbody>`;
    for (const p of client.patients) {
      const thumb = p.photo
        ? `<img src="${escapeHtml(this._safeImgSrc(p.photo))}" class="w-8 h-8 rounded-full object-cover border border-outline-variant">`
        : `<div class="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center"><span class="material-symbols-outlined text-sm text-primary">pets</span></div>`;
      const fullName = p.lastName ? `${escapeHtml(p.name)} ${escapeHtml(p.lastName)}` : escapeHtml(p.name);
      const age = [];
      if (p.ageYears) age.push(`${p.ageYears} año${p.ageYears !== 1 ? 's' : ''}`);
      if (p.ageMonths) age.push(`${p.ageMonths} mes${p.ageMonths !== 1 ? 'es' : ''}`);
      html += `<tr class="cursor-pointer hover:bg-surface-container-low" onclick="App.viewPatient('${p.id}')">
        <td>${thumb}</td>
        <td class="font-bold text-primary">${fullName}</td>
        <td><span class="badge badge-secondary">${escapeHtml(p.species)}</span></td>
        <td>${escapeHtml(p.breed)}</td>
        <td>${escapeHtml(p.sex)}</td>
        <td class="text-on-surface-variant">${age.join(' ') || '—'}</td>
      </tr>`;
    }
    html += `</tbody></table>`;
    container.innerHTML = html;

    // Set title
    document.getElementById('cd-name').textContent = client.name;
    document.getElementById('cd-subtitle').textContent = `${client.patients.length} mascota${client.patients.length !== 1 ? 's' : ''}`;
  },

  loadSpeciesFilter() {
    const select = document.getElementById('species-filter');
    select.innerHTML = '<option value="">Todas las especies</option>';
    SPECIES.forEach(s => {
      select.innerHTML += `<option value="${s}">${s}</option>`;
    });
  },

  async openPatientForm(patientId) {
    this.editingPatientId = patientId || null;
    const modal = document.getElementById('patient-form-modal');
    const title = document.getElementById('patient-form-title');
    const speciesSelect = document.getElementById('pf-species');

    // Populate species
    speciesSelect.innerHTML = '';
    SPECIES.forEach(s => {
      speciesSelect.innerHTML += `<option value="${s}">${s}</option>`;
    });

    if (patientId) {
      const p = await DB.getPatient(patientId);
      if (!p) return;
      title.textContent = 'Editar Paciente';
      document.getElementById('pf-name').value = p.name || '';
      document.getElementById('pf-lastname').value = p.lastName || '';
      document.getElementById('pf-lastname').dataset.userEdited = 'true';
      speciesSelect.value = p.species || 'Perro';
      this.updateBreeds();
      const breed = p.breed || '';
      const breedSelect = document.getElementById('pf-breed');
      const breedOptions = [...breedSelect.options].map(o => o.value);
      if (breed && !breedOptions.includes(breed) && breed !== 'Otro') {
        breedSelect.style.display = 'none';
        document.getElementById('pf-breed-custom').value = breed;
        document.getElementById('pf-breed-custom').style.display = '';
        document.getElementById('btn-toggle-breed').style.display = 'none';
      } else {
        breedSelect.value = breed;
      }
      document.getElementById('pf-sex').value = p.sex || 'Macho';
      document.getElementById('pf-neutered').value = p.neutered ? 'yes' : 'no';
      document.getElementById('pf-age-years').value = p.ageYears || 0;
      document.getElementById('pf-age-months').value = p.ageMonths || 0;
      document.getElementById('pf-weight').value = p.weight || '';
      document.getElementById('pf-color').value = p.color || '';
      document.getElementById('pf-microchip').value = p.microchip || '';
      document.getElementById('pf-marks').value = p.marks || '';
      document.getElementById('pf-owner').value = p.ownerName || '';
      document.getElementById('pf-owner-phone').value = p.ownerPhone || '';
      document.getElementById('pf-owner-email').value = p.ownerEmail || '';
      document.getElementById('pf-owner-address').value = p.ownerAddress || '';
      document.getElementById('pf-alerts').value = p.alerts || '';
      document.getElementById('pf-notes').value = p.notes || '';
      // Photo
      if (p.photo) {
        document.getElementById('pf-photo-preview').src = p.photo;
        document.getElementById('pf-photo-preview').style.display = 'block';
        document.getElementById('pf-photo-icon').style.display = 'none';
        document.getElementById('pf-photo-text').textContent = 'Cambiar foto';
        document.getElementById('pf-photo-remove').style.display = 'inline';
      }
    } else {
      title.textContent = 'Nuevo Paciente';
      document.querySelectorAll('#patient-form-modal input, #patient-form-modal textarea').forEach(el => {
        if (el.type !== 'number') el.value = '';
      });
      document.getElementById('pf-lastname').dataset.userEdited = '';
      document.getElementById('pf-age-years').value = 0;
      document.getElementById('pf-age-months').value = 0;
      document.getElementById('pf-sex').value = 'Macho';
      document.getElementById('pf-neutered').value = 'no';
      speciesSelect.value = 'Perro';
      this.updateBreeds();
      // Reset photo
      document.getElementById('pf-photo-preview').src = '';
      document.getElementById('pf-photo-preview').style.display = 'none';
      document.getElementById('pf-photo-icon').style.display = 'block';
      document.getElementById('pf-photo-text').textContent = 'Agregar foto';
      document.getElementById('pf-photo-remove').style.display = 'none';
    }
    modal.classList.add('open');
  },

  handlePatientPhoto(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('La foto no puede superar los 2MB. Comprimí la imagen o seleccioná otra.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById('pf-photo-preview');
      preview.src = e.target.result;
      preview.style.display = 'block';
      document.getElementById('pf-photo-icon').style.display = 'none';
      document.getElementById('pf-photo-text').textContent = 'Cambiar foto';
      document.getElementById('pf-photo-remove').style.display = 'inline';
    };
    reader.readAsDataURL(file);
  },

  removePatientPhoto(e) {
    e.stopPropagation();
    document.getElementById('pf-photo-preview').src = '';
    document.getElementById('pf-photo-preview').style.display = 'none';
    document.getElementById('pf-photo-icon').style.display = 'block';
    document.getElementById('pf-photo-text').textContent = 'Agregar foto';
    document.getElementById('pf-photo-remove').style.display = 'none';
  },

  async savePatientForm() {
    await this._withGuard(async () => {
      const name = document.getElementById('pf-name').value.trim();
      if (!name) { alert('El nombre del animal es obligatorio.'); return; }
      const owner = document.getElementById('pf-owner').value.trim();
      if (!owner) { alert('El nombre del propietario es obligatorio.'); return; }
      const phone = document.getElementById('pf-owner-phone').value.trim();
      if (!phone) { alert('El teléfono del propietario es obligatorio.'); return; }

      const lastName = document.getElementById('pf-lastname').value.trim();
      const data = {
        name,
        lastName,
        species: document.getElementById('pf-species').value,
        breed: this._getBreedValue(),
        sex: document.getElementById('pf-sex').value,
        neutered: document.getElementById('pf-neutered').value === 'yes',
        ageYears: parseInt(document.getElementById('pf-age-years').value) || 0,
        ageMonths: parseInt(document.getElementById('pf-age-months').value) || 0,
        weight: parseFloat(document.getElementById('pf-weight').value) || 0,
        color: document.getElementById('pf-color').value.trim(),
        microchip: document.getElementById('pf-microchip').value.trim(),
        marks: document.getElementById('pf-marks').value.trim(),
        ownerName: owner,
        ownerPhone: phone,
        ownerEmail: document.getElementById('pf-owner-email').value.trim(),
        ownerAddress: document.getElementById('pf-owner-address').value.trim(),
        photo: document.getElementById('pf-photo-preview').src || '',
        alerts: document.getElementById('pf-alerts').value.trim(),
        notes: document.getElementById('pf-notes').value.trim(),
        updatedAt: getToday()
      };

      if (this.editingPatientId) {
        data.id = this.editingPatientId;
        await DB.updatePatient(data);
      } else {
        data.id = generateId('PAC');
        data.createdAt = getToday();
        await DB.addPatient(data);
      }

      this.closeModal('patient-form-modal');
      if (this.currentView === 'patients') await this.loadPatients();
      else if (this.currentView === 'dashboard') await this.loadDashboard();
      if (this.editingPatientId && this.currentView === 'patient-detail') {
        await this.loadPatientDetail(this.editingPatientId);
      }
    });
  },

  showDeletePatient(id) {
    this.showConfirm(
      'Eliminar Paciente',
      '¿Estás seguro de eliminar este paciente? Esta acción no se puede deshacer.',
      async () => {
        await DB.deletePatient(id);
        await this.loadPatients();
      }
    );
  },

  async viewPatient(id) {
    this.currentPatientId = id;
    this.currentView = 'patient-detail';
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-patient-detail').classList.add('active');
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    const link = document.querySelector('.sidebar-link[data-view="patients"]');
    if (link) link.classList.add('active');
    await this.loadPatientDetail(id);
  },

  async loadPatientDetail(id) {
    const p = await DB.getPatient(id);
    if (!p) { this.navigate('patients'); return; }
    this.currentPatientId = id;

    const fullName = p.lastName ? `${p.name} ${p.lastName}` : p.name;
    document.getElementById('detail-name').textContent = fullName;
    document.getElementById('detail-id').textContent = `ID: ${p.id}`;
    // Photo
    const photoImg = document.getElementById('pd-photo-img');
    const photoPlaceholder = document.getElementById('pd-photo-placeholder');
    if (p.photo) {
      photoImg.src = p.photo;
      photoImg.style.display = 'block';
      photoPlaceholder.style.display = 'none';
    } else {
      photoImg.style.display = 'none';
      photoPlaceholder.style.display = 'block';
    }

    document.getElementById('pd-name').textContent = fullName;
    document.getElementById('pd-breed').textContent = p.species + (p.breed ? ` • ${p.breed}` : '');
    document.getElementById('pd-age').textContent = p.ageYears + ' años' + (p.ageMonths > 0 ? ' y ' + p.ageMonths + ' meses' : '');
    document.getElementById('pd-weight').textContent = p.weight ? p.weight + ' kg' : '—';
    document.getElementById('pd-sex').textContent = p.sex + (p.neutered ? ' (E/C)' : '');
    document.getElementById('pd-idnum').textContent = p.id;
    document.getElementById('pd-owner').textContent = p.ownerName;
    document.getElementById('pd-owner-phone').textContent = p.ownerPhone || '';
    document.getElementById('pd-owner-email').textContent = p.ownerEmail || '';

    // Alerts
    const alertsContainer = document.getElementById('pd-alerts-container');
    if (p.alerts) {
      alertsContainer.style.display = 'block';
      document.getElementById('pd-alerts').textContent = p.alerts;
    } else {
      alertsContainer.style.display = 'none';
    }

    // Notes
    const notesContainer = document.getElementById('pd-notes-container');
    if (p.notes) {
      notesContainer.style.display = 'block';
      document.getElementById('pd-notes').textContent = p.notes;
    } else {
      notesContainer.style.display = 'none';
    }

    // Info tab
    document.getElementById('pi-species').textContent = p.species;
    document.getElementById('pi-breed').textContent = p.breed || '—';
    document.getElementById('pi-color').textContent = p.color || '—';
    document.getElementById('pi-microchip').textContent = p.microchip || '—';
    document.getElementById('pi-marks').textContent = p.marks || 'Sin señas particulares';

    // History tab
    await this.renderPatientHistory(id);
    await this.renderPatientVaccines(id);
    await this.renderPatientPrescriptions(id);
    // Reset tabs to history
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('.tab-btn[data-tab="history"]').classList.add('active');
    document.getElementById('tab-history').classList.add('active');
  },

  async renderPatientHistory(patientId) {
    const services = await DB.getServicesByPatient(patientId);
    services.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    const container = document.getElementById('patient-history');
    if (services.length === 0) {
      container.innerHTML = `<div class="empty-state !p-8"><div class="icon material-symbols-outlined">history</div><p>Sin servicios registrados</p><button class="btn-secondary mt-3" onclick="App.openServiceForm('${patientId}')">Registrar Servicio</button></div>`;
      return;
    }
    let html = `<table class="data-table"><thead><tr><th>Fecha</th><th>Servicio</th><th>Profesional</th><th>Observaciones</th><th></th></tr></thead><tbody>`;
    for (const s of services) {
      html += `<tr>
        <td class="text-sm">${formatDateShort(s.date)} ${s.time || ''}</td>
        <td class="font-medium">${escapeHtml(s.serviceType)}</td>
        <td>${escapeHtml(s.performedBy || '—')}</td>
        <td class="text-sm text-on-surface-variant max-w-xs truncate">${escapeHtml(s.notes || '')}</td>
        <td>
          <button class="btn-ghost p-1 text-[#25D366] hover:bg-[#25D366]/10" onclick="App.sendWhatsAppReport('${s.id}')" title="Enviar Reporte por WhatsApp">
            <span class="material-symbols-outlined text-sm">share</span>
          </button>
        </td>
      </tr>`;
    }
    html += `</tbody></table>`;
    container.innerHTML = html;
  },

  switchPatientTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add('active');
    document.getElementById('tab-' + tab).classList.add('active');
  },

  async editCurrentPatient() {
    if (this.currentPatientId) {
      this.openPatientForm(this.currentPatientId);
    }
  },

  async exportPatientPDF(event) {
    if (!this.currentPatientId) return;
    const btn = event ? event.target.closest('button') : null;
    try {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined">sync</span> Generando...';
      }
      await generatePatientPDF(this.currentPatientId);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined">picture_as_pdf</span> PDF';
      }
    } catch (e) {
      console.error('PDF error:', e);
      alert('Error al generar el PDF. Revisa la consola.');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined">picture_as_pdf</span> PDF';
      }
    }
  },

  _getBreedValue() {
    const custom = document.getElementById('pf-breed-custom');
    if (custom.style.display !== 'none') {
      return custom.value.trim() || '';
    }
    const val = document.getElementById('pf-breed').value;
    return val === '__custom__' ? '' : val;
  },

  markLastNameEdited() {
    document.getElementById('pf-lastname').dataset.userEdited = 'true';
  },

  autoFillLastName() {
    const owner = document.getElementById('pf-owner').value.trim();
    const lastNameInput = document.getElementById('pf-lastname');
    if (!lastNameInput.dataset.userEdited) {
      const parts = owner.split(' ').filter(p => p);
      if (parts.length <= 1) {
        lastNameInput.value = parts[0] || '';
      } else {
        // Tomar todo después del primer nombre como apellido
        lastNameInput.value = parts.slice(1).join(' ');
      }
    }
  },

  updateBreeds() {
    const species = document.getElementById('pf-species').value;
    const breedSelect = document.getElementById('pf-breed');
    const customInput = document.getElementById('pf-breed-custom');
    const btnToggle = document.getElementById('btn-toggle-breed');
    breedSelect.innerHTML = '';
    breedSelect.style.display = '';
    customInput.style.display = 'none';
    customInput.value = '';
    btnToggle.style.display = '';
    const breeds = BREEDS_BY_SPECIES[species] || ['Otro'];
    breeds.forEach(b => {
      breedSelect.innerHTML += `<option value="${b}">${b}</option>`;
    });
    breedSelect.innerHTML += `<option value="__custom__" style="color:#00366b;font-weight:600;">✏️ Otra raza...</option>`;
  },

  onBreedChange() {
    const val = document.getElementById('pf-breed').value;
    if (val === '__custom__') {
      document.getElementById('pf-breed').style.display = 'none';
      document.getElementById('pf-breed-custom').style.display = '';
      document.getElementById('pf-breed-custom').focus();
      document.getElementById('btn-toggle-breed').style.display = 'none';
    }
  },

  toggleBreedInput() {
    const select = document.getElementById('pf-breed');
    const input = document.getElementById('pf-breed-custom');
    const btn = document.getElementById('btn-toggle-breed');
    if (input.style.display === 'none') {
      select.style.display = 'none';
      input.style.display = '';
      btn.title = 'Volver a lista';
      btn.innerHTML = '<span class="material-symbols-outlined text-sm">list</span>';
      input.focus();
    } else {
      select.style.display = '';
      input.style.display = 'none';
      input.value = '';
      btn.title = 'Agregar raza personalizada';
      btn.innerHTML = '<span class="material-symbols-outlined text-sm">edit</span>';
    }
  },

  // ===== SERVICES =====
  loadServiceTypes() {
    const select = document.getElementById('sf-type');
    select.innerHTML = '';
    SERVICE_TYPES.forEach(t => {
      select.innerHTML += `<option value="${t}">${t}</option>`;
    });
  },

  async loadServices() {
    this._showLoading('services-table-container');
    const services = await DB.getAllServices();
    this.renderServicesList(services);
  },

  async renderServicesList(services) {
    const container = document.getElementById('services-table-container');
    if (!container) return;
    if (services.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="icon material-symbols-outlined">medical_services</div><h4 class="font-bold text-lg mb-2">No hay servicios</h4><p class="mb-4">Registra el primer servicio.</p><button class="btn-primary" onclick="App.openServiceForm()">Registrar Servicio</button></div>`;
      return;
    }
    const sorted = [...services].sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
    const rows = await Promise.all(sorted.map(async s => {
      const patient = s.patientId ? await DB.getPatient(s.patientId) : null;
      return `<tr>
        <td class="font-bold text-primary">${escapeHtml(this.patientFullName(patient))}</td>
        <td><span class="badge badge-secondary">${escapeHtml(s.serviceType)}</span></td>
        <td class="text-on-surface-variant">${formatDateShort(s.date)} ${s.time || ''}</td>
        <td>${escapeHtml(s.performedBy || '—')}</td>
        <td>
          <div class="flex gap-1 items-center">
            ${patient ? `
              <button class="btn-ghost p-1 text-[#25D366] hover:bg-[#25D366]/10" onclick="App.sendWhatsAppReport('${s.id}')" title="Enviar Reporte por WhatsApp"><span class="material-symbols-outlined text-sm">share</span></button>
            ` : ''}
            <button class="btn-ghost p-1 text-error" onclick="App.showDeleteService('${s.id}')" title="Eliminar"><span class="material-symbols-outlined text-sm">delete</span></button>
          </div>
        </td>
      </tr>`;
    }));
    container.innerHTML = `<table class="data-table"><thead><tr><th>Paciente</th><th>Servicio</th><th>Fecha</th><th>Profesional</th><th></th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
  },

  async searchServices(query) {
    this._debounce('searchServices', async () => {
      const all = await DB.getAllServices();
      if (!query) { this.renderServicesList(all); return; }
      const q = query.toLowerCase();
      const patients = await DB.getAllPatients();
      const patientMap = {};
      patients.forEach(p => { patientMap[p.id] = p; });
      const filtered = all.filter(s => {
        const patient = patientMap[s.patientId];
        const patientName = patient ? (patient.name + ' ' + (patient.lastName || '')).toLowerCase() : '';
        return s.serviceType.toLowerCase().includes(q) ||
               s.notes.toLowerCase().includes(q) ||
               s.performedBy.toLowerCase().includes(q) ||
               patientName.includes(q);
      });
      this.renderServicesList(filtered);
    }, 250);
  },

  async openServiceForm(patientId) {
    const modal = document.getElementById('service-form-modal');
    // Populate patients
    const select = document.getElementById('sf-patient');
    select.innerHTML = '<option value="">Seleccionar paciente...</option>';
    const patients = await DB.getAllPatients();
    patients.forEach(p => {
      select.innerHTML += `<option value="${p.id}">${escapeHtml(this.patientFullName(p))} (${escapeHtml(p.species)})</option>`;
    });
    if (patientId) select.value = patientId;

    // Populate products
    const pSelect = document.getElementById('sf-product');
    pSelect.innerHTML = '<option value="">Ninguno</option>';
    const products = await DB.getAllProducts();
    products.forEach(pr => {
      pSelect.innerHTML += `<option value="${pr.id}">${escapeHtml(pr.name)} (Stock: ${pr.stock})</option>`;
    });
    document.getElementById('sf-product-qty').value = 1;

    document.getElementById('sf-date').value = getToday();
    document.getElementById('sf-time').value = new Date().toTimeString().slice(0, 5);
    document.getElementById('sf-performer').value = '';
    document.getElementById('sf-notes').value = '';
    document.getElementById('sf-type').value = SERVICE_TYPES[0];
    modal.classList.add('open');
  },

  async saveServiceForm() {
    await this._withGuard(async () => {
      const patientId = document.getElementById('sf-patient').value;
      if (!patientId) { alert('Selecciona un paciente.'); return; }
      const serviceType = document.getElementById('sf-type').value;
      const date = document.getElementById('sf-date').value;
      if (!date) { alert('Selecciona una fecha.'); return; }

      const productId = document.getElementById('sf-product').value;
      const qty = parseInt(document.getElementById('sf-product-qty').value) || 1;
      let productNotes = '';

      if (productId) {
        const pr = await DB.getProduct(productId);
        if (pr) {
          if (pr.stock < qty) {
            alert(`Stock insuficiente de ${pr.name}. Stock disponible: ${pr.stock}`);
            return;
          }
          const updated = { ...pr, stock: Math.max(0, pr.stock - qty) };
          await DB.updateProduct(updated);
          productNotes = `\n[Insumo utilizado: ${pr.name} x${qty}]`;
        }
      }

      const data = {
        id: generateId('SVC'),
        patientId,
        serviceType,
        performedBy: document.getElementById('sf-performer').value.trim(),
        date,
        time: document.getElementById('sf-time').value,
        notes: document.getElementById('sf-notes').value.trim() + productNotes,
        createdAt: getToday()
      };

      await DB.addService(data);
      this.closeModal('service-form-modal');

      if (this.currentView === 'services') await this.loadServices();
      else if (this.currentView === 'dashboard') await this.loadDashboard();
      else if (this.currentView === 'inventory') await this.loadInventory();
      if (this.currentView === 'patient-detail' && this.currentPatientId) {
        await this.renderPatientHistory(this.currentPatientId);
      }
    });
  },

  showDeleteService(id) {
    this.showConfirm(
      'Eliminar Servicio',
      '¿Estás seguro de eliminar este servicio?',
      async () => {
        await DB.deleteService(id);
        if (this.currentView === 'patient-detail' && this.currentPatientId) {
          await this.renderPatientHistory(this.currentPatientId);
        } else {
          await this.loadServices();
        }
      }
    );
  },

  // ===== PROCEDURES =====
  async loadProcedures() {
    this._showLoading('procedures-table-container');
    const procedures = await DB.getAllPatientProcedures();
    this.renderProceduresList(procedures);
  },

  async renderProceduresList(procedures) {
    const container = document.getElementById('procedures-table-container');
    if (procedures.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="icon material-symbols-outlined">stethoscope</div><h4 class="font-bold text-lg mb-2">No hay procedimientos</h4><p class="mb-4">Registrá el primer procedimiento.</p><button class="btn-primary" onclick="App.openProcedureForm()">Nuevo Procedimiento</button></div>`;
      return;
    }
    const sorted = [...procedures].sort((a, b) => (b.date + (b.createdAt || '')).localeCompare(a.date + (a.createdAt || '')));
    let html = `<table class="data-table"><thead><tr><th>Paciente</th><th>Categoría</th><th>Procedimiento</th><th>Fecha</th><th>Profesional</th><th>Próxima Fecha</th><th></th></tr></thead><tbody>`;
    for (const p of sorted) {
      const patient = p.patientId ? await DB.getPatient(p.patientId) : null;
      html += `<tr>
        <td class="font-bold text-primary">${escapeHtml(this.patientFullName(patient))}</td>
        <td><span class="badge badge-secondary">${escapeHtml(p.category)}</span></td>
        <td class="font-medium">${escapeHtml(p.procedureName)}</td>
        <td class="text-on-surface-variant">${formatDateShort(p.date)}</td>
        <td>${escapeHtml(p.performedBy || '—')}</td>
        <td class="text-on-surface-variant">${p.nextDate ? formatDateShort(p.nextDate) : '—'}</td>
        <td>
          <div class="flex gap-1 items-center">
            <button class="btn-ghost p-1 text-error" onclick="App.showDeleteProcedure('${p.id}')" title="Eliminar"><span class="material-symbols-outlined text-sm">delete</span></button>
          </div>
        </td>
      </tr>`;
    }
    html += `</tbody></table>`;
    container.innerHTML = html;
  },

  async searchProcedures(query) {
    this._debounce('searchProcedures', async () => {
      const all = await DB.getAllPatientProcedures();
      if (!query) { this.renderProceduresList(all); return; }
      const q = query.toLowerCase();
      const patients = await DB.getAllPatients();
      const patientMap = {};
      patients.forEach(p => { patientMap[p.id] = p; });
      const filtered = all.filter(pp => {
        const patient = patientMap[pp.patientId];
        const patientName = patient ? (patient.name + ' ' + (patient.lastName || '')).toLowerCase() : '';
        return pp.procedureName.toLowerCase().includes(q) ||
               pp.category.toLowerCase().includes(q) ||
               pp.performedBy.toLowerCase().includes(q) ||
               patientName.includes(q);
      });
      this.renderProceduresList(filtered);
    }, 250);
  },

  async openProcedureForm() {
    const modal = document.getElementById('procedure-form-modal');
    const select = document.getElementById('ppf-patient');
    select.innerHTML = '<option value="">Seleccionar paciente...</option>';
    const patients = await DB.getAllPatients();
    patients.forEach(p => {
      select.innerHTML += `<option value="${p.id}">${escapeHtml(this.patientFullName(p))} (${escapeHtml(p.species)})</option>`;
    });
    document.getElementById('ppf-date').value = getToday();
    document.getElementById('ppf-performer').value = '';
    document.getElementById('ppf-next').value = '';
    document.getElementById('ppf-notes').value = '';
    document.getElementById('ppf-category').value = 'Baño';
    await this.updateProcedureSelect();
    modal.classList.add('open');
  },

  async updateProcedureSelect() {
    const category = document.getElementById('ppf-category').value;
    const select = document.getElementById('ppf-procedure');
    select.innerHTML = '<option value="">Seleccionar procedimiento...</option>';
    const cats = await DB.getProcedureCategories();
    const procedures = cats[category] || [];
    procedures.forEach(p => {
      select.innerHTML += `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`;
    });
  },

  async saveProcedureForm() {
    await this._withGuard(async () => {
      const patientId = document.getElementById('ppf-patient').value;
      if (!patientId) { alert('Seleccioná un paciente.'); return; }
      const category = document.getElementById('ppf-category').value;
      const procedureName = document.getElementById('ppf-procedure').value;
      if (!procedureName) { alert('Seleccioná un procedimiento.'); return; }
      const date = document.getElementById('ppf-date').value;
      if (!date) { alert('Seleccioná una fecha.'); return; }

      const data = {
        id: generateId('PP'),
        patientId,
        category,
        procedureName,
        date,
        performedBy: document.getElementById('ppf-performer').value.trim(),
        nextDate: document.getElementById('ppf-next').value || '',
        notes: document.getElementById('ppf-notes').value.trim(),
        createdAt: getToday()
      };
      await DB.addPatientProcedure(data);
      this.closeModal('procedure-form-modal');
      if (this.currentView === 'procedures') await this.loadProcedures();
      else if (this.currentView === 'dashboard') await this.loadDashboard();
    });
  },

  showDeleteProcedure(id) {
    this.showConfirm('Eliminar Procedimiento', '¿Eliminar este procedimiento?', async () => {
      await DB.deletePatientProcedure(id);
      if (this.currentView === 'procedures') await this.loadProcedures();
      else if (this.currentView === 'dashboard') await this.loadDashboard();
    });
  },

  // ===== SETTINGS - PROCEDURE CATEGORIES =====
  async loadProcedureCategoriesSettings() {
    const cats = await DB.getProcedureCategories();
    const container = document.getElementById('procedure-categories-container');
    let html = '';
    const categoryIcons = { Baño: 'bathtime', Control: 'monitor_heart', Vacunas: 'vaccines', Pipetas: 'science' };
    for (const [catName, procedures] of Object.entries(cats)) {
      html += `<div class="card p-4 border border-outline-variant">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">${categoryIcons[catName] || 'stethoscope'}</span>
            <h4 class="font-bold text-primary">${catName}</h4>
          </div>
          <button class="btn-ghost text-sm py-1 px-2 text-primary" onclick="App.addProcedureToCategory('${catName}')">
            <span class="material-symbols-outlined text-sm">add</span> Agregar
          </button>
        </div>
        <div id="proc-list-${catName}" class="space-y-1">
          ${procedures.length === 0 ? '<p class="text-xs text-on-surface-variant italic">Sin procedimientos</p>' : ''}
          ${procedures.map(p => `
            <div class="flex items-center justify-between px-3 py-2 bg-surface-container-low rounded-lg">
              <span class="text-sm">${escapeHtml(p)}</span>
              <button class="btn-ghost p-0.5 text-error" onclick="App.removeProcedureFromCategory('${catName}', '${escapeHtml(p).replace(/'/g, "\\'")}')">
                <span class="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          `).join('')}
        </div>
      </div>`;
    }
    container.innerHTML = html;
  },

  addProcedureToCategory(category) {
    const name = prompt(`Ingresá el nombre del procedimiento para "${category}":`);
    if (!name || !name.trim()) return;
    this._addProcedureToCategory(category, name.trim());
  },

  async _addProcedureToCategory(category, name) {
    const cats = await DB.getProcedureCategories();
    if (!cats[category]) cats[category] = [];
    if (cats[category].includes(name)) {
      alert('Este procedimiento ya existe en esta categoría.');
      return;
    }
    cats[category].push(name);
    await DB.saveProcedureCategories(cats);
    await this.loadProcedureCategoriesSettings();
  },

  async removeProcedureFromCategory(category, name) {
    const cats = await DB.getProcedureCategories();
    if (!cats[category]) return;
    cats[category] = cats[category].filter(p => p !== name);
    await DB.saveProcedureCategories(cats);
    await this.loadProcedureCategoriesSettings();
  },

  // ===== BARCODE SCANNING =====
  async handleBarcodeScan(barcode) {
    const input = document.getElementById('barcode-scanner-input');
    const feedback = document.getElementById('barcode-feedback');
    if (!barcode) return;
    input.value = barcode;
    feedback.textContent = 'Buscando...';
    const product = await DB.getProductByBarcode(barcode);
    if (product) {
      this._scanProduct = product;
      document.getElementById('quick-stock-product-name').textContent =
        `Producto: ${escapeHtml(product.name)} — Stock actual: ${product.stock}`;
      document.getElementById('quick-stock-qty').value = 1;
      document.getElementById('quick-stock-modal').classList.add('open');
      feedback.textContent = '✓ Encontrado';
    } else {
      feedback.textContent = '✗ No encontrado — abriendo formulario...';
      setTimeout(() => {
        this.openProductForm(null, barcode);
        feedback.textContent = '';
      }, 500);
    }
    setTimeout(() => { input.value = ''; }, 100);
    setTimeout(() => { if (feedback.textContent !== 'Buscando...') feedback.textContent = ''; }, 3000);
  },

  async confirmQuickStock() {
    if (!this._scanProduct) return;
    const qty = parseInt(document.getElementById('quick-stock-qty').value) || 1;
    if (qty <= 0) { alert('Ingresá una cantidad válida.'); return; }
    this._scanProduct.stock = (this._scanProduct.stock || 0) + qty;
    this._scanProduct.updatedAt = getToday();
    await DB.updateProduct(this._scanProduct);
    this.closeModal('quick-stock-modal');
    await this.loadInventory();
  },

  listenBarcodeScan() {
    const input = document.getElementById('barcode-scanner-input');
    input.focus();
  },

  // ===== INVENTORY =====
  async loadInventory() {
    this._showLoading('inventory-table-container');
    const products = await DB.getAllProducts();
    await this.renderProductsList(products);
    document.getElementById('barcode-scanner-input').value = '';
    document.getElementById('barcode-feedback').textContent = '';
  },

  async renderProductsList(products) {
    const totalProducts = products.length;
    const lowStock = products.filter(p => p.stock > 0 && p.stock <= p.minStock).length;
    const outOfStock = products.filter(p => p.stock <= 0).length;

    document.getElementById('inv-stat-total').textContent = totalProducts;
    document.getElementById('inv-stat-low').textContent = lowStock;
    document.getElementById('inv-stat-empty').textContent = outOfStock;

    const container = document.getElementById('inventory-table-container');
    if (totalProducts === 0) {
      container.innerHTML = `<div class="empty-state">
        <div class="icon material-symbols-outlined">inventory_2</div>
        <h4 class="font-bold text-lg mb-2">No hay productos</h4>
        <p class="mb-4">Comienza registrando tu primer producto en stock.</p>
        <button class="btn-primary" onclick="App.openProductForm()"><span class="material-symbols-outlined">add</span> Registrar Producto</button>
      </div>`;
      return;
    }

    let html = `<table class="data-table"><thead><tr><th>Nombre</th><th>Código de Barras</th><th>Stock</th><th>Stock Mínimo</th><th>Precio</th><th>Estado</th><th></th></tr></thead><tbody>`;
    for (const p of products) {
      let badgeClass = 'bg-green-100 text-green-800';
      let badgeText = 'Normal';
      if (p.stock <= 0) {
        badgeClass = 'bg-red-100 text-red-800';
        badgeText = 'Sin Stock';
      } else if (p.stock <= p.minStock) {
        badgeClass = 'bg-yellow-100 text-yellow-800';
        badgeText = 'Bajo';
      }

      html += `<tr class="hover:bg-surface-container-low">
        <td class="font-bold text-primary">${escapeHtml(p.name)}</td>
        <td class="text-xs font-mono text-on-surface-variant">${p.barcode ? escapeHtml(p.barcode) : '—'}</td>
        <td class="font-medium">${p.stock}</td>
        <td class="text-on-surface-variant">${p.minStock}</td>
        <td>$${parseFloat(p.price || 0).toFixed(2)}</td>
        <td><span class="badge ${badgeClass}">${badgeText}</span></td>
        <td>
          <div class="flex gap-1">
            <button class="btn-ghost p-1" onclick="App.openProductForm('${p.id}')" title="Editar"><span class="material-symbols-outlined text-sm">edit</span></button>
            <button class="btn-ghost p-1" onclick="App.showDeleteProduct('${p.id}')" title="Eliminar"><span class="material-symbols-outlined text-sm text-error">delete</span></button>
          </div>
        </td>
      </tr>`;
    }
    html += `</tbody></table>`;
    container.innerHTML = html;
  },

  async searchProducts(query) {
    this._debounce('searchProducts', async () => {
      const products = await DB.getAllProducts();
      if (!query) { this.renderProductsList(products); return; }
      const q = query.toLowerCase();
      const filtered = products.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
      this.renderProductsList(filtered);
    }, 250);
  },

  async openProductForm(productId, prefillBarcode) {
    this.editingProductId = productId || null;
    const modal = document.getElementById('product-form-modal');
    const title = document.getElementById('product-form-title');

    if (productId) {
      const p = await DB.getProduct(productId);
      if (!p) return;
      title.textContent = 'Editar Producto';
      document.getElementById('pr-name').value = p.name || '';
      document.getElementById('pr-barcode').value = p.barcode || '';
      document.getElementById('pr-stock').value = p.stock || 0;
      document.getElementById('pr-minstock').value = p.minStock || 2;
      document.getElementById('pr-price').value = p.price || 0;
      document.getElementById('pr-description').value = p.description || '';
    } else {
      title.textContent = 'Nuevo Producto';
      document.getElementById('pr-name').value = '';
      document.getElementById('pr-barcode').value = prefillBarcode || '';
      document.getElementById('pr-stock').value = 0;
      document.getElementById('pr-minstock').value = 2;
      document.getElementById('pr-price').value = '';
      document.getElementById('pr-description').value = '';
    }
    modal.classList.add('open');
  },

  async saveProductForm() {
    await this._withGuard(async () => {
      const name = document.getElementById('pr-name').value.trim();
      if (!name) { alert('El nombre del producto es obligatorio.'); return; }
      const stock = parseInt(document.getElementById('pr-stock').value) || 0;
      const minStock = parseInt(document.getElementById('pr-minstock').value) || 0;
      const price = parseFloat(document.getElementById('pr-price').value) || 0;
      const description = document.getElementById('pr-description').value.trim();
      const barcode = document.getElementById('pr-barcode').value.trim();

      const data = {
        name,
        barcode,
        stock,
        minStock,
        price,
        description,
        updatedAt: getToday()
      };

      if (this.editingProductId) {
        data.id = this.editingProductId;
        await DB.updateProduct(data);
      } else {
        data.id = generateId('PRD');
        data.createdAt = getToday();
        await DB.addProduct(data);
      }

      this.closeModal('product-form-modal');
      await this.loadInventory();
    });
  },

  showDeleteProduct(id) {
    this.showConfirm(
      'Eliminar Producto',
      '¿Estás seguro de eliminar este producto del inventario? Esta acción no se puede deshacer.',
      async () => {
        await DB.deleteProduct(id);
        await this.loadInventory();
      }
    );
  },

  // ===== SETTINGS =====
  async loadSettings() {
    const settings = await DB.getClinicSettings();
    document.getElementById('set-clinic-name').value = settings.clinicName || '';
    document.getElementById('set-clinic-email').value = settings.clinicEmail || '';
    document.getElementById('set-clinic-address').value = settings.clinicAddress || '';
    document.getElementById('set-clinic-phone').value = settings.clinicPhone || '';
    document.getElementById('set-clinic-taxid').value = settings.clinicTaxId || '';
    document.getElementById('set-clinic-vet').value = settings.clinicVeterinarian || '';

    // Logo
    if (settings.clinicLogo) {
      const preview = document.getElementById('logo-preview');
      preview.src = settings.clinicLogo;
      preview.style.display = 'block';
      document.getElementById('logo-placeholder').style.display = 'none';
      document.getElementById('logo-text').textContent = 'Cambiar Logo';
      document.getElementById('logo-area').classList.add('has-logo');
    }

    // PDF toggles
    const logoToggle = document.getElementById('toggle-pdf-logo');
    const vatToggle = document.getElementById('toggle-pdf-vat');
    if (settings.pdfShowLogo) logoToggle.classList.add('active'); else logoToggle.classList.remove('active');
    if (settings.pdfShowVat) vatToggle.classList.add('active'); else vatToggle.classList.remove('active');

    this._lastSettings = settings;

    // Preview name
    document.getElementById('preview-clinic-name').textContent = settings.clinicName || 'Mi Clínica';

    // Backup date
    const lastBackup = await DB.getLastBackupDate();
    document.getElementById('last-backup-display').textContent = lastBackup ? formatDate(lastBackup) : 'Nunca';
  },

  async loadSettingsForm() {
    await this.loadSettings();
    this.loadAppearance();
    this.switchSettingsTab('clinic');
  },

  async saveSettings() {
    const data = {
      clinicName: document.getElementById('set-clinic-name').value.trim(),
      clinicEmail: document.getElementById('set-clinic-email').value.trim(),
      clinicAddress: document.getElementById('set-clinic-address').value.trim(),
      clinicPhone: document.getElementById('set-clinic-phone').value.trim(),
      clinicTaxId: document.getElementById('set-clinic-taxid').value.trim(),
      clinicVeterinarian: document.getElementById('set-clinic-vet').value.trim(),
      clinicLogo: document.getElementById('logo-preview').src || '',
      pdfShowLogo: document.getElementById('toggle-pdf-logo').classList.contains('active'),
      pdfShowVat: document.getElementById('toggle-pdf-vat').classList.contains('active'),
      themePrimary: document.getElementById('custom-primary').value || '#00366b',
      themeSecondary: document.getElementById('custom-secondary').value || '#006a63',
      themeDarkMode: document.getElementById('theme-mode-dark').classList.contains('selected')
    };
    await DB.saveClinicSettings(data);
    App._lastSettings = data;
    document.getElementById('sidebar-clinic-name').textContent = data.clinicName || 'República Mascota';
    const mobName = document.getElementById('mobile-sidebar-clinic-name');
    if (mobName) mobName.textContent = data.clinicName || 'República Mascota';
    document.getElementById('preview-clinic-name').textContent = data.clinicName || 'Mi Clínica';
    
    if (data.clinicLogo) {
      const sidebarLogo = document.getElementById('sidebar-logo-img');
      if (sidebarLogo) sidebarLogo.src = data.clinicLogo;
      const mobLogo = document.getElementById('mobile-sidebar-logo-img');
      if (mobLogo) mobLogo.src = data.clinicLogo;
    }
    
    this.applyTheme(data.themePrimary, data.themeSecondary, data.themeDarkMode);
    alert('Configuración guardada correctamente.');
  },

  switchSettingsTab(tab) {
    document.querySelectorAll('.settings-section').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.lg\\:col-span-1 .card button').forEach(b => {
      b.classList.remove('bg-primary', 'text-on-primary', 'font-bold', 'shadow-md');
      b.classList.add('text-on-surface-variant');
    });
    const section = document.getElementById('settings-' + tab);
    if (section) section.style.display = 'block';
    // Find and highlight the button by text content
    document.querySelectorAll('.lg\\:col-span-1 .card button').forEach(b => {
      if ((tab === 'clinic' && b.textContent.includes('Datos')) ||
          (tab === 'branding' && b.textContent.includes('Logo')) ||
          (tab === 'pdf' && b.textContent.includes('PDF')) ||
          (tab === 'appearance' && b.textContent.includes('Apariencia')) ||
          (tab === 'procedures' && b.textContent.includes('Procedimientos')) ||
          (tab === 'backup' && b.textContent.includes('Respaldo'))) {
        b.classList.remove('text-on-surface-variant');
        b.classList.add('bg-primary', 'text-on-primary', 'font-bold', 'shadow-md');
      }
    });
    if (tab === 'procedures') {
      this.loadProcedureCategoriesSettings();
    }
  },

  handleLogoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const preview = document.getElementById('logo-preview');
      preview.src = dataUrl;
      preview.style.display = 'block';
      document.getElementById('logo-placeholder').style.display = 'none';
      document.getElementById('logo-text').textContent = 'Cambiar Logo';
      document.getElementById('logo-area').classList.add('has-logo');
    };
    reader.readAsDataURL(file);
  },

  togglePdfOption(option) {
    const toggle = document.getElementById('toggle-pdf-' + option);
    toggle.classList.toggle('active');
  },

  // ===== THEME / APPEARANCE =====
  applyTheme(primary, secondary, isDark) {
    if (!primary || !secondary) return;
    const styleId = 'theme-overrides';
    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = generateThemeStyle(primary, secondary, isDark);

    const html = document.documentElement;
    if (isDark) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  },

  selectPreset(primary, secondary) {
    document.getElementById('custom-primary').value = primary;
    document.getElementById('custom-primary-picker').value = primary;
    document.getElementById('custom-secondary').value = secondary;
    document.getElementById('custom-secondary-picker').value = secondary;
    this.applyCustomColors();
    // Highlight selected preset
    document.querySelectorAll('#color-presets > div').forEach(el => {
      el.style.outline = el.style.getPropertyValue('--p') === primary ? '3px solid #00366b' : '';
    });
  },

  applyCustomColors() {
    const primary = document.getElementById('custom-primary').value.trim();
    const secondary = document.getElementById('custom-secondary').value.trim();
    if (!/^#[0-9a-f]{6}$/i.test(primary) || !/^#[0-9a-f]{6}$/i.test(secondary)) return;
    document.getElementById('preview-primary').style.background = primary;
    document.getElementById('preview-primary-container').style.background = primary;
    document.getElementById('preview-secondary').style.background = secondary;
    document.getElementById('preview-secondary-container').style.background = secondary;

    const isDark = document.getElementById('theme-mode-dark').classList.contains('selected');
    this.applyTheme(primary, secondary, isDark);
  },

  syncColorPicker(type, value) {
    if (type === 'primary') {
      document.getElementById('custom-primary').value = value;
    } else {
      document.getElementById('custom-secondary').value = value;
    }
    this.applyCustomColors();
  },

  setThemeMode(mode) {
    document.querySelectorAll('#theme-mode-light, #theme-mode-dark').forEach(el => {
      el.classList.remove('selected');
      el.querySelector('.check-icon').style.display = 'none';
    });
    const target = document.getElementById('theme-mode-' + mode);
    target.classList.add('selected');
    target.querySelector('.check-icon').style.display = 'inline';

    const primary = document.getElementById('custom-primary').value.trim() || '#00366b';
    const secondary = document.getElementById('custom-secondary').value.trim() || '#006a63';
    this.applyTheme(primary, secondary, mode === 'dark');
  },

  loadAppearance() {
    const settings = App._lastSettings || {};
    const primary = settings.themePrimary || '#00366b';
    const secondary = settings.themeSecondary || '#006a63';
    const isDark = settings.themeDarkMode || false;

    document.getElementById('custom-primary').value = primary;
    document.getElementById('custom-primary-picker').value = primary;
    document.getElementById('custom-secondary').value = secondary;
    document.getElementById('custom-secondary-picker').value = secondary;
    document.getElementById('preview-primary').style.background = primary;
    document.getElementById('preview-primary-container').style.background = primary;
    document.getElementById('preview-secondary').style.background = secondary;
    document.getElementById('preview-secondary-container').style.background = secondary;

    // Highlight preset
    document.querySelectorAll('#color-presets > div').forEach(el => {
      el.style.outline = el.style.getPropertyValue('--p') === primary ? '3px solid var(--theme-primary, #00366b)' : '';
    });

    // Set theme mode
    document.querySelectorAll('#theme-mode-light, #theme-mode-dark').forEach(el => {
      el.classList.remove('selected');
      el.querySelector('.check-icon').style.display = 'none';
    });
    const mode = isDark ? 'dark' : 'light';
    const target = document.getElementById('theme-mode-' + mode);
    if (target) {
      target.classList.add('selected');
      target.querySelector('.check-icon').style.display = 'inline';
    }
  },

  // ===== BACKUP =====
  async checkBackupReminder() {
    const lastBackup = await DB.getLastBackupDate();
    const banner = document.getElementById('backup-banner');
    const statusEl = document.getElementById('backup-status');

    if (lastBackup) {
      const days = daysSince(lastBackup);
      statusEl.innerHTML = `<span class="material-symbols-outlined text-sm">backup</span><span>Último respaldo: hace ${days} días</span>`;
      if (days >= 7) {
        banner.classList.add('show');
        const textEl = document.getElementById('backup-banner-text');
        textEl.textContent = `Hace ${days} días que no realizas un respaldo.`;
        this._autoBackup(textEl);
      } else {
        banner.classList.remove('show');
      }
    } else {
      statusEl.innerHTML = `<span class="material-symbols-outlined text-sm">backup</span><span>Sin respaldo aún</span>`;
      banner.classList.add('show');
      const textEl = document.getElementById('backup-banner-text');
      textEl.textContent = 'Aún no has realizado ningún respaldo.';
      this._autoBackup(textEl);
    }
  },

  _autoBackup(textEl) {
    let countdown = 5;
    textEl.innerHTML = `${textEl.textContent}<br/><span style="font-size:13px;">Respaldo automático en <strong id="auto-backup-countdown">${countdown}</strong> segundos... <button class="btn-primary text-sm py-1 px-2" onclick="App.exportBackup();clearInterval(window._backupTimer);document.getElementById('backup-banner').classList.remove('show');">Ahora</button></span>`;
    const timer = setInterval(() => {
      countdown--;
      const el = document.getElementById('auto-backup-countdown');
      if (el) el.textContent = countdown;
      if (countdown <= 0) {
        clearInterval(timer);
        this.exportBackup();
      }
    }, 1000);
    window._backupTimer = timer;
  },

  async exportBackup() {
    const backup = await DB.exportAllData();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `republica_mascotas_backup_${getToday()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    await DB.setLastBackupDate(getToday());
    this.checkBackupReminder();
  },

  importBackup() {
    document.getElementById('backup-input').click();
  },

  async handleBackupImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      await DB.importAllData(backup);
      await DB.setLastBackupDate(getToday());
      alert('Datos restaurados correctamente. Se recargará la página.');
      location.reload();
    } catch (e) {
      alert('Error al restaurar el backup. Verifica que el archivo tenga el formato correcto.');
      console.error(e);
    }
    event.target.value = '';
  },

  clearAllData() {
    this.showConfirm(
      'Eliminar Todos los Datos',
      'Esta acción eliminará PERMANENTEMENTE todos los pacientes, servicios, citas y configuraciones. ¿Estás completamente seguro?',
      async () => {
        await DB.clearAll();
        alert('Todos los datos han sido eliminados. Se recargará la página.');
        location.reload();
      }
    );
  },

  _getProximityColor(dateStr) {
    if (!dateStr) return '#10B981';
    const today = new Date(getToday() + 'T12:00:00');
    const target = new Date(dateStr + 'T12:00:00');
    const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));
    if (diffDays <= 1) return '#EF4444'; // Rojo (vencido, hoy, mañana)
    if (diffDays === 2) return '#F59E0B'; // Amarillo (2 días)
    return '#10B981'; // Verde (más de 2 días)
  },

  async sendWhatsAppReminder(type, id) {
    let phone = '';
    let ownerName = '';
    let petName = '';
    let message = '';

    if (type === 'appointment') {
      const allAppts = await DB.getAllAppointments();
      const a = allAppts.find(item => item.id === id);
      if (!a) return;
      const patient = await DB.getPatient(a.patientId);
      if (!patient) return;
      phone = patient.ownerPhone;
      ownerName = patient.ownerName;
      petName = this.patientFullName(patient);
      const formattedDate = formatDateShort(a.date);
      message = `Hola ${ownerName}, te recordamos el turno de ${petName} para el día ${formattedDate} a las ${a.time || '--:--'}hs (${a.type || 'Consulta'}). ¡Te esperamos en República Mascotas! 🐾`;
    } else if (type === 'vaccine') {
      const allVac = await DB.getAllVaccinations();
      const v = allVac.find(item => item.id === id);
      if (!v) return;
      const patient = await DB.getPatient(v.patientId);
      if (!patient) return;
      phone = patient.ownerPhone;
      ownerName = patient.ownerName;
      petName = this.patientFullName(patient);
      const formattedDate = formatDateShort(v.nextDoseDate);
      const isOverdue = v.nextDoseDate && v.nextDoseDate < getToday();
      if (isOverdue) {
        message = `Hola ${ownerName}, te recordamos que ${petName} tiene vencida la vacuna: ${v.vaccineName} (venció el ${formattedDate}). Por favor, agenda un turno para su aplicación. ¡Saludos de República Mascotas! 🐾`;
      } else {
        message = `Hola ${ownerName}, te recordamos que se aproxima la fecha para la siguiente dosis de la vacuna de ${petName}: ${v.vaccineName} el día ${formattedDate}. Por favor, agenda un turno. ¡Saludos de República Mascotas! 🐾`;
      }
    }

    if (!phone) {
      alert('El paciente no tiene un número de teléfono registrado.');
      return;
    }

    const cleanedPhone = phone.replace(/[^\d+]/g, '');
    const encodedMessage = encodeURIComponent(message);
    const waUrl = `https://wa.me/${cleanedPhone}?text=${encodedMessage}`;
    window.open(waUrl, '_blank');
  },

  async sendWhatsAppReport(serviceId) {
    const allServices = await DB.getAllServices();
    const s = allServices.find(item => item.id === serviceId);
    if (!s) return;
    const patient = await DB.getPatient(s.patientId);
    if (!patient) return;
    const phone = patient.ownerPhone;
    const ownerName = patient.ownerName;
    const petName = this.patientFullName(patient);
    const formattedDate = formatDateShort(s.date);
    
    let message = `🐾 *República Mascotas - Reporte Médico* 🐾\n\n`;
    message += `Estimado/a *${ownerName}*,\n`;
    message += `Te compartimos el reporte de la atención de *${petName}*:\n\n`;
    message += `📅 *Fecha:* ${formattedDate} ${s.time || ''}\n`;
    message += `🩺 *Servicio:* ${s.serviceType}\n`;
    message += `👨‍⚕️ *Profesional:* ${s.performedBy || '—'}\n`;
    if (s.notes) {
      message += `📝 *Detalles:* ${s.notes}\n`;
    }
    message += `\n¡Gracias por confiar el cuidado de ${petName} en nosotros! 🐾`;

    if (!phone) {
      alert('El paciente no tiene un número de teléfono registrado.');
      return;
    }

    const cleanedPhone = phone.replace(/[^\d+]/g, '');
    const encodedMessage = encodeURIComponent(message);
    const waUrl = `https://wa.me/${cleanedPhone}?text=${encodedMessage}`;
    window.open(waUrl, '_blank');
  },

  // ===== MODALS =====
  closeModal(id) {
    document.getElementById(id).classList.remove('open');
    if (id === 'patient-form-modal') {
      this.editingPatientId = null;
    }
    if (id === 'product-form-modal') {
      this.editingProductId = null;
      this._scanProduct = null;
    }
    if (id === 'quick-stock-modal') {
      this._scanProduct = null;
    }
  },

  showConfirm(title, message, onConfirm) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-btn').onclick = async () => {
      this.closeModal('confirm-modal');
      await onConfirm();
    };
    document.getElementById('confirm-modal').classList.add('open');
  }
};

const THEME_PRESETS = {
  '#00366b': { name: 'Clásico', secondary: '#006a63' },
  '#2e7d32': { name: 'Bosque', secondary: '#00695c' },
  '#4a148c': { name: 'Lavanda', secondary: '#6a1b9a' },
  '#e65100': { name: 'Atardecer', secondary: '#bf360c' },
  '#0d47a1': { name: 'Marino', secondary: '#00838f' },
  '#c62828': { name: 'Roble', secondary: '#4e342e' }
};

function generateThemeStyle(primary, secondary, isDark) {
  const p = primary || '#00366b';
  const s = secondary || '#006a63';

  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return `${r},${g},${b}`;
  }

  function lighten(hex, pct) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    const lr = Math.min(255, Math.round(r + (255 - r) * pct));
    const lg = Math.min(255, Math.round(g + (255 - g) * pct));
    const lb = Math.min(255, Math.round(b + (255 - b) * pct));
    return `#${lr.toString(16).padStart(2,'0')}${lg.toString(16).padStart(2,'0')}${lb.toString(16).padStart(2,'0')}`;
  }

  function darken(hex, pct) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    const dr = Math.max(0, Math.round(r * (1-pct)));
    const dg = Math.max(0, Math.round(g * (1-pct)));
    const db = Math.max(0, Math.round(b * (1-pct)));
    return `#${dr.toString(16).padStart(2,'0')}${dg.toString(16).padStart(2,'0')}${db.toString(16).padStart(2,'0')}`;
  }

  const pLight = lighten(p, 0.65);
  const pDark = darken(p, 0.65);
  const pContainer = darken(p, 0.2);
  const pOnContainer = lighten(p, 0.7);
  const pFixed = lighten(p, 0.75);
  const pFixedDim = lighten(p, 0.5);
  const pOnFixed = darken(p, 0.8);
  const pOnFixedVar = darken(p, 0.3);

  const sLight = lighten(s, 0.65);
  const sContainer = lighten(s, 0.7);
  const sOnContainer = darken(s, 0.3);
  const sFixed = lighten(s, 0.7);
  const sFixedDim = lighten(s, 0.4);
  const sOnFixed = darken(s, 0.8);
  const sOnFixedVar = darken(s, 0.3);

  const bg = isDark ? '#121212' : '#f7f9fb';
  const surface = isDark ? '#1e1e1e' : '#ffffff';
  const onSurface = isDark ? '#e0e0e0' : '#191c1e';
  const onSurfaceVar = isDark ? '#a0a0a0' : '#424750';
  const outlineV = isDark ? '#404040' : '#c3c6d1';

  return `
    :root {
      --theme-primary: ${p};
      --theme-primary-container: ${pContainer};
      --theme-on-primary: #ffffff;
      --theme-on-primary-container: ${pOnContainer};
      --theme-primary-fixed: ${pFixed};
      --theme-primary-fixed-dim: ${pFixedDim};
      --theme-on-primary-fixed: ${pOnFixed};
      --theme-on-primary-fixed-variant: ${pOnFixedVar};
      --theme-primary-rgb: ${hexToRgb(p)};

      --theme-secondary: ${s};
      --theme-secondary-container: ${sContainer};
      --theme-on-secondary: #ffffff;
      --theme-on-secondary-container: ${sOnContainer};
      --theme-secondary-fixed: ${sFixed};
      --theme-secondary-fixed-dim: ${sFixedDim};
      --theme-on-secondary-fixed: ${sOnFixed};
      --theme-on-secondary-fixed-variant: ${sOnFixedVar};

      --theme-background: ${bg};
      --theme-on-background: ${onSurface};
      --theme-surface: ${surface};
      --theme-on-surface: ${onSurface};
      --theme-on-surface-variant: ${onSurfaceVar};
      --theme-outline-variant: ${outlineV};
    }

    .bg-primary { background-color: ${p} !important; }
    .text-primary { color: ${p} !important; }
    .border-primary { border-color: ${p} !important; }
    .ring-primary { --tw-ring-color: ${p} !important; }
    .bg-primary\\/5 { background-color: rgba(${hexToRgb(p)}, 0.05) !important; }
    .bg-primary\\/20 { background-color: rgba(${hexToRgb(p)}, 0.2) !important; }
    .shadow-primary\\/20 { --tw-shadow-color: rgba(${hexToRgb(p)}, 0.2) !important; }

    .bg-primary-container { background-color: ${pContainer} !important; }
    .text-primary-container { color: ${pContainer} !important; }
    .border-primary-container { border-color: ${pContainer} !important; }

    .text-on-primary { color: #ffffff !important; }
    .text-on-primary-container { color: ${pOnContainer} !important; }
    .bg-on-primary-container { background-color: ${pOnContainer} !important; }

    .bg-primary-fixed { background-color: ${pFixed} !important; }
    .text-primary-fixed { color: ${pFixed} !important; }
    .text-on-primary-fixed { color: ${pOnFixed} !important; }

    .bg-secondary { background-color: ${s} !important; }
    .text-secondary { color: ${s} !important; }
    .border-secondary { border-color: ${s} !important; }

    .bg-secondary-container { background-color: ${sContainer} !important; }
    .text-secondary-container { color: ${sContainer} !important; }
    .text-on-secondary-container { color: ${sOnContainer} !important; }

    .bg-secondary-fixed { background-color: ${sFixed} !important; }
    .bg-secondary-fixed-dim { background-color: ${sFixedDim} !important; }
    .text-secondary-fixed { color: ${sFixed} !important; }

    .bg-background { background-color: ${bg} !important; }
    .text-background { color: ${bg} !important; }
    .bg-on-background { background-color: ${onSurface} !important; }
    .text-on-background { color: ${onSurface} !important; }

    .bg-surface { background-color: ${surface} !important; }
    .text-surface { color: ${surface} !important; }
    .text-on-surface { color: ${onSurface} !important; }

    .bg-surface-container-lowest { background-color: ${surface} !important; }
    .bg-surface-container-low { background-color: ${isDark ? '#2a2a2a' : '#f2f4f6'} !important; }
    .bg-surface-container { background-color: ${isDark ? '#333' : '#eceef0'} !important; }
    .bg-surface-container-high { background-color: ${isDark ? '#3a3a3a' : '#e6e8ea'} !important; }
    .bg-surface-container-highest { background-color: ${isDark ? '#444' : '#e0e3e5'} !important; }
    .bg-surface-dim { background-color: ${isDark ? '#1a1a1a' : '#d8dadc'} !important; }
    .bg-surface-bright { background-color: ${isDark ? '#333' : '#f7f9fb'} !important; }
    .bg-surface-variant { background-color: ${isDark ? '#3a3a3a' : '#e0e3e5'} !important; }
    .text-surface-variant { color: ${isDark ? '#4a4a4a' : '#e0e3e5'} !important; }

    .text-on-surface-variant { color: ${onSurfaceVar} !important; }
    .border-outline-variant { border-color: ${outlineV} !important; }

    .sidebar-link.active { background-color: ${sContainer} !important; color: ${p} !important; }

    body { background-color: ${bg} !important; color: ${onSurface} !important; }

    .card, .bg-surface-container-lowest { background-color: ${surface} !important; }

    .hover\\:bg-surface-container-low:hover { background-color: ${isDark ? '#2a2a2a' : '#f2f4f6'} !important; }
    .hover\\:bg-surface-container:hover { background-color: ${isDark ? '#333' : '#eceef0'} !important; }
    .hover\\:border-primary:hover { border-color: ${p} !important; }
    .hover\\:brightness-110:hover { filter: brightness(1.1) !important; }

    .form-input:focus { border-color: ${p} !important; box-shadow: 0 0 0 2px rgba(${hexToRgb(p)}, 0.15) !important; }

    .toggle.active { background-color: ${p} !important; }

    .data-table thead { background-color: ${isDark ? '#2a2a2a' : '#f2f4f6'} !important; }

    .btn-primary { background-color: ${p} !important; color: #ffffff !important; }
    .btn-outline { color: ${p} !important; border-color: ${p} !important; }
    .btn-secondary { background-color: ${s} !important; color: #ffffff !important; }

    .badge-secondary { background-color: ${sContainer} !important; color: ${sOnContainer} !important; }
    .badge-primary { background-color: ${pContainer} !important; color: ${pOnContainer} !important; }

    .tab-btn.active { color: ${p} !important; border-bottom-color: ${p} !important; }

    .modal-content { background-color: ${surface} !important; }

    input, select, textarea { color: ${onSurface} !important; }
  `;
}

document.addEventListener('DOMContentLoaded', () => App.init());
