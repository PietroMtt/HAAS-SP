/* utils.js — helpers puros */
const Utils = (() => {
  const PRIORIDADES = ['Muito Alta', 'Alta', 'Média', 'Baixa'];
  const SITUACOES = ['Não iniciada', 'Em andamento', 'Aguardando', 'Concluída', 'Atrasada', 'Cancelada'];
  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  const slug = (s = '') => String(s).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const fmtDate = (iso) => {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };
  const fmtDateTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  };
  const todayISO = () => new Date().toISOString().slice(0, 10);

  const getProductIcon = (str) => {
    const t = (str || '').toLowerCase();
    if (t.includes('monitor')) return '📺';
    if (t.includes('notebook') || t.includes('laptop')) return '💻';
    if (t.includes('cpu') || t.includes('desk') || t.includes('micro') || t.includes('computador') || t.includes('servidor')) return '🖥️';
    return '📦';
  };

  const daysBetween = (iso) => {
    if (!iso) return null;
    const today = new Date(); today.setHours(0,0,0,0);
    const dateStr = iso.length > 10 ? iso.slice(0,10) : iso;
    const target = new Date(dateStr + 'T00:00:00');
    return Math.round((target - today) / 86400000);
  };

  const escapeHtml = (s = '') => String(s).replace(/[&<>"']/g,
    c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  const debounce = (fn, wait = 200) => {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
  };

  // Situação computada: se marcada Concluída/Cancelada, mantém.
  // Caso contrário, se passou do prazo → Atrasada.
  const computeSituacao = (t) => {
    if (t.situacao === 'Concluída' || t.situacao === 'Cancelada') return t.situacao;
    if (t.dataProducao && t.dataEmbalagem) return 'Concluída';
    if (t.prazo) {
      const d = daysBetween(t.prazo);
      if (d !== null && d < 0) return 'Atrasada';
    }
    return t.situacao || 'Não iniciada';
  };

  const toast = (msg, kind = 'ok') => {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2200);
  };

  const colorFor = (str) => {
    if (!str) return 'transparent';
    
    // Paleta de cores altamente distintas (primárias, secundárias e neutras fortes)
    const colors = [
      '#e6194b', // Red
      '#3cb44b', // Green
      '#ffe119', // Yellow
      '#4363d8', // Blue
      '#f58231', // Orange
      '#911eb4', // Purple
      '#42d4f4', // Cyan
      '#f032e6', // Magenta
      '#bfef45', // Lime
      '#fabed4', // Pink
      '#469990', // Teal
      '#dcbeff', // Lavender
      '#9A6324', // Brown
      '#fffac8', // Beige
      '#800000', // Maroon
      '#aaffc3', // Mint
      '#808000', // Olive
      '#ffd8b1', // Apricot
      '#000075', // Navy
      '#a9a9a9'  // Grey
    ];

    let num = parseInt(str.replace(/\D/g, ''), 10);
    if (isNaN(num)) {
      num = 0;
      for (let i = 0; i < str.length; i++) num += str.charCodeAt(i);
    }
    
    // Como os números das OS são sempre incrementais, isso fará com que OS sequenciais
    // passeiem por todas essas 20 cores de forma perfeita, sem nunca repetir em sequência
    return colors[num % colors.length];
  };

  const businessHoursBetween = (startIso, endIso) => {
    if (!startIso) return 0;
    const start = new Date(startIso);
    const end = endIso ? new Date(endIso) : new Date();
    if (start >= end) return 0;
    
    let current = new Date(start);
    let minutes = 0;
    const maxDate = new Date(start.getTime() + 365*24*60*60*1000);
    const realEnd = end > maxDate ? maxDate : end;

    while (current < realEnd) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) { // Monday to Friday
        const h = current.getHours();
        const m = current.getMinutes();
        const time = h + m / 60;
        // 07:00 to 12:00 -> 7 to 12
        // 13:12 to 17:00 -> 13.2 to 17
        if ((time >= 7 && time < 12) || (time >= 13.2 && time < 17)) {
          minutes++;
        }
      }
      current.setTime(current.getTime() + 60000); // add 1 minute
    }
    return minutes / 60;
  };

  const formatBusinessTime = (hours) => {
    if (!hours) return '0 hrs úteis';
    if (hours < 8.8) return hours.toFixed(1) + ' hrs úteis';
    const days = Math.floor(hours / 8.8);
    const remaining = hours - (days * 8.8);
    const dayStr = days === 1 ? '1 dia' : days + ' dias';
    if (remaining < 0.1) return dayStr;
    return `${dayStr} e ${remaining.toFixed(1)} hrs úteis`;
  };

  return { PRIORIDADES, SITUACOES, MESES, uid, slug, fmtDate, fmtDateTime,
           todayISO, daysBetween, escapeHtml, debounce, computeSituacao, toast,
           businessHoursBetween, formatBusinessTime, colorFor, getProductIcon };
})();
