/* calendar.js — grade mensal com tarefas nos prazos */
const CalendarView = (() => {
  let cursor = new Date(); cursor.setDate(1);
  let onItemClick = () => {};

  const DIAS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

  const render = (tasks) => {
    document.getElementById('calGridHead').innerHTML = DIAS.map(d => `<div>${d}</div>`).join('');
    document.getElementById('calTitle').textContent = `${Utils.MESES[cursor.getMonth()]} ${cursor.getFullYear()}`;

    const year = cursor.getFullYear(), month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const startWeekday = first.getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const prevLast = new Date(year, month, 0).getDate();

    // agrupa tarefas pelo prazo
    const byDate = {};
    tasks.forEach(t => { if (t.prazo) (byDate[t.prazo] ||= []).push(t); });

    const cells = [];
    for (let i = 0; i < startWeekday; i++) {
      const day = prevLast - startWeekday + 1 + i;
      cells.push({ day, other: true, iso: null });
    }
    for (let d = 1; d <= lastDate; d++) {
      const iso = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      cells.push({ day: d, other: false, iso });
    }
    while (cells.length % 7 !== 0) {
      const day = cells.length - (startWeekday + lastDate) + 1;
      cells.push({ day, other: true, iso: null });
    }

    const today = new Date(); today.setHours(0,0,0,0);
    const todayISO = Utils.todayISO();

    document.getElementById('calGrid').innerHTML = cells.map(c => {
      const items = c.iso ? (byDate[c.iso] || []) : [];
      const isToday = c.iso === todayISO;
      return `<div class="cal-cell ${c.other?'other':''} ${isToday?'today':''}">
        <div class="cal-day">${c.day}</div>
        ${items.slice(0, 3).map(t => `
          <div class="cal-item p-${Utils.slug(t.prioridade)}" data-id="${t.id}" title="${Utils.escapeHtml(t.descricao)}">
            ${Utils.escapeHtml(t.numero || t.descricao.slice(0,20))}
          </div>`).join('')}
        ${items.length > 3 ? `<div class="cal-item" style="background:var(--surface-2);color:var(--muted)">+${items.length-3} mais</div>` : ''}
      </div>`;
    }).join('');

    document.querySelectorAll('.cal-item[data-id]').forEach(el =>
      el.addEventListener('click', () => onItemClick(el.dataset.id)));
  };

  const prev = () => { cursor.setMonth(cursor.getMonth() - 1); };
  const next = () => { cursor.setMonth(cursor.getMonth() + 1); };
  const today = () => { cursor = new Date(); cursor.setDate(1); };

  const bind = ({ itemClick }) => { if (itemClick) onItemClick = itemClick; };

  return { render, prev, next, today, bind };
})();
