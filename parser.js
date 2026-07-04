window.Parser = {
  extract(text) {
    if (!text) return null;
    
    const result = {
      numero: '', cliente: '', fluxo: '', pedido: '', descricao: '',
      produtos: [], acessorios: []
    };

    // Replace multiple spaces with single space for easier regex, but preserve newlines
    const t = text.replace(/ {2,}/g, ' ');

    // 1. Número da OS
    // Usually an 8 digit number standing alone, e.g. "14358414"
    const numMatch = t.match(/\b(14\d{6})\b/);
    if (numMatch) result.numero = `OS ${numMatch[1]}`;

    // 2. Cliente (Setor)
    const setorMatch = t.match(/Setor:\s*(.*?)(?:Fone:|$|\n)/i);
    if (setorMatch) result.cliente = setorMatch[1].trim();

    // 3. Descrição completa (Problema -> vai virar anotação)
    // From "Problema :" down to "CÓDIGO"
    const probMatch = t.match(/Problema\s*:\s*([\s\S]*?)CÓDIGO/i);
    if (probMatch) {
      result.checklistCompleto = probMatch[1].trim();
      
      // 4. Fluxo e Pedido (extraídos de dentro da descrição/problema)
      const fluxoMatch = result.checklistCompleto.match(/FLUXO:\s*(\d+)/i);
      if (fluxoMatch) result.fluxo = fluxoMatch[1];
      
      const pedidoMatch = result.checklistCompleto.match(/PEDIDO:\s*([\d,\s]+)/i);
      if (pedidoMatch) result.pedido = pedidoMatch[1].trim();
    }

    // 5. Produtos (Tabela inferior)
    // Text between "USADO S" and "DESCRIÇÃO DOS SERVIÇOS:"
    const tableMatch = t.match(/USADO\s+S([\s\S]*?)DESCRIÇÃO\s+DOS\s+SERVIÇOS:/i);
    if (tableMatch) {
      const tableText = tableMatch[1];
      // Split by checkboxes "[ ] [ ]"
      const chunks = tableText.split(/\[\s*\]\s*\[\s*\]/);
      
      chunks.forEach(chunk => {
        chunk = chunk.trim();
        if (!chunk) return;
        
        // The last word is the quantity
        const words = chunk.split(/\s+/);
        const qtyStr = words.pop();
        let qty = parseInt(qtyStr, 10);
        if (isNaN(qty)) {
          // Fallback if split didn't work perfectly
          qty = 1; 
          words.push(qtyStr);
        }
        
        const desc = words.join(' ').replace(/^ME\d+[A-Z]*\s+/, '').replace(/\s+ME\d+[A-Z]*$/, '').trim();
        if (!desc) return;
        
        const isPai = /SERVIDOR|MICRO\sCOMPUTADOR|DESK|DESKTOP|NOTEBOOK|MONITOR|CPU/i.test(desc);
        const item = { nome: desc, qtd: qty, pai: isPai };
        
        if (isPai) result.produtos.push(item);
        else result.acessorios.push(item);
      });
    }

    // Fallback if table parsing fails but we have "05 UNIDADES CPU..." in description
    if (result.produtos.length === 0 && result.checklistCompleto) {
      // Extract multiple primary products (Pais) and grab their full text until another product/accessory or asterisk starts
      const regexPais = /(\d+)\s*(?:UNIDADES?|UN)?\s*((?:CPU|DESK|MONITOR|NOTEBOOK|SERVIDOR).*?)(?=\s*(?:\d+\s*(?:TECLADO|MOUSE|MOUSES|CABO|FONTE|UNIDADES?|UN|CPU|DESK|MONITOR|NOTEBOOK|SERVIDOR)|\*|$))/gi;
      const paisMatches = [...result.checklistCompleto.matchAll(regexPais)];
      
      if (paisMatches.length > 0) {
        paisMatches.forEach(m => {
          result.produtos.push({ nome: m[2].trim(), qtd: parseInt(m[1], 10), pai: true });
        });
      }
      
      // Tentativa de puxar acessórios do texto da OS
      const regexAcc = /(\d+)\s*(TECLADO|MOUSE|MOUSES|CABO)[A-Z\s]*/gi;
      const acessorios = [...result.checklistCompleto.matchAll(regexAcc)];
      if (acessorios.length > 0) {
        acessorios.forEach(m => {
          result.acessorios.push({ nome: m[2].trim(), qtd: parseInt(m[1], 10), pai: false });
        });
      }
      
      // Busca a FONTE em todo o documento e extrai a quantidade exata antes da caixa [ ] ou próximo item
      const fonteMatch = t.match(/FONTE.{0,100}?\b(\d{1,3})\b\s*(?:\[|ME\d+|$)/i);
      if (fonteMatch) {
         const qty = parseInt(fonteMatch[1], 10);
         
         // Só adiciona se já não tiver no array (pra não duplicar caso venha no checklist)
         if (!result.acessorios.find(a => a.nome.toUpperCase().includes('FONTE'))) {
           result.acessorios.push({ nome: 'FONTE', qtd: qty, pai: false });
         }
      }
    }

    return result;
  }
};
