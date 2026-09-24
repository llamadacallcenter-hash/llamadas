document.addEventListener('DOMContentLoaded', () => {
  const GOOGLE_SHEETS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzg2L7nJKFe4UTiz-lfqZVGJ378nNefj8B10yGFXPWhq_txlZyRyPYmCUEnLfKQs9Ap/exec';

  const dashboardData = {
    total: 0,
    atendidas: 0,
    noContestadas: 0,
    justificadas: 0,
    noJustificadas: 0,
    recuperadas: 0
  };

  let calls = [];
  let advisors = [];
  let selectedCall = null;
  const recordFilters = {
    month: '',
    dateFrom: '',
    dateTo: '',
    status: 'Todos'
  };
  const dashboardFilters = {
    month: '',
    dateFrom: '',
    dateTo: '',
    store: 'Todos',
    advisor: 'Todos'
  };
  const recordsPageSize = 6;
  let recordsPage = 1;

  const numberFormat = (value) => new Intl.NumberFormat('es-ES').format(value);
  const resolveCallTime = (call) => {
    if (!call) return '-';
    const candidates = [call.hora, call.fecha, call.datetime, call.horaRegistro];
    for (const candidate of candidates) {
      const formatted = formatCallTime(candidate);
      if (formatted !== '-') return formatted;
    }
    return '-';
  };
  const getLocalDateValue = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const getLocalTimeValue = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };
  const normalizeDateForFilter = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const datePart = raw.split(/[ T]/)[0];
    const dayFirstMatch = datePart.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (dayFirstMatch) {
      const [, day, month, year] = dayFirstMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    const isoMatch = datePart.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return '';
  };
  const toMonthKey = (dateValue) => {
    const normalized = normalizeDateForFilter(dateValue);
    return normalized ? normalized.slice(0, 7) : '';
  };
  const matchesDateRange = (dateValue, fromValue, toValue) => {
    const normalized = normalizeDateForFilter(dateValue);
    if (!normalized) return true;
    if (fromValue && normalized < fromValue) return false;
    if (toValue && normalized > toValue) return false;
    return true;
  };
  const getDashboardCalls = () => calls.filter((call) => {
    const matchesMonth = !dashboardFilters.month || toMonthKey(call.fecha) === dashboardFilters.month;
    const matchesDateFrom = matchesDateRange(call.fecha, dashboardFilters.dateFrom, '');
    const matchesDateTo = matchesDateRange(call.fecha, '', dashboardFilters.dateTo);
    const matchesStore = dashboardFilters.store === 'Todos' || call.tienda === dashboardFilters.store;
    const matchesAdvisor = dashboardFilters.advisor === 'Todos' || call.asesor === dashboardFilters.advisor;
    return matchesMonth && matchesDateFrom && matchesDateTo && matchesStore && matchesAdvisor;
  });
  const updateCurrentDateTime = () => {
    const pill = document.querySelector('#date-time-pill');
    if (!pill) return;
    const now = new Date();
    const date = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(now);
    const time = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
    pill.textContent = `${date} • ${time}`;
  };
  const formatCallTime = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '-';
    const match = raw.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!match) return '-';
    const hours = String(match[1]).padStart(2, '0');
    const minutes = String(match[2]).padStart(2, '0');
    return `${hours}:${minutes}`;
  };
  const formatDuration = (value) => {
    const rawValue = String(value || '').trim();
    if (!rawValue) return '-';
    const dateTimeMatch = rawValue.match(/\b(\d{2}):(\d{2}):(\d{2})\b/);
    if (rawValue.includes('GMT') && dateTimeMatch) {
      return `${dateTimeMatch[1]}:${dateTimeMatch[2]}`;
    }
    const match = rawValue.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return '-';
    const [, hours, minutes, seconds] = match;
    if (seconds !== undefined) {
      if (Number(hours) === 0) return `${minutes}:${seconds}`;
      return `${hours}:${minutes}`;
    }
    return `${hours}:${minutes}`;
  };

  function renderDashboard() {
    const totalValue = document.querySelector('[data-value="total"]');
    const atendidasValue = document.querySelector('[data-value="atendidas"]');
    const noContestadasValue = document.querySelector('[data-value="noContestadas"]');
    const justificadasValue = document.querySelector('[data-value="justificadas"]');
    const noJustificadasValue = document.querySelector('[data-value="noJustificadas"]');
    const recuperadasValue = document.querySelector('[data-value="recuperadas"]');

    const totalTrend = document.querySelector('[data-trend="total"]');
    const atendidasTrend = document.querySelector('[data-trend="atendidas"]');
    const noContestadasTrend = document.querySelector('[data-trend="noContestadas"]');
    const justificadasTrend = document.querySelector('[data-trend="justificadas"]');
    const noJustificadasTrend = document.querySelector('[data-trend="noJustificadas"]');
    const recuperadasTrend = document.querySelector('[data-trend="recuperadas"]');

    const atendidasBar = document.querySelector('[data-bar="atendidas"]');
    const noContestadasBar = document.querySelector('[data-bar="noContestadas"]');
    const justificadasBar = document.querySelector('[data-bar="justificadas"]');
    const noJustificadasBar = document.querySelector('[data-bar="noJustificadas"]');
    const recuperadasBar = document.querySelector('[data-bar="recuperadas"]');
    const mainDonut = document.querySelector('.donut-main');
    const justificationDonut = document.querySelector('.donut-justification');
    const chartsRow = document.querySelector('.charts-row');

    totalValue.textContent = numberFormat(dashboardData.total);
    atendidasValue.textContent = numberFormat(dashboardData.atendidas);
    noContestadasValue.textContent = numberFormat(dashboardData.noContestadas);
    justificadasValue.textContent = numberFormat(dashboardData.justificadas);
    noJustificadasValue.textContent = numberFormat(dashboardData.noJustificadas);
    recuperadasValue.textContent = numberFormat(dashboardData.recuperadas);

    totalTrend.textContent = 'Datos reales';
    atendidasTrend.textContent = dashboardData.total ? `${Math.round((dashboardData.atendidas / dashboardData.total) * 100)}%` : '0%';
    noContestadasTrend.textContent = dashboardData.total ? `${Math.round((dashboardData.noContestadas / dashboardData.total) * 100)}%` : '0%';
    justificadasTrend.textContent = dashboardData.noContestadas ? `${Math.round((dashboardData.justificadas / dashboardData.noContestadas) * 100)}%` : '0%';
    noJustificadasTrend.textContent = dashboardData.noContestadas ? `${Math.round((dashboardData.noJustificadas / dashboardData.noContestadas) * 100)}%` : '0%';
    recuperadasTrend.textContent = dashboardData.total ? `${Math.round((dashboardData.recuperadas / dashboardData.total) * 100)}%` : '0%';

    atendidasBar.style.width = `${dashboardData.total ? Math.round((dashboardData.atendidas / dashboardData.total) * 100) : 0}%`;
    noContestadasBar.style.width = `${dashboardData.total ? Math.round((dashboardData.noContestadas / dashboardData.total) * 100) : 0}%`;
    justificadasBar.style.width = `${dashboardData.noContestadas ? Math.round((dashboardData.justificadas / dashboardData.noContestadas) * 100) : 0}%`;
    noJustificadasBar.style.width = `${dashboardData.noContestadas ? Math.round((dashboardData.noJustificadas / dashboardData.noContestadas) * 100) : 0}%`;
    recuperadasBar.style.width = `${dashboardData.total ? Math.round((dashboardData.recuperadas / dashboardData.total) * 100) : 0}%`;
    const attendedRate = dashboardData.total ? Math.round((dashboardData.atendidas / dashboardData.total) * 100) : 0;
    const unansweredRate = dashboardData.total ? Math.round((dashboardData.noContestadas / dashboardData.total) * 100) : 0;
    const justifiedRate = dashboardData.noContestadas ? Math.round((dashboardData.justificadas / dashboardData.noContestadas) * 100) : 0;
    const unjustifiedRate = dashboardData.noContestadas ? Math.round((dashboardData.noJustificadas / dashboardData.noContestadas) * 100) : 0;
    const recoveredRate = dashboardData.total ? Math.round((dashboardData.recuperadas / dashboardData.total) * 100) : 0;
    document.querySelector('[data-donut-total="true"]').textContent = numberFormat(dashboardData.total);
    document.querySelector('[data-donut-no-contestadas="true"]').textContent = numberFormat(dashboardData.noContestadas);
    document.querySelector('[data-rate="atendidas"]').textContent = `${attendedRate}%`;
    document.querySelector('[data-rate="noContestadas"]').textContent = `${unansweredRate}%`;
    document.querySelector('[data-rate="justificadas"]').textContent = `${justifiedRate}%`;
    document.querySelector('[data-rate="noJustificadas"]').textContent = `${unjustifiedRate}%`;
    document.querySelector('[data-rate="recuperadas"]').textContent = `${recoveredRate}%`;
    mainDonut.classList.toggle('empty', dashboardData.total === 0);
    justificationDonut.classList.toggle('empty', dashboardData.noContestadas === 0);
    chartsRow.classList.toggle('empty', dashboardData.total === 0);
    if (dashboardData.total > 0) {
      const chartTotal = dashboardData.atendidas + dashboardData.noContestadas + dashboardData.recuperadas;
      const attendedEnd = Math.round((dashboardData.atendidas / chartTotal) * 100);
      const unansweredEnd = attendedEnd + Math.round((dashboardData.noContestadas / chartTotal) * 100);
      const recoveredEnd = unansweredEnd + Math.round((dashboardData.recuperadas / chartTotal) * 100);
      mainDonut.style.background = `conic-gradient(var(--green) 0 ${attendedEnd}%, var(--red) ${attendedEnd}% ${unansweredEnd}%, var(--yellow) ${unansweredEnd}% ${Math.min(recoveredEnd, 100)}%, #e8e4e2 ${Math.min(recoveredEnd, 100)}% 100%)`;
    } else {
      mainDonut.style.background = '';
    }
    if (dashboardData.noContestadas > 0) {
      justificationDonut.style.background = `conic-gradient(var(--blue) 0 ${justifiedRate}%, var(--orange) ${justifiedRate}% 100%)`;
    } else {
      justificationDonut.style.background = '';
    }
  }

  function getFilteredCalls() {
    return calls.filter((call) => {
      const matchesMonth = !recordFilters.month || toMonthKey(call.fecha) === recordFilters.month;
      const matchesDateFrom = matchesDateRange(call.fecha, recordFilters.dateFrom, '');
      const matchesDateTo = matchesDateRange(call.fecha, '', recordFilters.dateTo);
      const matchesStatus = recordFilters.status === 'Todos' || call.estado === recordFilters.status || call.estadoSecundario === recordFilters.status;
      return matchesMonth && matchesDateFrom && matchesDateTo && matchesStatus;
    }).slice().reverse();
  }

  function renderRecords() {
    const rows = getFilteredCalls();
    const dashboardRows = getDashboardCalls().slice().reverse();
    const recentBody = document.querySelector('#recent-calls-body');
    const recordsList = document.querySelector('#records-list');
    const pagination = document.querySelector('#records-pagination');
    const pageIndicator = document.querySelector('#records-page-indicator');
    const previousPageButton = document.querySelector('#records-prev-page');
    const nextPageButton = document.querySelector('#records-next-page');
    const totalPages = Math.max(1, Math.ceil(rows.length / recordsPageSize));
    recordsPage = Math.min(recordsPage, totalPages);
    const pageStart = (recordsPage - 1) * recordsPageSize;
    const pageRows = rows.slice(pageStart, pageStart + recordsPageSize);
    const rowHtml = dashboardRows.slice(0, 10).map((call) => `<tr>
      <td>${call.fecha}</td><td>${call.telefono}</td><td>${call.cliente}</td>
      <td>${call.asesor}</td><td>${call.tienda}</td><td>${call.motivo}</td>
      <td>${call.estado}${call.estadoSecundario ? ` + ${call.estadoSecundario}` : ''}</td><td>—</td><td class="actions">●</td>
    </tr>`).join('');
    recentBody.innerHTML = rowHtml || '<tr><td colspan="9">Aún no hay llamadas registradas.</td></tr>';
    recordsList.innerHTML = pageRows.map((call) => `<article class="record-card" data-call-index="${calls.findIndex((item) => item === call)}"><div><span>Fecha y hora</span><strong>${(call.fecha || '-').split(' ')[0]} ${resolveCallTime(call)}</strong></div><div><span>Duración</span><strong>${formatDuration(call.duracion)}</strong></div><div><span>Número</span><strong>${call.telefono || '-'}</strong></div><div><span>Estado</span><strong>${call.estado || '-'}${call.estadoSecundario ? ` + ${call.estadoSecundario}` : ''}</strong></div><div><span>Ver detalle</span><strong>→</strong></div></article>`).join('') || '<p class="empty-message">Aún no hay registros.</p>';
    pagination.hidden = rows.length <= recordsPageSize;
    pageIndicator.textContent = `Página ${recordsPage} de ${totalPages}`;
    previousPageButton.disabled = recordsPage === 1;
    nextPageButton.disabled = recordsPage === totalPages;
    document.querySelector('[data-record-today="true"]').textContent = numberFormat(rows.length);
    document.querySelector('[data-record-total="true"]').textContent = numberFormat(rows.length);
    document.querySelector('[data-record-average="true"]').textContent = numberFormat(rows.length);
  }

  function renderReports() {
    const now = new Date();
    const filteredCalls = getDashboardCalls();
    const currentMonth = dashboardFilters.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6);
    const monthlyCalls = filteredCalls.filter((call) => {
      const normalizedDate = normalizeDateForFilter(call.fecha);
      return normalizedDate && (dashboardFilters.month ? normalizedDate.startsWith(dashboardFilters.month) : normalizedDate.startsWith(currentMonth));
    });
    const weeklyCalls = filteredCalls.filter((call) => {
      const normalizedDate = normalizeDateForFilter(call.fecha);
      if (!normalizedDate) return false;
      const callDate = new Date(`${normalizedDate}T00:00:00`);
      return callDate >= weekStart && callDate <= today;
    });
    const monthlyAttended = monthlyCalls.filter((call) => call.estado === 'Atendida' || call.estadoSecundario === 'Atendida').length;
    const monthlyEfficiency = monthlyCalls.length ? Math.round((monthlyAttended / monthlyCalls.length) * 100) : 0;
    document.querySelector('[data-report-monthly-efficiency="true"]').textContent = `${monthlyEfficiency}%`;
    document.querySelector('[data-report-weekly-total="true"]').textContent = numberFormat(weeklyCalls.length);
  }

  function showCallDetail(call) {
    selectedCall = call;
    const detail = document.querySelector('#call-detail');
    const secondaryStatusField = document.querySelector('.detail-secondary-status');
    const fields = {
      '#detail-date': (call.fecha || '').split(' ')[0],
      '#detail-time': resolveCallTime(call),
      '#detail-duration': formatDuration(call.duracion),
      '#detail-phone': call.telefono,
      '#detail-status': call.estado,
      '#detail-justification': call.justificatorio || 'Sin justificatorio'
    };
    Object.entries(fields).forEach(([selector, value]) => {
      document.querySelector(selector).textContent = value || '-';
    });
    secondaryStatusField.classList.toggle('hidden', !call.estadoSecundario);
    document.querySelector('#detail-secondary-status').textContent = call.estadoSecundario || '';
    const advisorSelect = document.querySelector('#detail-advisor');
    advisorSelect.innerHTML = '<option value="">Seleccionar asesor</option>' + advisors.map((advisor) => `<option value="${advisor.nombre}">${advisor.nombre}</option>`).join('');
    advisorSelect.value = call.asesor || '';

    const storeOptions = ['Santa Clara', 'Chaclacayo', 'Surco'];
    const storeSelect = document.querySelector('#detail-store');
    storeSelect.innerHTML = '<option value="">No registrada</option>' + storeOptions.map((store) => `<option value="${store}">${store}</option>`).join('');
    storeSelect.value = call.tienda || '';
    detail.classList.remove('hidden');
  }

  function renderJustifications() {
    const justifiedCalls = getDashboardCalls().filter((call) => call.estado === 'Justificada' || call.estadoSecundario === 'Justificada');
    const recoveryCalls = getDashboardCalls().filter((call) => call.estado === 'Recuperación de llamadas' || call.estadoSecundario === 'Recuperación de llamadas');
    const recoveryChart = document.querySelector('#recovery-chart');
    const recoveryTotal = document.querySelector('#recovery-total');
    const recoveryCustomerCalledRate = document.querySelector('#recovery-customer-called-rate');
    const recoveryWeContactedRate = document.querySelector('#recovery-we-contacted-rate');
    const justificationPageChart = document.querySelector('#justification-page-chart');
    const justificationPageTotal = document.querySelector('#justification-page-total');
    const justificationReasonEls = {
      'Alta demanda': document.querySelector('#justification-altademanda'),
      'Llamada colgada': document.querySelector('#justification-colgada'),
      'Falla del sistema': document.querySelector('#justification-falla'),
      'Fuera de horario': document.querySelector('#justification-fuera'),
      Otros: document.querySelector('#justification-otros')
    };

    const recoveryTotals = {
      'Cliente llamó': 0,
      'Nos contactamos': 0
    };

    recoveryCalls.forEach((call) => {
      const label = String(call.resultadoRecuperacion || call.tipoRecuperacion || '').trim();
      if (label === 'Cliente llamó') recoveryTotals['Cliente llamó'] += 1;
      if (label === 'Nos contactamos') recoveryTotals['Nos contactamos'] += 1;
    });

    const reasonNames = ['Alta demanda', 'Llamada colgada', 'Falla del sistema', 'Fuera de horario', 'Otros'];
    const reasonCounts = Object.fromEntries(reasonNames.map((name) => [name, 0]));

    justifiedCalls.forEach((call) => {
      const normalized = String(call.justificatorio || '').trim();
      if (!normalized) return;
      const lower = normalized.toLowerCase();
      let reason = null;
      if (lower.includes('alta demanda')) reason = 'Alta demanda';
      else if (lower.includes('llamada colgada') || lower.includes('llamada simultánea')) reason = 'Llamada colgada';
      else if (lower.includes('falla del sistema')) reason = 'Falla del sistema';
      else if (lower.includes('fuera de horario')) reason = 'Fuera de horario';
      else if (lower.includes('otro')) reason = 'Otros';
      if (reason) reasonCounts[reason] += 1;
    });

    const totalReasons = Object.values(reasonCounts).reduce((sum, count) => sum + count, 0);
    const orderedReasonNames = Object.keys(reasonCounts);
    const chartSegments = [];
    let cumulative = 0;

    orderedReasonNames.forEach((name) => {
      const count = reasonCounts[name];
      if (!count) return;
      const start = cumulative;
      const end = cumulative + (count / totalReasons) * 100;
      cumulative = end;
      chartSegments.push(`${name === 'Alta demanda' ? 'var(--blue)' : name === 'Llamada colgada' ? 'var(--green)' : name === 'Falla del sistema' ? 'var(--yellow)' : name === 'Fuera de horario' ? 'var(--orange)' : 'var(--gray)'} ${start}% ${end}%`);
      if (justificationReasonEls[name]) {
        const percentage = totalReasons ? Math.round((count / totalReasons) * 100) : 0;
        justificationReasonEls[name].textContent = `${percentage}%`;
      }
    });

    const totalRecovery = recoveryCalls.length;
    const customerCalled = recoveryTotals['Cliente llamó'];
    const weContacted = recoveryTotals['Nos contactamos'];
    const customerPct = totalRecovery ? Math.round((customerCalled / totalRecovery) * 100) : 0;
    const contactPct = totalRecovery ? Math.round((weContacted / totalRecovery) * 100) : 0;

    recoveryTotal.textContent = totalRecovery;
    recoveryCustomerCalledRate.textContent = `${customerPct}%`;
    recoveryWeContactedRate.textContent = `${contactPct}%`;

    if (totalRecovery > 0) {
      const end = customerPct;
      recoveryChart.style.background = `conic-gradient(var(--green) 0 ${end}%, var(--orange) ${end}% 100%)`;
      recoveryChart.classList.remove('empty');
    } else {
      recoveryChart.style.background = '';
      recoveryChart.classList.add('empty');
    }

    justificationPageTotal.textContent = totalReasons;
    if (totalReasons > 0) {
      justificationPageChart.style.background = `conic-gradient(${chartSegments.join(', ')})`;
      justificationPageChart.classList.remove('empty');
    } else {
      justificationPageChart.style.background = '';
      justificationPageChart.classList.add('empty');
    }

    document.querySelector('[data-justification-approved="true"]').textContent = justifiedCalls.length;
    document.querySelector('[data-justification-pending="true"]').textContent = 0;
    document.querySelector('[data-justification-rejected="true"]').textContent = 0;
  }

  function renderReasonBreakdown() {
    const rows = Array.from(document.querySelectorAll('.stack-row'));
    const reasonNames = ['Alta demanda', 'Llamada colgada', 'Falla del sistema', 'Fuera de horario', 'Otros'];
    const counts = Object.fromEntries(reasonNames.map((name) => [name, 0]));

    getDashboardCalls().forEach((call) => {
      const normalized = String(call.justificatorio || '').trim();
      if (!normalized) return;

      const lower = normalized.toLowerCase();
      let reason = null;
      if (lower.includes('alta demanda')) reason = 'Alta demanda';
      else if (lower.includes('llamada colgada') || lower.includes('llamada simultánea')) reason = 'Llamada colgada';
      else if (lower.includes('falla del sistema')) reason = 'Falla del sistema';
      else if (lower.includes('fuera de horario')) reason = 'Fuera de horario';
      else if (lower.includes('otro')) reason = 'Otros';

      if (reason) {
        counts[reason] += 1;
      }
    });

    rows.forEach((row) => {
      const label = row.querySelector('span')?.textContent?.trim();
      const strong = row.querySelector('strong');
      const fill = row.querySelector('.stack-rail span');
      const total = counts[label] || 0;
      const maxTotal = Math.max(1, ...Object.values(counts));
      const width = total === 0 ? 0 : Math.max(8, (total / maxTotal) * 100);

      strong.textContent = String(total);
      if (fill) {
        fill.style.width = `${width}%`;
      }
    });
  }

  function updateDashboardData() {
    const dashboardCalls = getDashboardCalls();
    const hasStatus = (call, status) => call.estado === status || call.estadoSecundario === status;
    dashboardData.total = dashboardCalls.length;
    dashboardData.atendidas = dashboardCalls.filter((call) => hasStatus(call, 'Atendida')).length;
    dashboardData.noContestadas = dashboardCalls.filter((call) => hasStatus(call, 'No contestada')).length;
    dashboardData.justificadas = dashboardCalls.filter((call) => hasStatus(call, 'Justificada')).length;
    dashboardData.noJustificadas = Math.max(0, dashboardData.noContestadas - dashboardData.justificadas);
    dashboardData.recuperadas = dashboardCalls.filter((call) => hasStatus(call, 'Recuperación de llamadas')).length;
    renderDashboard();
    renderRecords();
    renderReports();
    renderJustifications();
    renderReasonBreakdown();
  }

  async function loadCalls() {
    const response = await fetch(GOOGLE_SHEETS_ENDPOINT);
    const rawData = await response.json();
    const rows = Array.isArray(rawData)
      ? rawData
      : Array.isArray(rawData.value)
        ? rawData.value
        : [];

    calls = rows.filter((call) => call && (call.cliente || call.telefono || call.asesor || call.tienda || call.motivo || call.estado));
    renderDashboardFilters();
    updateDashboardData();
    renderAdvisorChart();
  }

  function renderMonthFilters() {
    const monthValues = [...new Set(calls.map((call) => toMonthKey(call.fecha)).filter(Boolean))].sort().reverse();
    const optionMarkup = monthValues.map((monthKey) => {
      const date = new Date(`${monthKey}-01T00:00:00`);
      const label = date.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
      return `<option value="${monthKey}">${label}</option>`;
    }).join('');

    const dashboardMonthFilter = document.querySelector('#dashboard-month-filter');
    if (dashboardMonthFilter) {
      dashboardMonthFilter.innerHTML = '<option value="">Todos los meses</option>' + optionMarkup;
      dashboardMonthFilter.value = dashboardFilters.month;
    }

    const recordsMonthFilter = document.querySelector('#records-month-filter');
    if (recordsMonthFilter) {
      recordsMonthFilter.innerHTML = '<option value="">Todos</option>' + optionMarkup;
      recordsMonthFilter.value = recordFilters.month;
    }
  }

  function renderDashboardFilters() {
    const storeFilter = document.querySelector('#dashboard-store-filter');
    const advisorFilter = document.querySelector('#dashboard-advisor-filter');
    if (!storeFilter || !advisorFilter) return;
    const configuredStores = ['Santa Clara', 'Chaclacayo', 'Surco'];
    const dataStores = calls.map((call) => String(call.tienda || '').trim()).filter(Boolean);
    const stores = [...new Set([...configuredStores, ...dataStores])].sort();
    const callAdvisors = calls.map((call) => String(call.asesor || '').trim()).filter(Boolean);
    const advisorNames = [...new Set([...advisors.map((advisor) => advisor.nombre), ...callAdvisors])].sort();
    storeFilter.innerHTML = '<option value="Todos">Todas las tiendas</option>' + stores.map((store) => `<option value="${store}">${store}</option>`).join('');
    advisorFilter.innerHTML = '<option value="Todos">Todos los asesores</option>' + advisorNames.map((advisor) => `<option value="${advisor}">${advisor}</option>`).join('');
    storeFilter.value = dashboardFilters.store;
    advisorFilter.value = dashboardFilters.advisor;
    renderMonthFilters();
  }

  function renderAdvisors() {
    const list = document.querySelector('#assessor-list');
    list.innerHTML = advisors.map((advisor) => `<div class="assessor-item"><div><strong>${advisor.nombre}</strong><small>Atendidas: 0%</small></div><span class="score green">0</span></div>`).join('') || '<p class="empty-message">Aún no hay asesores registrados.</p>';
    renderDashboardFilters();
    renderAdvisorChart();
  }

  function renderAdvisorChart() {
    const chart = document.querySelector('#advisor-chart-bars');
    const counts = advisors.map((advisor) => ({
      nombre: advisor.nombre,
      total: getDashboardCalls().filter((call) => call.asesor === advisor.nombre && call.estado === 'No contestada').length
    }));
    const maximum = Math.max(...counts.map((item) => item.total), 1);
    chart.innerHTML = counts.map((item) => `<div class="bar-group"><span class="bar orange" style="height: ${Math.round((item.total / maximum) * 100)}%"></span><label>${item.nombre}</label></div>`).join('');
  }

  async function loadAdvisors() {
    const response = await fetch(`${GOOGLE_SHEETS_ENDPOINT}?tipo=asesores`);
    const data = await response.json();
    advisors = Array.isArray(data) ? data.filter((advisor) => advisor && advisor.nombre) : [];
    renderAdvisors();
  }

  const cards = document.querySelectorAll('.stat-card');
  cards.forEach((card, index) => {
    card.style.animationDelay = `${index * 60}ms`;
    card.style.animation = 'floatCard 0.5s ease both';
  });

  const navItems = document.querySelectorAll('.nav-item');
  const panels = document.querySelectorAll('.view-panel');
  const callDetail = document.querySelector('#call-detail');

  document.querySelector('#records-list').addEventListener('click', (event) => {
    const card = event.target.closest('.record-card[data-call-index]');
    if (card) {
      const index = Number(card.dataset.callIndex);
      const selected = calls[index];
      if (selected) {
        showCallDetail(selected);
      }
    }
  });

  const recordsDateFromFilter = document.querySelector('#records-date-from-filter');
  const recordsDateToFilter = document.querySelector('#records-date-to-filter');
  const recordsMonthFilter = document.querySelector('#records-month-filter');
  const recordsStatusFilter = document.querySelector('#records-status-filter');
  const clearRecordsFiltersButton = document.querySelector('#clear-records-filters');
  const clearDashboardFiltersButton = document.querySelector('#clear-dashboard-filters');
  const dashboardStoreFilter = document.querySelector('#dashboard-store-filter');
  const dashboardAdvisorFilter = document.querySelector('#dashboard-advisor-filter');
  const dashboardMonthFilter = document.querySelector('#dashboard-month-filter');
  const dashboardDateFromFilter = document.querySelector('#dashboard-date-from-filter');
  const dashboardDateToFilter = document.querySelector('#dashboard-date-to-filter');
  const previousRecordsPageButton = document.querySelector('#records-prev-page');
  const nextRecordsPageButton = document.querySelector('#records-next-page');

  const refreshDashboardFilters = () => {
    updateDashboardData();
    renderAdvisorChart();
  };

  dashboardStoreFilter.addEventListener('change', (event) => {
    dashboardFilters.store = event.target.value;
    refreshDashboardFilters();
  });

  dashboardAdvisorFilter.addEventListener('change', (event) => {
    dashboardFilters.advisor = event.target.value;
    refreshDashboardFilters();
  });

  dashboardMonthFilter.addEventListener('change', (event) => {
    dashboardFilters.month = event.target.value;
    refreshDashboardFilters();
  });

  dashboardDateFromFilter.addEventListener('change', (event) => {
    dashboardFilters.dateFrom = event.target.value;
    refreshDashboardFilters();
  });

  dashboardDateToFilter.addEventListener('change', (event) => {
    dashboardFilters.dateTo = event.target.value;
    refreshDashboardFilters();
  });

  recordsDateFromFilter.addEventListener('change', (event) => {
    recordFilters.dateFrom = event.target.value;
    recordsPage = 1;
    renderRecords();
  });

  recordsDateToFilter.addEventListener('change', (event) => {
    recordFilters.dateTo = event.target.value;
    recordsPage = 1;
    renderRecords();
  });

  recordsMonthFilter.addEventListener('change', (event) => {
    recordFilters.month = event.target.value;
    recordsPage = 1;
    renderRecords();
  });

  recordsStatusFilter.addEventListener('change', (event) => {
    recordFilters.status = event.target.value;
    recordsPage = 1;
    renderRecords();
  });

  clearRecordsFiltersButton.addEventListener('click', () => {
    recordFilters.month = '';
    recordFilters.dateFrom = '';
    recordFilters.dateTo = '';
    recordFilters.status = 'Todos';
    recordsPage = 1;
    recordsMonthFilter.value = '';
    recordsDateFromFilter.value = '';
    recordsDateToFilter.value = '';
    recordsStatusFilter.value = 'Todos';
    renderRecords();
  });

  clearDashboardFiltersButton.addEventListener('click', () => {
    dashboardFilters.month = '';
    dashboardFilters.dateFrom = '';
    dashboardFilters.dateTo = '';
    dashboardFilters.store = 'Todos';
    dashboardFilters.advisor = 'Todos';
    dashboardMonthFilter.value = '';
    dashboardDateFromFilter.value = '';
    dashboardDateToFilter.value = '';
    dashboardStoreFilter.value = 'Todos';
    dashboardAdvisorFilter.value = 'Todos';
    refreshDashboardFilters();
  });

  previousRecordsPageButton.addEventListener('click', () => {
    recordsPage = Math.max(1, recordsPage - 1);
    renderRecords();
  });

  nextRecordsPageButton.addEventListener('click', () => {
    recordsPage += 1;
    renderRecords();
  });

  document.querySelector('#close-call-detail').addEventListener('click', () => {
    callDetail.classList.add('hidden');
  });

  document.querySelector('#detail-advisor').addEventListener('change', async (event) => {
    const advisor = event.target.value;
    const status = document.querySelector('#advisor-detail-status');
    if (!selectedCall || !advisor) {
      status.textContent = 'Selecciona un asesor.';
      status.className = 'form-status error';
      return;
    }
    const data = new URLSearchParams({ tipo: 'actualizar-asesor', fila: String(selectedCall.fila), asesor });
    status.textContent = 'Guardando...';
    status.className = 'form-status';
    await fetch(GOOGLE_SHEETS_ENDPOINT, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: data.toString() });
    selectedCall.asesor = advisor;
    status.textContent = 'Asesor actualizado.';
    status.className = 'form-status success';
    await loadCalls();
  });

  document.querySelector('#detail-store').addEventListener('change', async (event) => {
    const tienda = event.target.value;
    const status = document.querySelector('#advisor-detail-status');
    if (!selectedCall || !tienda) {
      status.textContent = 'Selecciona una tienda.';
      status.className = 'form-status error';
      return;
    }
    const data = new URLSearchParams({ tipo: 'actualizar-tienda', fila: String(selectedCall.fila), tienda });
    status.textContent = 'Guardando...';
    status.className = 'form-status';
    await fetch(GOOGLE_SHEETS_ENDPOINT, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: data.toString() });
    selectedCall.tienda = tienda;
    status.textContent = 'Tienda actualizada.';
    status.className = 'form-status success';
    await loadCalls();
  });

  navItems.forEach((button) => {
    button.addEventListener('click', () => {
      const tab = button.dataset.tab;

      navItems.forEach((item) => item.classList.toggle('active', item === button));
      panels.forEach((panel) => {
        panel.classList.toggle('active', panel.dataset.panel === tab);
      });
    });
  });

  const callForm = document.querySelector('#call-form');
  const formStatus = document.querySelector('#form-status');
  const callDateInput = callForm.querySelector('input[name="fecha"]');
  const callTimeInput = callForm.querySelector('input[name="hora"]');
  const durationInput = callForm.querySelector('input[name="duracion"]');
  const primaryStatus = callForm.querySelector('select[name="estado"]');
  let lastUsedDate = getLocalDateValue();
  const secondaryStatus = callForm.querySelector('select[name="estadoSecundario"]');
  const justificationField = callForm.querySelector('#justification-field');
  const justificationSelect = callForm.querySelector('select[name="justificacionTipo"]');
  const justificationInput = callForm.querySelector('textarea[name="justificatorio"]');
  const recoveryField = callForm.querySelector('#recovery-field');
  const recoverySelect = callForm.querySelector('select[name="resultadoRecuperacion"]');
  const assessorForm = document.querySelector('#assessor-form');
  const assessorStatus = document.querySelector('#assessor-status');

  function formatDurationInput(value) {
    const digitsOnly = String(value || '').replace(/\D/g, '').slice(0, 6);
    if (!digitsOnly) return '';

    if (digitsOnly.length <= 2) return digitsOnly;
    if (digitsOnly.length <= 4) return `${digitsOnly.slice(0, 2)}:${digitsOnly.slice(2)}`;
    return `${digitsOnly.slice(0, 2)}:${digitsOnly.slice(2, 4)}:${digitsOnly.slice(4)}`;
  }

  durationInput.addEventListener('input', (event) => {
    event.target.value = formatDurationInput(event.target.value);
  });

  callDateInput.value = lastUsedDate;
  callTimeInput.value = getLocalTimeValue();
  callDateInput.defaultValue = lastUsedDate;
  callTimeInput.defaultValue = getLocalTimeValue();
  updateCurrentDateTime();
  setInterval(updateCurrentDateTime, 30000);

  callForm.addEventListener('reset', () => {
    callDateInput.value = lastUsedDate;
    callTimeInput.value = getLocalTimeValue();
    callDateInput.defaultValue = lastUsedDate;
    callTimeInput.defaultValue = getLocalTimeValue();
    toggleJustificationField();
  });

  function toggleJustificationField() {
    const isJustified = primaryStatus.value === 'Justificada' || secondaryStatus.value === 'Justificada';
    const isRecovery = primaryStatus.value === 'Recuperación de llamadas' || secondaryStatus.value === 'Recuperación de llamadas';
    const isOther = justificationSelect.value === 'Otros';

    justificationField.classList.toggle('hidden', !isJustified);
    recoveryField.classList.toggle('hidden', !isRecovery);
    justificationSelect.required = isJustified;
    justificationInput.required = isJustified && isOther;
    justificationInput.classList.toggle('hidden', !isOther);
    recoverySelect.required = isRecovery;

    if (!isJustified) {
      justificationSelect.value = '';
      justificationInput.value = '';
    } else if (!isOther) {
      justificationInput.value = '';
    }

    if (!isRecovery) {
      recoverySelect.value = '';
    }
  }

  primaryStatus.addEventListener('change', toggleJustificationField);
  secondaryStatus.addEventListener('change', toggleJustificationField);
  justificationSelect.addEventListener('change', toggleJustificationField);
  toggleJustificationField();

  assessorForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = assessorForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    assessorStatus.textContent = 'Guardando asesor...';
    assessorStatus.className = 'form-status';

    try {
      const formData = new URLSearchParams(new FormData(assessorForm));
      await fetch(GOOGLE_SHEETS_ENDPOINT, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: formData.toString() });
      assessorStatus.textContent = 'Asesor registrado.';
      assessorStatus.className = 'form-status success';
      assessorForm.reset();
      await new Promise((resolve) => setTimeout(resolve, 700));
      await loadAdvisors();
    } catch (error) {
      assessorStatus.textContent = 'No se pudo registrar el asesor.';
      assessorStatus.className = 'form-status error';
    } finally {
      submitButton.disabled = false;
    }
  });

  callForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!GOOGLE_SHEETS_ENDPOINT) {
      formStatus.textContent = 'Configura primero la URL de Google Apps Script en script.js.';
      formStatus.className = 'form-status error';
      return;
    }

    const submitButton = callForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    formStatus.textContent = 'Guardando llamada...';
    formStatus.className = 'form-status';

    try {
      const formData = new URLSearchParams(new FormData(callForm));
      const justificatorioValor = justificationSelect.value === 'Otros'
        ? (justificationInput.value || '').trim()
        : (justificationSelect.value || '').trim();

      if (justificationSelect.value || justificationInput.value) {
        formData.set('justificatorio', justificatorioValor || (justificationInput.value || '').trim());
      }

      if (recoverySelect.value) {
        formData.set('resultadoRecuperacion', recoverySelect.value);
      }
      await fetch(GOOGLE_SHEETS_ENDPOINT, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: formData.toString()
      });

      formStatus.textContent = 'Llamada guardada en Google Sheets.';
      formStatus.className = 'form-status success';
      lastUsedDate = callDateInput.value || getLocalDateValue();
      callForm.reset();
      callDateInput.value = lastUsedDate;
      callTimeInput.value = getLocalTimeValue();
      callDateInput.defaultValue = lastUsedDate;
      callTimeInput.defaultValue = getLocalTimeValue();
      await new Promise((resolve) => setTimeout(resolve, 700));
      await loadCalls();
    } catch (error) {
      formStatus.textContent = 'No se pudo guardar. Revisa la conexión y la URL configurada.';
      formStatus.className = 'form-status error';
    } finally {
      submitButton.disabled = false;
    }
  });

  updateDashboardData();
  loadCalls().catch(() => {
    formStatus.textContent = 'No se pudieron cargar los registros de Google Sheets.';
    formStatus.className = 'form-status error';
  });
  loadAdvisors().catch(() => renderAdvisors());
});
