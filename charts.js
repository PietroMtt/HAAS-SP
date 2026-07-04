/* charts.js — Chart.js */
const Charts = (() => {
  let instances = {};
  const COLORS = {
    orange: '#e98738', green: '#296b48', blue: '#3b82f6', red: '#dc2626',
    yellow: '#f59e0b', gray: '#9ca3af', purple: '#8b5cf6',
  };
  const PALETTE = [COLORS.orange, COLORS.green, COLORS.blue, COLORS.yellow, COLORS.red, COLORS.purple, COLORS.gray];

  const destroy = (id) => { if (instances[id]) { instances[id].destroy(); delete instances[id]; } };

  const commonOpts = () => ({
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: getComputedStyle(document.body).getPropertyValue('--text-2').trim() || '#374151', font:{size:12} } },
    },
    scales: {
      x: { ticks:{ color:'#9ca3af' }, grid:{ color:'rgba(156,163,175,.15)' } },
      y: { ticks:{ color:'#9ca3af' }, grid:{ color:'rgba(156,163,175,.15)' }, beginAtZero: true },
    }
  });

  const countBy = (tasks, keyFn) => {
    const map = {};
    tasks.forEach(t => { const k = keyFn(t) || '—'; map[k] = (map[k] || 0) + 1; });
    return map;
  };

  const render = (tasks) => {
    const situMap = { 'Não iniciada': COLORS.gray, 'Em andamento': COLORS.blue,
      'Aguardando': COLORS.yellow, 'Concluída': COLORS.green,
      'Atrasada': COLORS.red, 'Cancelada': '#6b7280' };
    const prioMap = { 'Muito Alta': COLORS.red, 'Alta': COLORS.orange, 'Média': COLORS.blue, 'Baixa': COLORS.green };

    const cSit = countBy(tasks, t => Utils.computeSituacao(t));
    destroy('sit');
    instances.sit = new Chart(document.getElementById('chartSituacao'), {
      type: 'doughnut',
      data: { labels: Object.keys(cSit), datasets: [{ data: Object.values(cSit),
        backgroundColor: Object.keys(cSit).map(k => situMap[k] || COLORS.gray), borderWidth: 0 }] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' } } }
    });

    const cPri = countBy(tasks, t => t.prioridade);
    destroy('pri');
    instances.pri = new Chart(document.getElementById('chartPrioridade'), {
      type: 'doughnut',
      data: { labels: Object.keys(cPri), datasets:[{ data:Object.values(cPri),
        backgroundColor: Object.keys(cPri).map(k => prioMap[k] || COLORS.gray), borderWidth: 0 }] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' } } }
    });

    const cResp = countBy(tasks, t => t.responsavel);
    destroy('resp');
    instances.resp = new Chart(document.getElementById('chartResponsavel'), {
      type: 'bar',
      data: { labels: Object.keys(cResp), datasets:[{ label:'Tarefas', data:Object.values(cResp),
        backgroundColor: COLORS.orange, borderRadius: 6 }] },
      options: commonOpts()
    });

    const cLoc = countBy(tasks, t => t.localizacao);
    destroy('loc');
    instances.loc = new Chart(document.getElementById('chartLocalizacao'), {
      type: 'bar',
      data: { labels: Object.keys(cLoc), datasets:[{ label:'Tarefas', data:Object.values(cLoc),
        backgroundColor: COLORS.green, borderRadius: 6 }] },
      options: commonOpts()
    });

    // por mês (usa prazo)
    const cMes = {};
    tasks.forEach(t => {
      const d = t.prazo || t.dataCriacao; if (!d) return;
      const dt = new Date(d);
      const k = `${Utils.MESES[dt.getMonth()].slice(0,3)}/${String(dt.getFullYear()).slice(-2)}`;
      cMes[k] = (cMes[k] || 0) + 1;
    });
    const keysOrdered = Object.keys(cMes);
    destroy('mes');
    instances.mes = new Chart(document.getElementById('chartMes'), {
      type: 'line',
      data: { labels: keysOrdered, datasets:[{ label:'Tarefas', data: keysOrdered.map(k => cMes[k]),
        borderColor: COLORS.orange, backgroundColor: 'rgba(233,135,56,.15)',
        tension: 0.35, fill: true, pointBackgroundColor: COLORS.orange, pointRadius: 4 }] },
      options: commonOpts()
    });
  };

  return { render };
})();
