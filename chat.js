/* chat.js — Camada de interface visual do Chat */
const Chat = (() => {
  let currentConversationId = null;
  
  // --- UI Elements ---
  const fab = document.getElementById('chat-fab');
  const popup = document.getElementById('chat-popup');
  const popupClose = document.getElementById('chat-popup-close');
  const popupBody = document.getElementById('chatPopupBody');
  const popupInput = document.getElementById('chatPopupInput');
  const popupSend = document.getElementById('chatPopupSend');
  const badge = document.getElementById('chat-fab-badge');

  const adminList = document.getElementById('chatAdminList');
  const adminMain = document.getElementById('chatAdminMain');

  const init = async () => {
    const user = Storage.currentUser;
    if (!user) return;

    // Se é operador, prepara o botão flutuante e popup
    if (user.role !== 'admin') {
      fab.style.display = 'flex';
      
      fab.addEventListener('click', async () => {
        popup.style.display = 'flex';
        fab.style.display = 'none';
        await loadOperatorChat();
      });

      popupClose.addEventListener('click', () => {
        popup.style.display = 'none';
        fab.style.display = 'flex';
      });

      popupSend.addEventListener('click', () => sendOperatorMessage());
      popupInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendOperatorMessage();
      });

      // Carrega no background para pegar unread counts e a ID
      try {
        const conv = await ChatService.loadOperatorConversation(user.id);
        if (conv) {
          currentConversationId = conv.id;
          if (conv.operator_unread_count > 0) {
            badge.style.display = 'flex';
            badge.textContent = conv.operator_unread_count;
          }
        } else {
          console.error("Falha ao carregar conversa, conv é nulo");
        }
      } catch (e) {
        alert("Erro fatal ao iniciar chat: " + e.message);
      }
      
    } else {
      // É admin, escuta a aba admin e inicializa o badge
      fab.style.display = 'none';
      
      // Carrega no background para atualizar o badge inicial
      ChatService.loadConversations().then(convs => {
        updateAdminBadge(convs);
      });
      
      document.getElementById('nav-chat-admin').addEventListener('click', () => {
        loadAdminConversations();
      });
    }

    // Subscribe para eventos globais do Chat
    ChatService.subscribe({
      onMessage: (msg) => handleNewMessage(msg),
      onConversation: (conv) => handleConversationUpdate(conv)
    });
  };

  const loadOperatorChat = async () => {
    if (!currentConversationId) return;
    badge.style.display = 'none';
    badge.textContent = '0';
    await ChatService.markAsRead(currentConversationId, 'operator');
    
    const msgs = await ChatService.getMessages(currentConversationId);
    renderMessages(msgs, popupBody);
    setTimeout(() => popupBody.scrollTop = popupBody.scrollHeight, 100);
  };

  const sendOperatorMessage = async () => {
    const text = popupInput.value.trim();
    if (!text) return;
    if (!currentConversationId) {
        alert('Erro: ID da conversa não foi carregado. Atualize a página e tente novamente.');
        return;
    }
    popupInput.value = '';
    
    // Optimistic render
    appendMessage({
      sender_id: Storage.currentUser.id,
      sender_name: Storage.currentUser.nome,
      content: text,
      created_at: new Date().toISOString()
    }, popupBody);

    await ChatService.sendMessage(currentConversationId, text);
  };

  const renderMessages = (messages, container) => {
    container.innerHTML = '';
    messages.forEach(msg => appendMessage(msg, container));
  };

  const appendMessage = (msg, container) => {
    const user = Storage.currentUser;
    const isMe = msg.sender_id === user.id;
    
    const div = document.createElement('div');
    div.className = `chat-msg ${isMe ? 'chat-msg-me' : 'chat-msg-them'}`;
    
    const time = new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    div.innerHTML = `
      <div class="chat-msg-sender">${isMe ? 'Você' : msg.sender_name}</div>
      <div class="chat-msg-bubble">${msg.content}</div>
      <div class="chat-msg-time">${time}</div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  };

  // --- Handlers em Tempo Real ---
  const handleNewMessage = (msg) => {
    const user = Storage.currentUser;
    if (!user) return;
    
    // Ignorar se a mensagem fui eu que mandei (o render otimista já colocou na tela)
    if (msg.sender_id === user.id) return;

    // Se sou operador e a mensagem é da minha conversa
    if (user.role !== 'admin' && msg.conversation_id === currentConversationId) {
      if (popup.style.display !== 'none') {
        appendMessage(msg, popupBody);
        ChatService.markAsRead(currentConversationId, 'operator');
      } else {
        // Incrementa badge
        badge.style.display = 'flex';
        badge.textContent = parseInt(badge.textContent || 0) + 1;
        Utils.toast(`Nova mensagem de ${msg.sender_name}`);
      }
    } 
    // Se sou admin e estou na tela daquela conversa
    else if (user.role === 'admin' && msg.conversation_id === currentConversationId) {
      const adminChatBody = document.getElementById('adminChatBody');
      if (adminChatBody) appendMessage(msg, adminChatBody);
      ChatService.markAsRead(currentConversationId, 'admin');
      loadAdminConversations(); // recarrega a lateral
    } 
    // Sou admin e chegou mensagem de outra conversa
    else if (user.role === 'admin') {
      Utils.toast(`Nova mensagem: ${msg.sender_name}`);
      loadAdminConversations();
    }
  };

  const handleConversationUpdate = (conv) => {
    // Pode ser usado para atualizar o status ao vivo na tela
    if (Storage.currentUser?.role === 'admin') {
      loadAdminConversations();
    }
  };

  const updateAdminBadge = (convs) => {
    const totalUnread = convs.reduce((sum, c) => sum + (c.admin_unread_count || 0), 0);
    let navItem = document.getElementById('nav-chat-admin');
    if (!navItem) return;
    
    let badgeSpan = navItem.querySelector('.admin-nav-badge');
    if (!badgeSpan) {
      badgeSpan = document.createElement('span');
      badgeSpan.className = 'admin-nav-badge chat-badge';
      badgeSpan.style.position = 'relative';
      badgeSpan.style.top = '0';
      badgeSpan.style.right = '0';
      badgeSpan.style.marginLeft = '8px';
      navItem.appendChild(badgeSpan);
    }
    
    if (totalUnread > 0) {
      badgeSpan.style.display = 'inline-flex';
      badgeSpan.textContent = totalUnread;
    } else {
      badgeSpan.style.display = 'none';
    }
  };

  // --- Tela de Admin ---
  const loadAdminConversations = async () => {
    const convs = await ChatService.loadConversations();
    adminList.innerHTML = '';
    
    updateAdminBadge(convs);
    
    if (convs.length === 0) {
      adminList.innerHTML = '<div style="padding:15px; color:var(--text-muted);">Nenhuma conversa aberta.</div>';
      return;
    }

    convs.forEach(c => {
      const div = document.createElement('div');
      div.className = `chat-admin-item ${currentConversationId === c.id ? 'active' : ''}`;
      
      const statusIcon = c.status === 'open' ? '🔴' : (c.status === 'attending' ? '🟢' : '✔');
      const time = c.last_message_at ? new Date(c.last_message_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '';
      
      const unreadBadge = c.admin_unread_count > 0 ? `<span class="chat-badge" style="position:relative; top:0; right:0; margin-left:5px; display:inline-flex;">${c.admin_unread_count}</span>` : '';
      
      div.innerHTML = `
        <div class="chat-admin-item-header">
          <strong>${statusIcon} ${c.operator?.nome || 'Operador'} ${unreadBadge}</strong>
          <span>${time}</span>
        </div>
        <div class="chat-admin-item-msg">${c.last_message || 'Nova conversa...'}</div>
      `;
      
      div.addEventListener('click', () => openAdminConversation(c));
      adminList.appendChild(div);
    });
  };

  const openAdminConversation = async (conv) => {
    currentConversationId = conv.id;
    
    // Se estava aberta, vira attending
    if (conv.status === 'open') {
      await ChatService.changeStatus(conv.id, 'attending', Storage.currentUser.id);
      conv.status = 'attending';
    }

    await ChatService.markAsRead(conv.id, 'admin');
    loadAdminConversations(); // recarrega lateral e recalcula badge
    
    adminMain.innerHTML = `
      <div class="admin-chat-header">
        <h3>Atendendo: ${conv.operator.nome}</h3>
        <button id="btnResolveChat" class="btn btn-sm btn-success">✔ Marcar Resolvido</button>
      </div>
      <div class="admin-chat-body" id="adminChatBody"></div>
      <div class="admin-chat-footer">
        <input type="text" id="adminChatInput" placeholder="Digite a resposta..." autocomplete="off"/>
        <button id="adminChatSend" class="btn btn-primary"><i class="fa-solid fa-paper-plane"></i> Enviar</button>
      </div>
    `;

    document.getElementById('btnResolveChat').addEventListener('click', async () => {
      await ChatService.changeStatus(conv.id, 'resolved');
      adminMain.innerHTML = '<div class="chat-empty-state">Conversa resolvida.</div>';
      currentConversationId = null;
      loadAdminConversations();
    });

    const msgs = await ChatService.getMessages(conv.id);
    const body = document.getElementById('adminChatBody');
    renderMessages(msgs, body);

    const input = document.getElementById('adminChatInput');
    const btnSend = document.getElementById('adminChatSend');
    
    const send = async () => {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      appendMessage({
        sender_id: Storage.currentUser.id,
        sender_name: Storage.currentUser.nome,
        content: text,
        created_at: new Date().toISOString()
      }, body);
      await ChatService.sendMessage(conv.id, text);
    };

    btnSend.addEventListener('click', send);
    input.addEventListener('keypress', e => { if (e.key === 'Enter') send(); });
  };

  return { init };
})();
