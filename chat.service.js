/* chat.service.js — Camada de acesso a dados (Supabase) para o Chat */
const ChatService = (() => {
  // Reutilizamos a instância global do Supabase criada no storage.js
  const getDb = () => {
    if (!window.supabaseClient) throw new Error('Supabase cliente não encontrado');
    return window.supabaseClient;
  };
  
  let activeChannel = null;

  // --- Operadores ---
  // Busca a conversa ativa do operador, ou cria uma nova se não existir
  const loadOperatorConversation = async (operatorId) => {
    const db = getDb();
    
    // Tenta achar conversa 'open' ou 'attending'
    let { data, error } = await db.from('sgp_chat_conversations')
                                  .select('*')
                                  .eq('operator_id', operatorId)
                                  .in('status', ['open', 'attending'])
                                  .order('created_at', { ascending: false })
                                  .limit(1)
                                  .maybeSingle();
    
    if (error) alert('Erro ao buscar conversa: ' + error.message);
    
    if (!data) {
      // Cria nova conversa
      const res = await db.from('sgp_chat_conversations').insert({
        operator_id: operatorId,
        status: 'open',
        priority: 'normal'
      }).select().single();
      
      if (res.error) alert('Erro ao criar conversa: ' + res.error.message);
      data = res.data;
      
      await logEvent(data.id, operatorId, 'created', { source: 'operator_init' });
    }
    
    return data;
  };

  // --- Admins ---
  // Busca todas as conversas ativas
  const loadConversations = async (statusFilter = ['open', 'attending']) => {
    const db = getDb();
    const { data } = await db.from('sgp_chat_conversations')
                             .select(`
                               *,
                               operator:sgp_users!sgp_chat_conversations_operator_id_fkey(nome)
                             `)
                             .in('status', statusFilter)
                             .order('updated_at', { ascending: false });
    return data || [];
  };

  // --- Mensagens ---
  const getMessages = async (conversationId) => {
    const db = getDb();
    const { data } = await db.from('sgp_chat_messages')
                             .select('*')
                             .eq('conversation_id', conversationId)
                             .order('created_at', { ascending: true });
    return data || [];
  };

  const sendMessage = async (conversationId, content, messageType = 'text') => {
    const db = getDb();
    const user = Storage.currentUser; 
    if (!user) return null;
    
    const role = user.role || 'operator';
    
    const payload = {
      conversation_id: conversationId,
      sender_id: user.id,
      sender_name: user.nome,
      sender_role: role,
      content,
      message_type: messageType
    };
    
    const res = await db.from('sgp_chat_messages').insert(payload).select().single();
    if (res.error) alert('Erro ao enviar mensagem: ' + res.error.message);
    const msg = res.data;
    
    const { data: conv } = await db.from('sgp_chat_conversations').select('admin_unread_count, operator_unread_count').eq('id', conversationId).single();
    
    // Atualiza a conversa com a última mensagem e incrementa o contador respectivo
    const updates = {
      last_message: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    if (conv) {
      if (role === 'admin') {
        updates.operator_unread_count = (conv.operator_unread_count || 0) + 1;
      } else {
        updates.admin_unread_count = (conv.admin_unread_count || 0) + 1;
      }
    }
    
    await db.from('sgp_chat_conversations').update(updates).eq('id', conversationId);
    return msg;
  };

  const markAsRead = async (conversationId, userRole) => {
    const db = getDb();
    const updates = {};
    if (userRole === 'admin') updates.admin_unread_count = 0;
    else updates.operator_unread_count = 0;
    
    await db.from('sgp_chat_conversations').update(updates).eq('id', conversationId);
  };

  // --- Auditoria / Eventos ---
  const logEvent = async (conversationId, actorId, type, data = {}) => {
    await getDb().from('sgp_chat_events').insert({
      conversation_id: conversationId,
      actor_id: actorId,
      event_type: type,
      event_data: data
    });
  };

  const changeStatus = async (conversationId, newStatus, adminId = null) => {
    const db = getDb();
    const updates = { status: newStatus, updated_at: new Date().toISOString() };
    if (adminId && newStatus === 'attending') updates.assigned_admin_id = adminId;
    if (newStatus === 'resolved') updates.resolved_at = new Date().toISOString();
    
    await db.from('sgp_chat_conversations').update(updates).eq('id', conversationId);
    await logEvent(conversationId, Storage.currentUser?.id, 'status_changed', { new_status: newStatus });
  };

  // --- Realtime ---
  const subscribe = (callbacks) => {
    const db = getDb();
    if (!db) return;
    
    activeChannel = db.channel('chat_service')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sgp_chat_messages' }, payload => {
        if (callbacks.onMessage) callbacks.onMessage(payload.new);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sgp_chat_conversations' }, payload => {
        if (callbacks.onConversation) callbacks.onConversation(payload.new);
      })
      .subscribe();
  };
  
  const unsubscribe = () => {
    if (activeChannel) {
      getDb().removeChannel(activeChannel);
      activeChannel = null;
    }
  };

  return {
    loadOperatorConversation,
    loadConversations,
    getMessages,
    sendMessage,
    changeStatus,
    markAsRead,
    subscribe,
    unsubscribe
  };
})();
