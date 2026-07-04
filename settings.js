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
        ${u.role !== 'admin' ? `<button class="icon-btn" style="color:var(--red)" onclick="Settings.delUser('${u.id}')"><i class="fa-solid fa-trash"></i></button>` : ''}
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

  // ----- COLUMNS -----
  const renderCols = () => {
    const list = document.getElementById('colsList');
    list.innerHTML = Storage.columns.all().map(c => `
      <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg); padding:10px; border-radius:6px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <input type="color" class="col-color-picker" value="${c.color || '#888888'}" onchange="Settings.updateColColor('${c.id}', this.value)" style="width:20px; height:20px; cursor:pointer;" title="Mudar cor" />
          <strong>${Utils.escapeHtml(c.id)}</strong>
        </div>
        <button class="icon-btn" style="color:var(--red)" onclick="Settings.delCol('${c.id}')"><i class="fa-solid fa-trash"></i></button>
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

  const updateColColor = (id, color) => {
    let cols = Storage.columns.all();
    const c = cols.find(c => c.id === id);
    if (c) {
      c.color = color;
      Storage.columns.save(cols);
      if (window.Kanban && typeof Kanban.refresh === 'function') Kanban.refresh();
    }
  };

  return { init, delUser, delCol, updateColColor, renderCols };
})();

document.addEventListener('DOMContentLoaded', Settings.init);
