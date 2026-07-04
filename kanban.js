/* kanban.js — visualização em colunas com drag-and-drop */
const Kanban = (() => {
  let onCardClick = () => {}, onMove = () => {};

  const render = (tasks) => {
    const root = document.getElementById('kanban');
    const user = Storage.currentUser || {};
    const hidden = user.hiddenColumns || [];
    const cols = Storage.columns.all().filter(c => !hidden.includes(c.id));
    
    root.innerHTML = cols.map((col, idx) => {
      // First column acts as the default if location is missing
      const isFirst = idx === 0;
      const items = tasks.filter(t => t.localizacao === col.id || (isFirst && !t.localizacao));
      
      return `
      <div class="kcol" data-col="${col.id}">
        <div class="kcol-head">
          <div class="name"><span class="kcol-dot" style="background:${col.color || '#888888'}"></span>${col.id}</div>
          <div class="count">${items.length}</div>
        </div>
        ${items.map(t => {
          const hours = Utils.businessHoursBetween(t.tsLocalizacao || t.dataCriacao, new Date().toISOString());
          return `
          <div class="kcard p-${Utils.slug(t.prioridade)}" draggable="true" data-id="${t.id}" style="border-top: 4px solid ${Utils.colorFor(t.numero)};">
            <div class="k-num" style="display:flex; justify-content:space-between; align-items:center;">
              <span style="display:flex; align-items:center; gap:6px;">
                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${Utils.colorFor(t.numero)};"></span>
                ${Utils.escapeHtml(t.numero || '—')}
              </span>
              <span title="Dias em aberto">${Math.max(0, -(Utils.daysBetween(t.dataInicio || t.dataCriacao) || 0))}d aberto</span>
            </div>
            <div class="k-title">
              <span style="display:inline-block; background:var(--surface-2); padding:2px 6px; border-radius:4px; font-weight:bold; margin-right:4px;">
                ${t.quantidade ? t.quantidade + ' un' : '—'}
              </span>
              <span style="margin-right: 4px;">${Utils.getProductIcon(t.produtos || t.descricao)}</span>
              ${Utils.escapeHtml(t.descricao.split('\n')[0].slice(0,80))}
            </div>
            <div class="k-meta">
              <span style="color:var(--orange)" title="Tempo na localização"><i class="fa-solid fa-clock"></i>${Utils.formatBusinessTime(hours)}</span>
              <span><i class="fa-regular fa-user"></i>${Utils.escapeHtml((t.responsavel||'—').slice(0,18))}</span>
            </div>
          </div>`}).join('')}
      </div>`;
    }).join('');

    // Drag & drop
    root.querySelectorAll('.kcard').forEach(card => {
      card.addEventListener('dragstart', e => {
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', card.dataset.id);
      });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
      card.addEventListener('click', () => onCardClick(card.dataset.id));
    });
    
    // Auto-scroll logic for the window
    document.addEventListener('dragover', e => {
      const edgeSize = 100;
      const speed = 15;
      
      if (e.clientY > window.innerHeight - edgeSize) {
        window.scrollBy(0, speed);
      } else if (e.clientY < edgeSize) {
        window.scrollBy(0, -speed);
      }
    });

    root.querySelectorAll('.kcol').forEach(col => {
      col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drop'); });
      col.addEventListener('dragleave', () => col.classList.remove('drop'));
      col.addEventListener('drop', e => {
        e.preventDefault(); col.classList.remove('drop');
        const id = e.dataTransfer.getData('text/plain');
        const newSit = col.dataset.col;
        onMove(id, newSit);
      });
    });
  };

  const bind = ({ cardClick, move }) => {
    if (cardClick) onCardClick = cardClick;
    if (move) onMove = move;
  };

  return { render, bind };
})();
