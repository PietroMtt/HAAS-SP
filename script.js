/* script.js — orquestrador principal */
(() => {
  // ---------- estado UI ----------
  const state = {
    view: 'dashboard',
    search: '',
    filters: { situacao:'', prioridade:'', responsavel:'', localizacao:'', mes:'', ano:'', dataIni:'', dataFim:'' },
    sort: { key: 'prazo', dir: 'asc' },
    page: 1,
    pageSize: 20,
    editingId: null,
  };

  // ---------- navegação entre views ----------
  const showView = (name) => {
    state.view = name;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('hidden', v.id !== `view-${name}`));
    refresh();
    document.querySelector('.sidebar')?.classList.remove('open');
  };
  document.querySelectorAll('.nav-item').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));

  // ---------- tema ----------
  const applyTheme = () => {
    const dark = localStorage.getItem('sgp-theme') === 'dark';
    document.body.classList.toggle('dark', dark);
    const btn = document.getElementById('btnTheme');
    btn.innerHTML = dark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
  };
  document.getElementById('btnTheme').addEventListener('click', () => {
    localStorage.setItem('sgp-theme', document.body.classList.contains('dark') ? 'light' : 'dark');
    applyTheme(); refresh();
  });
  applyTheme();

  // ---------- popular filtros dinâmicos ----------
  const populateFilters = () => {
    const tasks = Storage.all();
    const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort();
    const fill = (id, opts, keepEmpty='') => {
      const el = document.getElementById(id);
      const current = el.value;
      el.innerHTML = `<option value="">${keepEmpty || 'Todas'}</option>` +
        opts.map(o => `<option ${o===current?'selected':''}>${Utils.escapeHtml(o)}</option>`).join('');
    };
    fill('fSituacao', Utils.SITUACOES);
    fill('fPrioridade', Utils.PRIORIDADES);
    fill('fResponsavel', uniq(tasks.map(t => t.responsavel)), 'Todos');
    fill('fLocalizacao', uniq(tasks.map(t => t.localizacao)));
    fill('fMes', Utils.MESES);
    const anos = uniq(tasks.map(t => t.prazo?.slice(0,4) || t.dataCriacao?.slice(0,4)));
    fill('fAno', anos);
  };

  // ---------- pipeline: filter → sort → paginate ----------
  const applyFilters = (tasks) => {
    const q = state.search.toLowerCase().trim();
    const f = state.filters;
    return tasks.filter(t => {
      if (f.situacao   && Utils.computeSituacao(t) !== f.situacao) return false;
      if (f.prioridade && t.prioridade !== f.prioridade) return false;
      if (f.responsavel && t.responsavel !== f.responsavel) return false;
      if (f.localizacao && t.localizacao !== f.localizacao) return false;
      if (f.mes) {
        const m = (t.prazo || t.dataCriacao || '').slice(5,7);
        if (parseInt(m,10) !== Utils.MESES.indexOf(f.mes)+1) return false;
      }
      if (f.ano) {
        const y = (t.prazo || t.dataCriacao || '').slice(0,4);
        if (y !== f.ano) return false;
      }
      if (f.dataIni && (!t.prazo || t.prazo < f.dataIni)) return false;
      if (f.dataFim && (!t.prazo || t.prazo > f.dataFim)) return false;
      if (q) {
        const hay = [t.numero, t.cliente, t.descricao, t.responsavel, t.localizacao,
                     t.pedido, t.fluxo, t.produtos, t.observacoes].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  };

  const applySort = (tasks) => {
    const { key, dir } = state.sort;
    const mul = dir === 'asc' ? 1 : -1;
    const prioRank = { 'Muito Alta': 0, 'Alta': 1, 'Média': 2, 'Baixa': 3 };
    return [...tasks].sort((a, b) => {
      let va, vb;
      if (key === '_dias') { va = Utils.daysBetween(a.prazo) ?? 99999; vb = Utils.daysBetween(b.prazo) ?? 99999; }
      else if (key === 'prioridade') { va = prioRank[a.prioridade] ?? 9; vb = prioRank[b.prioridade] ?? 9; }
      else if (key === 'situacao') { va = Utils.computeSituacao(a); vb = Utils.computeSituacao(b); }
      else { va = a[key] || ''; vb = b[key] || ''; }
      if (va < vb) return -1 * mul;
      if (va > vb) return  1 * mul;
      return 0;
    });
  };

  // ---------- tabela ----------
  const daysCell = (t) => {
    const sit = Utils.computeSituacao(t);
    if (sit === 'Concluída') return `<span class="days-chip days-done">Concluída</span>`;
    if (sit === 'Cancelada') return `<span class="days-chip days-ok">—</span>`;
    const d = Utils.daysBetween(t.prazo);
    if (d === null) return `<span class="days-chip days-ok">Sem prazo</span>`;
    if (d < 0) return `<span class="days-chip days-late">Atrasada ${Math.abs(d)}d</span>`;
    if (d === 0) return `<span class="days-chip days-today">Vence hoje</span>`;
    if (d <= 3) return `<span class="days-chip days-soon">Faltam ${d}d</span>`;
    return `<span class="days-chip days-ok">Faltam ${d}d</span>`;
  };

  const renderTable = () => {
    const all = Storage.all();
    const filtered = applyFilters(all);
    const sorted = applySort(filtered);
    const total = sorted.length;
    const pages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page > pages) state.page = 1;
    const start = (state.page - 1) * state.pageSize;
    const pageItems = sorted.slice(start, start + state.pageSize);
    
    const isUser = Storage.currentUser && Storage.currentUser.role !== 'admin';

    document.getElementById('tableCount').textContent =
      `${total} de ${all.length} tarefa(s)`;

    // header ordering
    document.querySelectorAll('#tblHead th').forEach(th => {
      th.classList.remove('sorted', 'desc');
      if (th.dataset.sort === state.sort.key) {
        th.classList.add('sorted');
        if (state.sort.dir === 'desc') th.classList.add('desc');
      }
    });

    const body = document.getElementById('tblBody');
    const empty = document.getElementById('tblEmpty');
    if (!pageItems.length) {
      body.innerHTML = ''; empty.classList.remove('hidden');
    } else {
      empty.classList.add('hidden');
      body.innerHTML = pageItems.map(t => {
        const sit = Utils.computeSituacao(t);
        return `<tr data-id="${t.id}">
          <td class="num">${Utils.escapeHtml(t.numero || '—')}</td>
          <td>${Utils.escapeHtml(t.cliente || '—')}</td>
          <td class="desc">
            <div class="desc-title">${Utils.escapeHtml(t.descricao.split('\n')[0])}</div>
            ${t.pedido ? `<div class="desc-sub">Pedido: ${Utils.escapeHtml(t.pedido)}</div>` : ''}
          </td>
          <td><span class="badge b-${Utils.slug(t.prioridade)}">${Utils.escapeHtml(t.prioridade)}</span></td>
          <td>${Utils.escapeHtml(t.responsavel || '—')}</td>
          <td class="date">${Utils.fmtDate(t.dataInicio)}</td>
          <td class="date">${Utils.fmtDate(t.prazo)}</td>
          <td>${Utils.escapeHtml(t.localizacao || '—')}</td>
          <td class="date">${Utils.fmtDate(t.dataProducao)}</td>
          <td class="date">${Utils.fmtDate(t.dataEmbalagem)}</td>
          <td><span class="badge b-${Utils.slug(sit)}">${Utils.escapeHtml(sit)}</span></td>
          <td>${daysCell(t)}</td>
          <td>
            <div class="row-actions">
              <button class="icon-btn" data-act="edit" title="Editar"><i class="fa-solid fa-pen"></i></button>
              <button class="icon-btn" data-act="dup" title="Duplicar"><i class="fa-solid fa-copy"></i></button>
              ${!isUser ? `<button class="icon-btn" data-act="del" title="Excluir"><i class="fa-solid fa-trash"></i></button>` : ''}
            </div>
          </td>
        </tr>`;
      }).join('');
    }

    // pagination
    const pag = document.getElementById('pagControls');
    let html = `<button ${state.page===1?'disabled':''} data-p="prev"><i class="fa-solid fa-chevron-left"></i></button>`;
    const maxBtns = 5;
    let s = Math.max(1, state.page - 2);
    let e = Math.min(pages, s + maxBtns - 1);
    s = Math.max(1, e - maxBtns + 1);
    for (let i = s; i <= e; i++) {
      html += `<button class="${i===state.page?'active':''}" data-p="${i}">${i}</button>`;
    }
    html += `<span class="pag-info">de ${pages}</span>`;
    html += `<button ${state.page===pages?'disabled':''} data-p="next"><i class="fa-solid fa-chevron-right"></i></button>`;
    pag.innerHTML = html;
    pag.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      const p = b.dataset.p;
      if (p === 'prev') state.page = Math.max(1, state.page - 1);
      else if (p === 'next') state.page = Math.min(pages, state.page + 1);
      else state.page = parseInt(p, 10);
      renderTable();
    }));

    // linhas → editar; ações → editar/duplicar/excluir
    body.querySelectorAll('tr').forEach(tr => {
      tr.addEventListener('click', e => {
        const btn = e.target.closest('[data-act]');
        const id = tr.dataset.id;
        if (btn) {
          e.stopPropagation();
          if (btn.dataset.act === 'edit') openTaskModal(id);
          else if (btn.dataset.act === 'dup') { Storage.duplicate(id); Utils.toast('Tarefa duplicada'); refresh(); }
          else if (btn.dataset.act === 'del') askConfirm('Excluir esta tarefa?', () => { Storage.remove(id); Utils.toast('Tarefa excluída'); refresh(); });
        } else openTaskModal(id);
      });
    });
  };

  // ---------- refresh geral ----------
  window.refresh = () => {
    populateFilters();
    if (state.view === 'dashboard') Dashboard.render(Storage.all());
    if (state.view === 'table') renderTable();
    if (state.view === 'kanban') Kanban.render(Storage.all());
    if (state.view === 'calendar') CalendarView.render(Storage.all());
    if (state.view === 'stats') Charts.render(Storage.all());
  };
  const refresh = window.refresh;

  // ---------- filtros / busca ----------
  const bindFilterInputs = () => {
    const map = { fSituacao:'situacao', fPrioridade:'prioridade', fResponsavel:'responsavel',
      fLocalizacao:'localizacao', fMes:'mes', fAno:'ano', fDataIni:'dataIni', fDataFim:'dataFim' };
    for (const id in map) {
      document.getElementById(id).addEventListener('change', e => {
        state.filters[map[id]] = e.target.value; state.page = 1; renderTable();
      });
    }
    document.getElementById('btnClearFilters').addEventListener('click', () => {
      for (const k in state.filters) state.filters[k] = '';
      state.search = '';
      document.getElementById('globalSearch').value = '';
      populateFilters(); state.page = 1; refresh();
    });
    document.getElementById('pageSize').addEventListener('change', e => {
      state.pageSize = parseInt(e.target.value, 10); state.page = 1; renderTable();
    });
  };
  bindFilterInputs();

  document.getElementById('globalSearch').addEventListener('input',
    Utils.debounce(e => { state.search = e.target.value; state.page = 1; refresh(); }, 200));

  document.querySelectorAll('#tblHead th[data-sort]').forEach(th =>
    th.addEventListener('click', () => {
      const k = th.dataset.sort;
      if (state.sort.key === k) state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
      else { state.sort.key = k; state.sort.dir = 'asc'; }
      renderTable();
    }));

  // ---------- MODAL de tarefa ----------
  const modal = document.getElementById('taskModal');
  const form = document.getElementById('taskForm');
  const openTaskModal = (id = null) => {
    state.editingId = id;
    state.importData = null;
    const t = id ? Storage.get(id) : null;
    document.getElementById('taskModalTitle').innerHTML =
      `<i class="fa-solid fa-clipboard-list"></i> ${t ? 'Editar Tarefa' : 'Nova Tarefa'}`;
    const badge = document.getElementById('modalTimeBadge');
    if (t) {
      const hours = Utils.businessHoursBetween(t.tsLocalizacao || t.dataCriacao, new Date().toISOString());
      badge.querySelector('span').textContent = Utils.formatBusinessTime(hours);
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
    form.reset();
    // reset tabs
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x.dataset.tab === 'dados'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('hidden', p.dataset.panel !== 'dados'));
    // preencher
    if (t) {
      for (const k in t) if (form.elements[k]) form.elements[k].value = t[k] || '';
    } else {
      form.elements.dataInicio.value = Utils.todayISO();
    }
    renderOccurrences(t);
    renderHistory(t);
    renderAnotacoes(t);
    
    // Apply read-only permissions
    const user = Storage.currentUser;
    const isUser = user && user.role !== 'admin';
    const fieldsToLock = form.querySelectorAll('input:not(#newObsInput):not(#occInput), select');
    fieldsToLock.forEach(f => f.disabled = isUser);
    
    document.getElementById('btnDelete').style.display = (isUser || !t) ? 'none' : 'inline-flex';
    document.getElementById('btnDuplicate').style.display = (isUser || !t) ? 'none' : 'inline-flex';
    document.querySelector('#taskForm .modal-foot button[type="submit"]').style.display = isUser ? 'none' : 'block';
    if (btnAutoFill) btnAutoFill.style.display = isUser ? 'none' : 'block';
    
    document.getElementById('btnImportOS').style.display = (isUser || t) ? 'none' : 'inline-flex';
    
    modal.classList.add('open');
  };
  const closeAnyModal = (e) => {
    const m = e.target.closest('.modal-backdrop');
    if (e.target.closest('[data-close]') || e.target === m) m?.classList.remove('open');
  };
  document.querySelectorAll('.modal-backdrop').forEach(m => m.addEventListener('click', closeAnyModal));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.modal-backdrop.open').forEach(m => m.classList.remove('open'));
  });

  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === t));
    document.querySelectorAll('.tab-panel').forEach(p =>
      p.classList.toggle('hidden', p.dataset.panel !== t.dataset.tab));
  }));

  const btnAutoFill = document.getElementById('btnAutoFill');
  if (btnAutoFill) {
    btnAutoFill.addEventListener('click', () => {
      const text = form.elements['descricao'].value;
      if (!text.trim()) {
        Utils.toast('Cole os dados na descrição primeiro!', 'error');
        return;
      }
      const icon = btnAutoFill.querySelector('i');
      icon.className = 'fa-solid fa-spinner fa-spin';
      btnAutoFill.disabled = true;
      setTimeout(() => {
        const data = window.Parser?.extract(text) || {};
        let count = 0;
        for (const key in data) {
          if (form.elements[key]) {
            form.elements[key].value = data[key];
            count++;
          }
        }
        icon.className = 'fa-solid fa-bolt';
        btnAutoFill.disabled = false;
        Utils.toast(`Extração concluída: ${count} campos preenchidos.`, 'success');
      }, 400);
    });
  }

  const renderOccurrences = (t) => {
    const list = document.getElementById('occList');
    const occ = (t?.ocorrencias) || [];
    list.innerHTML = occ.length
      ? occ.map(o => `<li>
          <div class="occ-meta">${Utils.fmtDateTime(o.ts)} · ${Utils.escapeHtml(o.usuario||'—')}</div>
          <div>${Utils.escapeHtml(o.texto)}</div>
        </li>`).join('')
      : `<p class="muted">Nenhuma ocorrência registrada.</p>`;
  };
  const renderHistory = (t) => {
    const list = document.getElementById('historyList');
    const h = (t?.historico) || [];
    list.innerHTML = h.length
      ? h.slice().reverse().map(x => `<li>
          <div class="tl-meta">${Utils.fmtDateTime(x.ts)}</div>
          <div>${Utils.escapeHtml(x.texto)}</div>
        </li>`).join('')
      : `<p class="muted">Sem histórico.</p>`;
  };
  const renderAnotacoes = (t) => {
    const list = document.getElementById('obsList');
    const a = (t?.anotacoes) || [];
    list.innerHTML = a.length
      ? a.slice().reverse().map(o => `<li style="padding-bottom:5px; border-bottom:1px solid var(--border);">
          <div style="font-size:11px; color:var(--muted); margin-bottom:2px;">
            ${Utils.escapeHtml(o.usuario||'—')} / ${Utils.fmtDateTime(o.ts)}
          </div>
          <div style="font-size:13px;">${Utils.escapeHtml(o.texto)}</div>
        </li>`).join('')
      : `<p class="muted" style="margin:0; font-size:13px;">Nenhuma anotação.</p>`;
  };

  document.getElementById('btnAddOcc').addEventListener('click', () => {
    const input = document.getElementById('occInput');
    const val = input.value.trim();
    if (!val) return;
    if (!state.editingId) { Utils.toast('Salve a tarefa antes'); return; }
    const t = Storage.addOcorrencia(state.editingId, val);
    input.value = '';
    renderOccurrences(t); renderHistory(t); refresh();
  });
  
  document.getElementById('btnAddObs').addEventListener('click', () => {
    const input = document.getElementById('newObsInput');
    const val = input.value.trim();
    if (!val) return;
    if (!state.editingId) { Utils.toast('Salve a tarefa antes de anotar'); return; }
    const t = Storage.addAnotacao(state.editingId, val);
    input.value = '';
    renderAnotacoes(t);
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    if (state.editingId) {
      Storage.update(state.editingId, data);
      Utils.toast('Tarefa atualizada');
    } else {
      if (state.importData && state.importData.produtos && state.importData.produtos.length > 0) {
        let count = 0;
        state.importData.produtos.forEach((p, idx) => {
          const tData = { ...data };
          // For the first card, keep what the user typed in descricao (if they edited it)
          // For subsequent cards, force generation
          if (idx > 0 || state.importData.produtos.length > 1) {
            tData.descricao = `${state.importData.cliente || data.cliente || ''} — ${p.qtd} ${p.nome}`.trim();
          }
          tData.produtos = `${p.qtd}x ${p.nome}`;
          tData.quantidade = p.qtd;
          
          // Create the task
          const created = Storage.create(tData);
          count++;
          
          // Add checklist Completo and accessories as an annotation
          let note = state.importData.checklistCompleto ? state.importData.checklistCompleto + '\n\n' : '';
          
          // Use data.acessorios so whatever the user typed in the textarea is saved!
          if (data.acessorios && data.acessorios.trim() !== '') {
            note += 'ATENÇÃO - ACESSÓRIOS INCLUÍDOS:\n' + data.acessorios.trim();
          }
          
          if (note.trim()) Storage.addAnotacao(created.id, note.trim());
        });
        Utils.toast(`${count} Tarefa(s) criada(s) a partir do PDF!`);
        state.importData = null;
      } else {
        const created = Storage.create(data);
        if (state.importData && state.importData.checklistCompleto) {
          Storage.addAnotacao(created.id, state.importData.checklistCompleto);
        }
        Utils.toast('Tarefa cadastrada');
        state.importData = null;
      }
    }
    modal.classList.remove('open');
    refresh();
  });

  document.getElementById('btnDelete').addEventListener('click', () => {
    if (!state.editingId) return;
    askConfirm('Excluir esta tarefa?', () => {
      Storage.remove(state.editingId);
      modal.classList.remove('open');
      Utils.toast('Tarefa excluída'); refresh();
    });
  });
  document.getElementById('btnDuplicate').addEventListener('click', () => {
    if (!state.editingId) return;
    const dup = Storage.duplicate(state.editingId);
    modal.classList.remove('open');
    Utils.toast('Tarefa duplicada'); refresh();
    setTimeout(() => openTaskModal(dup.id), 100);
  });

  document.getElementById('btnNewTask').addEventListener('click', () => openTaskModal(null));

  // ---------- IMPORTAR OS (PDF) ----------
  const btnImportOS = document.getElementById('btnImportOS');
  const importOSFile = document.getElementById('importOSFile');
  if (btnImportOS && importOSFile) {
    btnImportOS.addEventListener('click', () => importOSFile.click());
    importOSFile.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        btnImportOS.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Lendo...';
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const strings = content.items.map(item => item.str);
          fullText += strings.join(' ') + '\n';
        }
        
        // Pass text to parser
        const parsed = Parser.extract(fullText);
        if (parsed) {
          // Preencher formulário principal
          form.elements.numero.value = parsed.numero || '';
          form.elements.cliente.value = parsed.cliente || '';
          form.elements.fluxo.value = parsed.fluxo || '';
          form.elements.pedido.value = parsed.pedido || '';
          
          if (parsed.produtos && parsed.produtos.length > 0) {
            // Se houver produtos, gerar a Descrição base para o primeiro (ou único) card
            const p1 = parsed.produtos[0];
            form.elements.descricao.value = `${parsed.cliente || ''} — ${p1.qtd} ${p1.nome}`.trim();
            form.elements.quantidade.value = p1.qtd;
            
            if (parsed.produtos.length === 1) {
              form.elements.produtos.value = `${p1.qtd}x ${p1.nome}`;
            } else {
              form.elements.produtos.value = `Atenção: Serão gerados ${parsed.produtos.length} Cards separados.\n` + parsed.produtos.map(p => `${p.qtd}x ${p.nome}`).join('\n');
            }
          } else {
            form.elements.descricao.value = parsed.cliente || '';
            form.elements.produtos.value = '';
          }
          
          if (parsed.acessorios && parsed.acessorios.length > 0) {
            form.elements.acessorios.value = parsed.acessorios.map(a => `${a.qtd}x ${a.nome}`).join('\n');
          } else {
            form.elements.acessorios.value = '';
          }
          
          // Salvar tudo no state
          state.importData = parsed;
          
          Utils.toast('PDF lido com sucesso!');
        } else {
          Utils.toast('Não foi possível ler a OS', 'error');
        }
      } catch (err) {
        console.error(err);
        Utils.toast('Erro ao processar PDF', 'error');
      } finally {
        btnImportOS.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Importar PDF';
        importOSFile.value = '';
      }
    });
  }

  // ---------- filter modal ----------
  document.getElementById('btnFilterCols').addEventListener('click', () => {
    const user = Storage.currentUser;
    if (!user) return;
    user.hiddenColumns = user.hiddenColumns || [];
    
    const list = document.getElementById('filterColList');
    list.innerHTML = Storage.columns.all().map(c => {
      const isHidden = user.hiddenColumns.includes(c.id);
      return `
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer; padding:6px; background:var(--surface); border-radius:6px; border:1px solid var(--border);">
          <input type="checkbox" value="${Utils.escapeHtml(c.id)}" ${isHidden ? '' : 'checked'} style="width:18px; height:18px;" />
          <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:${c.color || '#888888'};"></span>
          <span>${Utils.escapeHtml(c.id)}</span>
        </label>
      `;
    }).join('');
    
    list.querySelectorAll('input[type="checkbox"]').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const colId = e.target.value;
        if (e.target.checked) {
          user.hiddenColumns = user.hiddenColumns.filter(id => id !== colId);
        } else {
          if (!user.hiddenColumns.includes(colId)) user.hiddenColumns.push(colId);
        }
        
        // Save to storage
        const allUsers = Storage.users.all();
        const uIdx = allUsers.findIndex(u => u.id === user.id);
        if (uIdx !== -1) {
          allUsers[uIdx] = user;
          Storage.users.save(allUsers);
        }
        sessionStorage.setItem('sgp-current-user', JSON.stringify(user));
        
        // Refresh UI
        refresh();
      });
    });
    
    document.getElementById('filterModal').classList.add('open');
  });

  // ---------- confirm modal ----------
  let confirmCB = null;
  const askConfirm = (msg, cb) => {
    document.getElementById('confirmMsg').textContent = msg;
    document.getElementById('confirmModal').classList.add('open');
    confirmCB = cb;
  };
  document.getElementById('confirmYes').addEventListener('click', () => {
    document.getElementById('confirmModal').classList.remove('open');
    if (confirmCB) confirmCB();
  });

  // ---------- prompt modal ----------
  let promptCB = null;
  const askPrompt = (msg, max, cb) => {
    document.getElementById('promptMsg').textContent = msg;
    const inp = document.getElementById('promptInput');
    inp.max = max; inp.value = max;
    document.getElementById('promptModal').classList.add('open');
    inp.focus();
    promptCB = cb;
  };
  document.getElementById('promptYes').addEventListener('click', () => {
    document.getElementById('promptModal').classList.remove('open');
    const val = parseInt(document.getElementById('promptInput').value, 10);
    if (promptCB) promptCB(val);
  });

  // ---------- kanban / calendar bindings ----------
  Kanban.bind({
    cardClick: (id) => openTaskModal(id),
    move: (id, newLoc) => {
      const t = Storage.get(id);
      if (!t || t.localizacao === newLoc) return;

      const qty = parseInt(t.quantidade, 10);
      
      const executeMove = (movedQty) => {
        const all = Storage.all();
        const existing = all.find(x => x.numero === t.numero && x.localizacao === newLoc && x.id !== id);

        if (movedQty < qty) {
          Storage.update(id, { quantidade: qty - movedQty });
          if (existing) {
            Storage.update(existing.id, { quantidade: parseInt(existing.quantidade||0, 10) + movedQty });
          } else {
            const copy = { ...t, quantidade: movedQty, localizacao: newLoc, tsLocalizacao: new Date().toISOString() };
            delete copy.id;
            const nova = Storage.create(copy);
            // Explicitly push history for the newly created split
            const user = Storage.currentUser ? Storage.currentUser.nome : 'Alguém';
            nova.historico.push({ ts: new Date().toISOString(), texto: `${user} separou ${movedQty} un. para "${newLoc}"` });
            Storage.update(nova.id, { historico: nova.historico });
          }
          Utils.toast(`Fracionado ${movedQty} un para "${newLoc}"`);
        } else {
          if (existing) {
            Storage.update(existing.id, { quantidade: parseInt(existing.quantidade||0, 10) + (qty || 0) });
            Storage.remove(id);
          } else {
            Storage.update(id, { localizacao: newLoc });
          }
          Utils.toast(`Movida para "${newLoc}"`);
        }
        refresh();
      };

      if (!isNaN(qty) && qty > 1) {
        askPrompt(`Quantos itens mover para ${newLoc}? (Total: ${qty})`, qty, (val) => {
          if (val && val > 0 && val <= qty) executeMove(val);
        });
      } else {
        executeMove(qty || 1);
      }
    }
  });
  CalendarView.bind({ itemClick: (id) => openTaskModal(id) });
  document.getElementById('calPrev').addEventListener('click', () => { CalendarView.prev(); refresh(); });
  document.getElementById('calNext').addEventListener('click', () => { CalendarView.next(); refresh(); });
  document.getElementById('calToday').addEventListener('click', () => { CalendarView.today(); refresh(); });

  // ---------- exportar / importar / imprimir ----------
  document.getElementById('btnExport').addEventListener('click', () => {
    const tasks = Storage.all();
    const cols = ['numero','cliente','descricao','prioridade','responsavel','dataInicio','prazo',
                  'localizacao','dataProducao','dataEmbalagem','situacao','observacoes'];
    const esc = (v) => `"${String(v||'').replace(/"/g,'""').replace(/\n/g,' ')}"`;
    const csv = [cols.join(';')].concat(tasks.map(t => cols.map(c => esc(t[c])).join(';'))).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tarefas-${Utils.todayISO()}.csv`; a.click();
    Utils.toast('CSV exportado');
  });
  document.getElementById('btnImport').addEventListener('click', () => document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!Array.isArray(data)) throw 0;
        askConfirm(`Substituir ${Storage.all().length} tarefa(s) por ${data.length} do arquivo?`, () => {
          Storage.replaceAll(data); refresh(); Utils.toast('Importado com sucesso');
        });
      } catch { Utils.toast('Arquivo inválido'); }
    };
    r.readAsText(file); e.target.value = '';
  });
  document.getElementById('btnPrint').addEventListener('click', () => window.print());

  // ---------- menu mobile ----------
  document.getElementById('btnMenu').addEventListener('click', () =>
    document.querySelector('.sidebar').classList.toggle('open'));

  // ---------- bootstrap ----------
  refresh();
})();
