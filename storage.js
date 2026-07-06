/* storage.js — Persistência Supabase (Local-First Architecture)
   O sistema mantém um cache em memória para a UI continuar sendo renderizada a 0ms (instantânea).
   Todas as mutações são aplicadas no cache (Optimistic UI) e sincronizadas com o Supabase em background.
*/
const Storage = (() => {
  const supabaseUrl = 'https://mwwirolecwwxookttkfi.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13d2lyb2xlY3d3eG9va3R0a2ZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNjIwMzgsImV4cCI6MjA5ODYzODAzOH0.ZUL4aiQ7BXjrcWKuhE4eWEfyiE_9Kfyv2TepEX5GBnI';
  
  // A library já está injetada pelo script do CDN no HTML (window.supabase)
  const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
  window.supabaseClient = supabase; // Exporta a instância para o chat.service.js

  let cache = [];
  let usersCache = [];
  let currentUser = null;
  let columnsCache = [];
  

  // Inicializa os dados puxando da nuvem
  const init = async () => {
    try {
      const [tasksRes, usersRes, colsRes] = await Promise.all([
        supabase.from('sgp_tasks').select('*'),
        supabase.from('sgp_users').select('*'),
        supabase.from('sgp_columns').select('*').order('ordem')
      ]);

      if (tasksRes.error) alert('Erro tarefas: ' + tasksRes.error.message);
      if (usersRes.error) alert('Erro usuários: ' + usersRes.error.message);

      if (tasksRes.data) cache = tasksRes.data.map(t => t.data);
      if (usersRes.data) usersCache = usersRes.data;
      if (colsRes.data) columnsCache = colsRes.data;

      // Inicia as inscrições em tempo real para sincronizar abas e computadores diferentes
      supabase.channel('public:sgp_tasks')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sgp_tasks' }, payload => {
          if (payload.eventType === 'INSERT') {
            if (!cache.find(t => t.id === payload.new.id)) cache.unshift(payload.new.data);
          } else if (payload.eventType === 'UPDATE') {
            const idx = cache.findIndex(t => t.id === payload.new.id);
            if (idx >= 0) cache[idx] = payload.new.data;
            else cache.unshift(payload.new.data);
          } else if (payload.eventType === 'DELETE') {
            cache = cache.filter(t => t.id !== payload.old.id);
          }
          if (window.refresh) window.refresh();
        })
        .subscribe();
        
    } catch (e) {
      console.error("Erro ao conectar no Supabase:", e);
    }
  };

  const users = {
    all: () => usersCache,
    save: async (list) => {
      usersCache = list;
      const upserts = list.map(u => ({ id: u.id, nome: u.nome, pin: u.pin, role: u.role }));
      await supabase.from('sgp_users').upsert(upserts);
    }
  };

  const columns = {
    all: () => columnsCache,
    save: async (list) => {
      columnsCache = list;
      const upserts = list.map((c, i) => ({ id: c.id, color: c.color || '', ordem: i }));
      await supabase.from('sgp_columns').upsert(upserts);
    }
  };

  const all = () => cache;
  const get = (id) => cache.find(t => t.id === id);

  const create = (data) => {
    const now = new Date().toISOString();
    const task = {
      id: Utils.uid(),
      numero: '', cliente: '', fluxo: '', descricao: '', pedido: '',
      quantidade: '', produtos: '', prioridade: 'Alta', responsavel: '',
      dataCriacao: now, dataInicio: '', prazo: '', localizacao: '',
      dataProducao: '', dataEmbalagem: '', situacao: 'Não iniciada',
      anotacoes: [], ocorrencias: [], tsLocalizacao: now,
      historico: [{ ts: now, texto: 'Tarefa criada' }],
      ...data,
    };
    
    cache.unshift(task); // Aplica instantaneamente na tela
    supabase.from('sgp_tasks').insert({ id: task.id, data: task }).then(); // Dispara pra nuvem em background
    return task;
  };

  const update = (id, data) => {
    const i = cache.findIndex(t => t.id === id);
    if (i < 0) return null;
    const before = cache[i];
    const hist = before.historico ? [...before.historico] : [];
    const now = new Date().toISOString();

    const trackFields = { responsavel: 'Responsável', prazo: 'Prazo', situacao: 'Situação', prioridade: 'Prioridade', localizacao: 'Localização', quantidade: 'Quantidade' };
    for (const k in trackFields) {
      if (data[k] !== undefined && data[k] !== before[k]) {
        let msg = `${trackFields[k]} alterado(a): "${before[k] || '—'}" → "${data[k] || '—'}"`;
        if (k === 'localizacao') {
          const user = currentUser ? currentUser.nome : 'Alguém';
          const qty = data.quantidade || before.quantidade || 1;
          msg = `${user} moveu ${qty} un. para "${data[k]}"`;
          data.tsLocalizacao = now;
        }
        hist.push({ ts: now, texto: msg });
      }
    }
    if (data.situacao === 'Concluída' && before.situacao !== 'Concluída') hist.push({ ts: now, texto: 'Tarefa concluída' });
    
    cache[i] = { ...before, ...data, historico: hist };
    
    // Dispara pra nuvem
    supabase.from('sgp_tasks').update({ data: cache[i] }).eq('id', id).then();
    return cache[i];
  };

  const remove = (id) => {
    cache = cache.filter(t => t.id !== id);
    supabase.from('sgp_tasks').delete().eq('id', id).then();
  };

  const duplicate = (id) => {
    const t = get(id); if (!t) return null;
    const copy = JSON.parse(JSON.stringify(t));
    copy.numero = (copy.numero || '') + ' (cópia)';
    copy.situacao = 'Não iniciada';
    copy.dataProducao = ''; copy.dataEmbalagem = '';
    delete copy.id;
    return create(copy);
  };
  
  const addOcorrencia = (id, texto) => {
    const t = get(id); if (!t) return null;
    const ocorrencias = [...(t.ocorrencias || [])];
    ocorrencias.unshift({ ts: new Date().toISOString(), usuario: currentUser ? currentUser.nome : 'Você', texto });
    const historico = [...(t.historico || [])];
    historico.push({ ts: new Date().toISOString(), texto: `Ocorrência registrada: "${texto.slice(0,60)}${texto.length>60?'…':''}"` });
    return update(id, { ocorrencias, historico });
  };

  const addAnotacao = (id, texto) => {
    const t = get(id); if (!t) return null;
    const anotacoes = [...(t.anotacoes || [])];
    anotacoes.push({ ts: new Date().toISOString(), usuario: currentUser ? currentUser.nome : 'Você', texto });
    return update(id, { anotacoes });
  };

  const replaceAll = async (list) => {
    cache = list;
    // Cuidado: apaga tudo que não for 'dummy' (ou seja, apaga a tabela inteira e insere por cima)
    await supabase.from('sgp_tasks').delete().neq('id', 'dummy'); 
    
    const chunked = [];
    for(let i=0; i<list.length; i+=100) chunked.push(list.slice(i, i+100));
    
    for (const chunk of chunked) {
       await supabase.from('sgp_tasks').insert(chunk.map(t => ({ id: t.id, data: t })));
    }
  };

  const uploadFile = async (file) => {
    const ext = file.name.split('.').pop();
    const fileName = `${Utils.uid()}.${ext}`;
    const { data, error } = await supabase.storage.from('anexos').upload(fileName, file, { cacheControl: '3600', upsert: false });
    if (error) {
      console.error('Erro no upload', error);
      return null;
    }
    const { data: publicData } = supabase.storage.from('anexos').getPublicUrl(fileName);
    return { url: publicData.publicUrl, name: file.name, path: fileName };
  };

  const deleteFile = async (path) => {
    await supabase.storage.from('anexos').remove([path]);
  };

  return { init, all, get, create, update, remove, duplicate, addOcorrencia, addAnotacao, replaceAll,
           users, columns, uploadFile, deleteFile };
})();
