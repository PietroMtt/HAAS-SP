const Auth = (() => {
  let pinInput = '';
  
  const init = async () => {
    const layout = document.getElementById('appLayout');
    const loginScreen = document.getElementById('loginScreen');
    const pinDisplay = document.getElementById('pinDisplay');
    
    // Mostra status de carregando no login
    pinDisplay.textContent = 'CONECTANDO...';
    pinDisplay.style.fontSize = '16px';
    
    await Storage.init(); // Sincroniza com Supabase
    if (window.refresh) window.refresh(); // Atualiza a UI com os dados da nuvem
    
    pinDisplay.textContent = '_ _';
    pinDisplay.style.fontSize = '32px';

    const cachedUser = sessionStorage.getItem('sgp-current-user');
    if (cachedUser) {
      Storage.currentUser = (JSON.parse(cachedUser));
      loginScreen.style.display = 'none';
      layout.style.display = 'block';
      applyPermissions();
    }

    // Bind Numpad
    document.querySelectorAll('.num-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const val = e.currentTarget.dataset.val;
        if (val !== undefined) {
          if (pinInput.length < 4) pinInput += val;
          updateDisplay();
        }
      });
    });

    document.getElementById('btnClearPin').addEventListener('click', () => {
      pinInput = pinInput.slice(0, -1);
      updateDisplay();
    });

    document.getElementById('btnEnterPin').addEventListener('click', () => {
      login(pinInput);
    });

    const updateDisplay = () => {
      pinDisplay.textContent = pinInput.length > 0 ? pinInput.replace(/./g, '*') : '_ _';
    };
  };

  const login = (pin) => {
    const users = Storage.users.all();
    const user = users.find(u => u.pin === pin);
    
    if (user) {
      Storage.currentUser = (user);
      sessionStorage.setItem('sgp-current-user', JSON.stringify(user));
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('appLayout').style.display = 'block';
      applyPermissions();
      Utils.toast(`Bem-vindo(a), ${user.nome}!`);
      
      // Reset input for next time
      pinInput = '';
      document.getElementById('pinDisplay').textContent = '_ _';
    } else {
      Utils.toast('PIN incorreto', 'error');
      pinInput = '';
      document.getElementById('pinDisplay').textContent = '_ _';
    }
  };

  const logout = () => {
    Storage.currentUser = null;
    sessionStorage.removeItem('sgp-current-user');
    document.getElementById('appLayout').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
  };

  const applyPermissions = () => {
    const isUser = Storage.currentUser.role === 'operator';
    
    // Esconder botões de admin
    const adminBtns = document.querySelectorAll('#btnNewTask, #btnTheme, .admin-only'); // We'll add this to sidebar
    const btnNewTask = document.getElementById('btnNewTask');
    const user = Storage.currentUser;
    const sidebar = document.getElementById('sidebar');
    const settingsBtn = document.getElementById('nav-settings'); // We'll add this to sidebar

    if (user.role === 'admin') {
      sidebar.style.display = 'flex';
      document.body.classList.remove('operator-mode');
      if (settingsBtn) settingsBtn.style.display = 'flex';
      btnNewTask.style.display = 'inline-flex';
    } else {
      sidebar.style.display = 'none'; // Users only see Kanban
      document.body.classList.add('operator-mode');
      btnNewTask.style.display = 'none';
      // Force Kanban view
      document.querySelector('[data-view="kanban"]').click();
    }
    
    document.getElementById('btnFilterCols').style.display = 'inline-flex';
    
    // Inicia o Módulo de Chat
    if (typeof Chat !== 'undefined') Chat.init();
    
    // Refresh to apply read-only logic on tasks
    if (window.refresh) window.refresh();
  };

  return { init, logout };
})();

document.addEventListener('DOMContentLoaded', Auth.init);
