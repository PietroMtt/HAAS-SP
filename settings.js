const Settings = (() => {
  const init = () => {
    document.getElementById('btnAddUser').addEventListener('click', addUser);
    document.getElementById('btnAddCol').addEventListener('click', addCol);
    renderUsers();
    renderCols();
  };

  // ----- USERS -----
  const renderUsers = () => {
    const list = document.getElementById('usersList');
    list.innerHTML = Storage.users.all().map(u => `
      <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg); padding:10px; border-radius:6px;">
        <div>
          <strong style="margin-right:10px;">${Utils.escapeHtml(u.nome)}</strong>
          <span style="color:var(--muted); font-family:monospace; background:var(--surface-2); padding:2px 6px; border-radius:4px;">PIN: ${Utils.escapeHtml(u.pin)}</span>
          ${u.role === 'admin' ? '<span style="margin-left:10px; color:var(--orange); font-size:12px;">ADMIN</span>' : ''}
        </div>
        ${u.role !== 'admin' ? `
          <div style="display:flex; gap:8px;">
            <button class="icon-btn" style="color:var(--primary)" onclick="Settings.editUser('${u.id}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
            <button class="icon-btn" style="color:var(--red)" onclick="Settings.delUser('${u.id}')" title="Excluir"><i class="fa-solid fa-trash"></i></button>
          </div>
        ` : ''}
      </div>
    `).join('');
  };

  const addUser = () => {
    const nomeInp = document.getElementById('newUserName');
    const pinInp = document.getElementById('newUserPin');
    const nome = nomeInp.value.trim();
    const pin = pinInp.value.trim();
    if (!nome || !pin) return Utils.toast('Preencha nome e PIN', 'error');
    if (pin.length !== 2) return Utils.toast('O PIN deve ter exatamente 2 dígitos', 'error');
    
    const users = Storage.users.all();
    if (users.some(u => u.pin === pin)) return Utils.toast('Esse PIN já está em uso', 'error');

    users.push({ id: Utils.uid(), nome, pin, role: 'user' });
    Storage.users.save(users);
    
    nomeInp.value = ''; pinInp.value = '';
    renderUsers();
    Utils.toast('Usuário adicionado');
  };

  const delUser = (id) => {
    let users = Storage.users.all();
    users = users.filter(u => u.id !== id);
    Storage.users.save(users);
    renderUsers();
  };

  const editUser = (id) => {
    let users = Storage.users.all();
    const u = users.find(x => x.id === id);
    if (!u) return;
    const newName = prompt('Novo nome para o operador:', u.nome);
    if (!newName) return;
    const newPin = prompt('Novo PIN (2 dígitos):', u.pin);
    if (!newPin || newPin.length !== 2) return Utils.toast('PIN inválido (deve ter 2 dígitos)', 'error');
    if (newPin !== u.pin && users.some(x => x.pin === newPin)) return Utils.toast('Esse PIN já está em uso', 'error');
    
    u.nome = newName.trim();
    u.pin = newPin.trim();
    Storage.users.save(users);
    renderUsers();
    Utils.toast('Operador atualizado com sucesso');
  };

  // ----- COLUMNS -----
  const renderCols = () => {
    const list = document.getElementById('colsList');
    list.innerHTML = Storage.columns.all().map(c => `
      <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg); padding:10px; border-radius:6px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <input type="color" class="col-color-picker" value="${c.color || '#888888'}" onchange="Settings.updateColColor('${c.id}', this.value)" style="width:20px; height:20px; cursor:pointer;" title="Mudar cor" />
          <strong>${Utils.escapeHtml(c.id)}</strong>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="icon-btn" style="color:var(--primary)" onclick="Settings.editCol('${c.id}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
          <button class="icon-btn" style="color:var(--red)" onclick="Settings.delCol('${c.id}')" title="Excluir"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `).join('');
    
    // Also notify kanban to re-render if it's visible
    if (window.Kanban && typeof Kanban.refresh === 'function') Kanban.refresh();
  };

  const addCol = () => {
    const inp = document.getElementById('newColName');
    const nome = inp.value.trim();
    if (!nome) return;
    
    const cols = Storage.columns.all();
    if (cols.some(c => c.id.toLowerCase() === nome.toLowerCase())) return Utils.toast('Coluna já existe', 'error');

    cols.push({ id: nome });
    Storage.columns.save(cols);
    inp.value = '';
    renderCols();
    Utils.toast('Coluna adicionada');
  };

  const delCol = (id) => {
    let cols = Storage.columns.all();
    cols = cols.filter(c => c.id !== id);
    Storage.columns.save(cols);
    renderCols();
  };

  const editCol = async (id) => {
    let cols = Storage.columns.all();
    const c = cols.find(x => x.id === id);
    if (!c) return;
    
    const newName = prompt('Novo nome para a coluna (Isso atualizará todas as tarefas nela):', c.id);
    if (!newName) return;
    const cleanName = newName.trim();
    if (cleanName === c.id) return;
    if (cols.some(x => x.id.toLowerCase() === cleanName.toLowerCase())) return Utils.toast('Coluna já existe', 'error');

    // 1. Atualizar as tarefas que estavam nessa coluna
    const tasks = Storage.all();
    let tasksChanged = 0;
    for (let t of tasks) {
      if (t.situacao === c.id) {
        Storage.update(t.id, { situacao: cleanName });
        tasksChanged++;
      }
    }

    // 2. Deletar a coluna antiga no banco (se estiver online)
    if (window.supabaseClient) {
      await window.supabaseClient.from('sgp_columns').delete().eq('id', c.id);
    }
    
    // 3. Atualizar e salvar
    c.id = cleanName;
    await Storage.columns.save(cols);
    
    renderCols();
    if (window.Kanban && typeof Kanban.refresh === 'function') Kanban.refresh();
    Utils.toast(`Coluna alterada! ${tasksChanged} tarefas movidas.`);
  };

  const updateColColor = (id, color) => {
    let cols = Storage.columns.all();
    const c = cols.find(c => c.id === id);
    if (c) {
      c.color = color;
      Storage.columns.save(cols);
      if (window.Kanban && typeof Kanban.refresh === 'function') Kanban.refresh();
    }
  };

  return { init, delUser, editUser, delCol, editCol, updateColColor, renderCols, renderUsers };
})();

document.addEventListener('DOMContentLoaded', Settings.init);
