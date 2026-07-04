/* dashboard.js — KPIs, alertas e listas resumo */
const Dashboard = (() => {

  const computeStats = (tasks) => {
    const s = { total: tasks.length, and:0, con:0, atr:0, hoje:0, alta:0, muitoAlta:0, tempoMedio: 0 };
    let somaDias = 0, contConcluidas = 0;
    tasks.forEach(t => {
      const sit = Utils.computeSituacao(t);
      if (sit === 'Em andamento') s.and++;
      if (sit === 'Concluída') s.con++;
      if (sit === 'Atrasada') s.atr++;
      if (t.prazo && Utils.daysBetween(t.prazo) === 0 && sit !== 'Concluída') s.hoje++;
      if (t.prioridade === 'Alta') s.alta++;
      if (t.prioridade === 'Muito Alta') s.muitoAlta++;
      if (sit === 'Concluída' && t.dataInicio && (t.dataEmbalagem || t.dataProducao)) {
        const fim = t.dataEmbalagem || t.dataProducao;
        const dias = Math.round((new Date(fim) - new Date(t.dataInicio)) / 86400000);
        if (dias >= 0) { somaDias += dias; contConcluidas++; }
      }
    });
    s.tempoMedio = contConcluidas ? Math.round(somaDias / contConcluidas) : 0;
    return s;
  };

  const renderKPIs = (tasks) => {
    const s = computeStats(tasks);
    const items = [
      { label: 'Total de tarefas', value: s.total, icon: 'fa-list-check', kind: 'o' },
      { label: 'Em andamento',     value: s.and,   icon: 'fa-spinner',    kind: 'b' },
      { label: 'Concluídas',       value: s.con,   icon: 'fa-circle-check', kind: 'g' },
      { label: 'Atrasadas',        value: s.atr,   icon: 'fa-triangle-exclamation', kind: 'r' },
      { label: 'Vencendo hoje',    value: s.hoje,  icon: 'fa-bell',       kind: 'y' },
      { label: 'Alta prioridade',  value: s.alta,  icon: 'fa-flag',       kind: 'o' },
      { label: 'Muito alta',       value: s.muitoAlta, icon: 'fa-fire',   kind: 'r' },
      { label: 'Tempo médio', value: s.tempoMedio + 'd', icon: 'fa-stopwatch', kind: 'p', sub: 'dias por tarefa' },
    ];
    document.getElementById('kpiGrid').innerHTML = items.map(k => `
      <div class="kpi">
        <div class="kpi-icon ${k.kind}"><i class="fa-solid ${k.icon}"></i></div>
        <div>
          <div class="kpi-label">${k.label}</div>
          <div class="kpi-value">${k.value}</div>
          ${k.sub ? `<div class="kpi-sub">${k.sub}</div>` : ''}
        </div>
      </div>`).join('');
  };

  const renderAlerts = (tasks) => {
    const alerts = [];
    let semResp = 0, semLoc = 0, venceu = 0, prox3 = 0;
    tasks.forEach(t => {
      const sit = Utils.computeSituacao(t);
      if (sit === 'Concluída' || sit === 'Cancelada') return;
      if (!t.responsavel) semResp++;
      if (!t.localizacao) semLoc++;
      if (t.prazo) {
        const d = Utils.daysBetween(t.prazo);
        if (d < 0) venceu++;
        else if (d <= 3) prox3++;
      }
    });
    if (venceu) alerts.push({ k:'error', i:'fa-circle-exclamation', m:`${venceu} tarefa(s) com prazo vencido` });
    if (prox3)  alerts.push({ k:'warn',  i:'fa-clock', m:`${prox3} tarefa(s) vencem nos próximos 3 dias` });
    if (semResp)alerts.push({ k:'info',  i:'fa-user-slash', m:`${semResp} tarefa(s) sem responsável` });
    if (semLoc) alerts.push({ k:'info',  i:'fa-location-dot', m:`${semLoc} tarefa(s) sem localização` });
    document.getElementById('alertsPanel').innerHTML = alerts.map(a =>
      `<div class="alert ${a.k}"><i class="fa-solid ${a.i}"></i> ${a.m}</div>`).join('');
  };

  const renderUpcoming = (tasks) => {
    const list = tasks
      .filter(t => t.prazo && Utils.computeSituacao(t) !== 'Concluída' && Utils.computeSituacao(t) !== 'Cancelada')
      .map(t => ({ t, d: Utils.daysBetween(t.prazo) }))
      .filter(x => x.d !== null && x.d >= -3 && x.d <= 7)
      .sort((a,b) => a.d - b.d).slice(0, 6);
    const el = document.getElementById('dashUpcoming');
    if (!list.length) { el.innerHTML = `<p class="muted" style="margin:0">Nenhuma tarefa próxima do prazo.</p>`; return; }
    el.innerHTML = `<ul class="mini-list">${list.map(({t,d}) => `
      <li>
        <div>
          <div class="t-title">${Utils.escapeHtml(t.numero || t.descricao.slice(0,40))}</div>
          <div class="t-sub">${Utils.escapeHtml(t.cliente || 'Sem cliente')} · ${Utils.fmtDate(t.prazo)}</div>
        </div>
        <div class="days-chip ${d<0?'days-late':d===0?'days-today':d<=3?'days-soon':'days-ok'}">
          ${d<0 ? `Atrasada ${Math.abs(d)}d` : d===0 ? 'Vence hoje' : `Faltam ${d}d`}
        </div>
      </li>`).join('')}</ul>`;
  };

  const renderActivity = (tasks) => {
    const events = [];
    tasks.forEach(t => (t.historico || []).forEach(h => events.push({ ...h, tarefa: t })));
    events.sort((a,b) => new Date(b.ts) - new Date(a.ts));
    const top = events.slice(0, 6);
    const el = document.getElementById('dashActivity');
    if (!top.length) { el.innerHTML = `<p class="muted" style="margin:0">Sem atividade recente.</p>`; return; }
    el.innerHTML = `<ul class="mini-list">${top.map(e => `
      <li>
        <div>
          <div class="t-title">${Utils.escapeHtml(e.texto)}</div>
          <div class="t-sub">${Utils.escapeHtml(e.tarefa.numero || e.tarefa.descricao.slice(0,40))}</div>
        </div>
        <div class="t-sub">${Utils.fmtDateTime(e.ts)}</div>
      </li>`).join('')}</ul>`;
  };

  const render = (tasks) => {
    renderKPIs(tasks); renderAlerts(tasks);
    renderUpcoming(tasks); renderActivity(tasks);
  };

  return { render };
})();
