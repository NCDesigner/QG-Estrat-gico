
import React, { useState, useEffect, useRef } from 'react';
import { WarMapNode, WarMapConnection, NodeType, WarMapFolder, Message } from '../types';
import { storage } from '../services/storage';

interface DiaryViewProps {
  onNavigateToChat: (threadId: string, messageId?: string) => void;
}

const TYPE_CONFIG: Record<NodeType, { icon: string, label: string, color: string, border: string }> = {
  insight: { icon: '💡', label: 'Insight', color: 'bg-yellow-50 text-yellow-700', border: 'border-yellow-200' },
  tensao: { icon: '⚠️', label: 'Tensão', color: 'bg-red-50 text-red-700', border: 'border-red-200' },
  pergunta: { icon: '❓', label: 'Pergunta', color: 'bg-purple-50 text-purple-700', border: 'border-purple-200' },
  decisao: { icon: '⚖️', label: 'Decisão', color: 'bg-blue-50 text-blue-700', border: 'border-blue-200' },
  acao: { icon: '🚀', label: 'Ação', color: 'bg-green-50 text-green-700', border: 'border-green-200' },
  evidencia: { icon: '📊', label: 'Evidência', color: 'bg-teal-50 text-teal-700', border: 'border-teal-200' },
  anexo: { icon: '📎', label: 'Anexo', color: 'bg-gray-50 text-gray-700', border: 'border-gray-200' },
};

const DiaryView: React.FC<DiaryViewProps> = ({ onNavigateToChat }) => {
  const [nodes, setNodes] = useState<WarMapNode[]>([]);
  const [conns, setConns] = useState<WarMapConnection[]>([]);
  const [folders, setFolders] = useState<WarMapFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState('general');
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [expandedNotesId, setExpandedNotesId] = useState<string | null>(null);
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [openFolderMenu, setOpenFolderMenu] = useState<string | null>(null);
  const [debugToast, setDebugToast] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    refreshData();
    // Fechar menu de pasta ao clicar fora
    const handleClickOutside = () => setOpenFolderMenu(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const refreshData = () => {
    const freshNodes = storage.getNodes();
    const freshConns = storage.getConnections();
    const freshFolders = storage.getFolders();
    setNodes(freshNodes);
    setConns(freshConns);
    setFolders(freshFolders);
  };

  const showToast = (msg: string) => {
    setDebugToast(msg);
    setTimeout(() => setDebugToast(null), 3000);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-grid')) {
      setIsPanning(true);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    if (isPanning) setViewport(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
    else if (draggingNode) setNodes(prev => prev.map(n => n.id === draggingNode ? { ...n, x: n.x + dx/viewport.zoom, y: n.y + dy/viewport.zoom } : n));
  };

  const handleMouseUp = () => {
    if (draggingNode) {
      const node = nodes.find(n => n.id === draggingNode);
      if (node) storage.saveNode(node);
    }
    setIsPanning(false);
    setDraggingNode(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    const delta = -e.deltaY * 0.001;
    setViewport(v => ({ ...v, zoom: Math.min(Math.max(v.zoom + delta, 0.2), 3) }));
  };

  const createNode = (type: NodeType, content: string = '', notes: string = '', threadId?: string, msgId?: string, author?: string) => {
    const newNode: WarMapNode = {
      id: crypto.randomUUID(), folderId: activeFolderId, type, content, notes,
      x: (window.innerWidth / 2 - viewport.x) / viewport.zoom - 140,
      y: (window.innerHeight / 2 - viewport.y) / viewport.zoom - 90,
      width: 280, height: 180, tags: [], sourceThreadId: threadId, sourceMessageId: msgId, author,
      createdAt: Date.now(), updatedAt: Date.now()
    };
    setNodes(prev => [...prev, newNode]);
    storage.saveNode(newNode);
    setSelectedNodeId(newNode.id);
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    const f: WarMapFolder = { 
      id: crypto.randomUUID(), 
      name: newFolderName.trim(), 
      icon: '📁', 
      color: '#4f46e5', 
      createdAt: Date.now() 
    };
    storage.saveFolder(f);
    refreshData();
    setActiveFolderId(f.id);
    setNewFolderName('');
    setShowNewFolderModal(false);
  };

  const handleRenameFolder = (folder: WarMapFolder, e: React.MouseEvent) => {
    e.stopPropagation();
    const newName = prompt('Novo título para a pasta:', folder.name);
    if (newName && newName.trim() && newName.trim() !== folder.name) {
      storage.updateFolder({ ...folder, name: newName.trim() });
      refreshData();
    }
    setOpenFolderMenu(null);
  };

  const handleDeleteFolder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Instrumentação: Log do clique inicial
    const folderToDelete = folders.find(f => f.id === id);
    console.log('[DEBUG] Clique em excluir pasta:', { id, name: folderToDelete?.name });

    if (id === 'general') {
      console.warn('[DEBUG] Tentativa de excluir a pasta Geral bloqueada.');
      return;
    }

    const confirmResult = confirm(`Excluir a pasta "${folderToDelete?.name}"?\nAs entradas do Diário serão movidas para a pasta "Geral".`);
    console.log('[DEBUG] Confirmação do usuário:', confirmResult);

    if (confirmResult) {
      showToast("Excluindo pasta...");
      
      try {
        console.log('[DEBUG] Iniciando operação de exclusão no storage');
        const countBefore = storage.getFolders().length;
        const nodesBefore = storage.getNodes().filter(n => n.folderId === id).length;
        
        // Executa a exclusão e movimentação no service de storage
        storage.deleteFolder(id);
        
        const countAfter = storage.getFolders().length;
        const nodesInGeneralAfter = storage.getNodes().filter(n => n.folderId === 'general').length;

        console.log('[DEBUG] Operação concluída:', { 
          pastasAntes: countBefore, 
          pastasDepois: countAfter,
          nósMovidos: nodesBefore,
          totalEmGeral: nodesInGeneralAfter
        });

        // Sincroniza UI
        refreshData();
        if (activeFolderId === id) setActiveFolderId('general');
        
        showToast("Pasta excluída com sucesso.");
      } catch (err) {
        console.error('[DEBUG] Erro ao excluir pasta:', err);
        showToast(`Falha ao excluir: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      }
    }
    setOpenFolderMenu(null);
  };

  const handleAddTaggedMessage = (msg: Message) => {
    createNode('insight', msg.content, '', msg.threadId, msg.id, msg.role === 'agent' ? msg.agentId : 'User');
    setShowTagSelector(false);
  };

  const filteredNodes = nodes.filter(n => n.folderId === activeFolderId);
  const activeFolder = folders.find(f => f.id === activeFolderId) || folders[0];
  const taggedMessages = storage.getAllMessages().filter(m => m.tagIds && m.tagIds.length > 0);

  return (
    <div className="w-full h-full bg-[#f8fafc] dark:bg-[#0b141a] overflow-hidden relative select-none" ref={canvasRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onWheel={handleWheel}>
      <div className="absolute inset-0 canvas-grid pointer-events-none opacity-10 dark:opacity-5" style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: `${40 * viewport.zoom}px ${40 * viewport.zoom}px`, backgroundPosition: `${viewport.x}px ${viewport.y}px` }} />

      {/* Debug Toast */}
      {debugToast && (
        <div className="absolute bottom-10 right-10 bg-black/80 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest z-[100] animate-in slide-in-from-bottom-2 border border-white/10">
          {debugToast}
        </div>
      )}

      {/* Sidebar de Pastas */}
      <div className="absolute top-0 left-0 h-full bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-r border-gray-100 dark:border-gray-800 w-64 z-40 flex flex-col p-4 shadow-2xl">
        <div className="flex justify-between items-center mb-6 px-2">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Pastas Estratégicas</h3>
          <button onClick={() => setShowNewFolderModal(true)} className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-all shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-1 no-scrollbar">
          {folders.length === 0 && <p className="text-center py-10 text-[9px] text-gray-400 font-bold uppercase">Nenhuma pasta criada</p>}
          {folders.map(f => (
            <div key={f.id} className="relative group">
              <button 
                onClick={() => setActiveFolderId(f.id)} 
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all relative ${activeFolderId === f.id ? 'bg-indigo-600 text-white shadow-lg ring-1 ring-indigo-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700'}`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="shrink-0">{f.id === 'general' ? '🏠' : '📂'}</span>
                  <span className="text-[11px] font-bold truncate pr-4">{f.name}</span>
                </div>
                
                <div 
                  className={`p-1 rounded-lg hover:bg-black/10 transition-colors shrink-0`}
                  onClick={(e) => { e.stopPropagation(); setOpenFolderMenu(openFolderMenu === f.id ? null : f.id); }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/></svg>
                </div>
              </button>

              {/* Menu de Contexto da Pasta */}
              {openFolderMenu === f.id && (
                <div 
                  className="absolute right-0 top-12 w-40 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 py-2 z-50 animate-in fade-in zoom-in-95"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button 
                    onClick={(e) => handleRenameFolder(f, e)}
                    className="w-full text-left px-4 py-2 text-[10px] font-bold text-gray-600 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 transition-colors flex items-center gap-2"
                  >
                    <span>✎</span> Renomear
                  </button>
                  {f.id !== 'general' && (
                    <button 
                      onClick={(e) => handleDeleteFolder(f.id, e)}
                      className="w-full text-left px-4 py-2 text-[10px] font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors flex items-center gap-2"
                    >
                      <span>🗑</span> Excluir Pasta
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar Superior */}
      <div className="absolute top-6 left-[300px] right-6 flex items-center justify-between z-30 pointer-events-none">
        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md px-6 py-3 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 flex items-center gap-6 pointer-events-auto">
          <div className="flex flex-col min-w-[120px]">
            <h2 className="text-[10px] font-black uppercase text-gray-400 truncate max-w-[150px]">{activeFolder?.name}</h2>
            <p className="text-[8px] font-bold text-indigo-500 uppercase">{filteredNodes.length} elementos de guerra</p>
          </div>
          <div className="h-8 w-px bg-gray-100 dark:bg-gray-700" />
          <div className="flex gap-2">
            {(['insight', 'tensao', 'pergunta', 'decisao', 'acao', 'evidencia'] as NodeType[]).map(type => (
              <button 
                key={type} 
                onClick={() => createNode(type)} 
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg hover:scale-110 transition-transform ${TYPE_CONFIG[type].color} bg-opacity-20 shadow-sm`}
                title={`Adicionar ${TYPE_CONFIG[type].label}`}
              >
                {TYPE_CONFIG[type].icon}
              </button>
            ))}
          </div>
          <button onClick={() => setShowTagSelector(true)} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg">Tags p/ Mapa</button>
          {selectedNodeId && (
            <button 
              onClick={() => { storage.deleteNode(selectedNodeId); setNodes(storage.getNodes()); setSelectedNodeId(null); }} 
              className="p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors font-bold text-[10px] border border-red-100 dark:border-red-900/30"
            >
              Remover Nó
            </button>
          )}
        </div>
      </div>

      {/* Canvas do Mapa Cognitivo */}
      <div 
        style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`, transformOrigin: '0 0' }} 
        className="absolute inset-0 pointer-events-none"
      >
        <svg className="absolute inset-0 overflow-visible w-full h-full">
          {conns.map(conn => {
            const from = nodes.find(n => n.id === conn.fromId && n.folderId === activeFolderId);
            const to = nodes.find(n => n.id === conn.toId && n.folderId === activeFolderId);
            if (!from || !to) return null;
            return <line key={conn.id} x1={from.x + 140} y1={from.y + 90} x2={to.x + 140} y2={to.y + 90} stroke="#4f46e5" strokeWidth="2" strokeDasharray="5,5" opacity="0.3" />;
          })}
        </svg>
        
        {filteredNodes.map(node => (
          <div 
            key={node.id} 
            onMouseDown={(e) => { e.stopPropagation(); setDraggingNode(node.id); setSelectedNodeId(node.id); }} 
            onClick={(e) => { e.stopPropagation(); if(connectingFrom && connectingFrom !== node.id) { storage.saveConnection({ id: crypto.randomUUID(), fromId: connectingFrom, toId: node.id }); setConns(storage.getConnections()); setConnectingFrom(null); } }} 
            style={{ left: node.x, top: node.y, width: 280, zIndex: selectedNodeId === node.id ? 100 : 10 }} 
            className={`absolute pointer-events-auto bg-white dark:bg-gray-800 rounded-2xl border-2 transition-all p-5 flex flex-col gap-4 shadow-xl ${TYPE_CONFIG[node.type].border} ${selectedNodeId === node.id ? 'ring-4 ring-indigo-500/20 shadow-indigo-500/10 border-indigo-400' : ''}`}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-xl">{TYPE_CONFIG[node.type].icon}</span>
                <span className={`text-[9px] font-black uppercase tracking-widest ${TYPE_CONFIG[node.type].color}`}>{TYPE_CONFIG[node.type].label}</span>
              </div>
              <button 
                onMouseDown={(e) => { e.stopPropagation(); setConnectingFrom(node.id); }} 
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all shadow-sm border ${connectingFrom === node.id ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-gray-50 dark:bg-gray-700 text-gray-400 border-gray-100 dark:border-gray-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'}`}
                title="Conectar a outro nó"
              >
                🔗
              </button>
            </div>
            
            <textarea 
              onMouseDown={e => e.stopPropagation()} 
              className="bg-transparent text-xs font-bold dark:text-white outline-none resize-none no-scrollbar min-h-[60px] border-b border-gray-100 dark:border-gray-700 pb-2 leading-relaxed" 
              value={node.content} 
              placeholder="Digite o conteúdo estratégico..."
              onChange={e => { const updated = { ...node, content: e.target.value }; setNodes(prev => prev.map(n => n.id === node.id ? updated : n)); storage.saveNode(updated); }} 
            />
            
            <div className="flex flex-col gap-2">
              <button 
                onMouseDown={e => e.stopPropagation()} 
                onClick={() => setExpandedNotesId(expandedNotesId === node.id ? null : node.id)} 
                className="text-[8px] font-black text-gray-400 uppercase tracking-widest hover:text-indigo-500 flex items-center gap-1 transition-colors"
              >
                {expandedNotesId === node.id ? '收 Minimizar' : '👁 Ver Anotações Profundas'}
              </button>
              
              {expandedNotesId === node.id && (
                <textarea 
                  autoFocus 
                  onMouseDown={e => e.stopPropagation()} 
                  className="bg-gray-50 dark:bg-gray-900 p-3 rounded-xl text-[10px] text-gray-600 dark:text-gray-300 outline-none resize-none min-h-[100px] border border-gray-100 dark:border-gray-800" 
                  value={node.notes || ''} 
                  placeholder="Detalhamento e observações extras..."
                  onChange={e => { const updated = { ...node, notes: e.target.value }; setNodes(prev => prev.map(n => n.id === node.id ? updated : n)); storage.saveNode(updated); }} 
                />
              )}
            </div>
            
            {node.sourceThreadId && (
              <button 
                onMouseDown={e => e.stopPropagation()} 
                onClick={() => onNavigateToChat(node.sourceThreadId!, node.sourceMessageId)} 
                className="text-[7px] font-black text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1.5 rounded-lg uppercase tracking-widest text-left hover:bg-indigo-100 transition-colors w-fit"
              >
                ⚓ Ver Origem no Diálogo
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Modais */}
      {showNewFolderModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-6 animate-in fade-in">
          <div className="bg-white dark:bg-[#111b21] rounded-3xl p-6 w-full max-w-xs shadow-2xl border border-gray-100 dark:border-gray-800">
            <h3 className="text-sm font-bold mb-4 dark:text-white uppercase tracking-wider text-center">Nova Pasta Estratégica</h3>
            <input 
              autoFocus 
              type="text" 
              placeholder="Nome da Pasta" 
              value={newFolderName} 
              onChange={e => setNewFolderName(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleCreateFolder()} 
              className="w-full bg-gray-50 dark:bg-gray-800 p-4 rounded-xl text-xs outline-none dark:text-white border-2 border-transparent focus:border-indigo-500 transition-all" 
            />
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowNewFolderModal(false)} className="flex-1 py-3 text-[10px] font-black text-gray-400 uppercase">Cancelar</button>
              <button onClick={handleCreateFolder} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-700 transition-all">Criar Pasta</button>
            </div>
          </div>
        </div>
      )}

      {showTagSelector && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-6 animate-in fade-in">
          <div className="bg-white dark:bg-[#111b21] rounded-3xl p-8 w-full max-w-lg shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-black dark:text-white uppercase tracking-widest">Biblioteca de Tags Estratégicas</h3>
              <button onClick={() => setShowTagSelector(false)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors text-xl font-bold">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar pr-2">
              {taggedMessages.length === 0 ? (
                <div className="text-center py-20">
                  <span className="text-5xl block mb-4 opacity-20">🏷️</span>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Nenhuma mensagem com tag encontrada.</p>
                </div>
              ) : (
                taggedMessages.map(m => (
                  <button key={m.id} onClick={() => handleAddTaggedMessage(m)} className="w-full text-left p-5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all border border-transparent hover:border-indigo-200 group">
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {m.tagIds?.map(tid => {
                        const t = storage.getTags().find(tag => tag.id === tid);
                        return (
                          <span key={tid} style={{ color: t?.color, backgroundColor: t?.color + '15' }} className="text-[8px] font-black uppercase px-2 py-0.5 rounded-lg border border-current">
                            #{t?.name}
                          </span>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-gray-700 dark:text-gray-300 line-clamp-2 leading-relaxed italic group-hover:text-indigo-600">"{m.content}"</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[8px] font-bold text-gray-400 uppercase">Enviado por {m.agentId || 'User'}</span>
                      <span className="text-[8px] font-bold text-indigo-500 uppercase opacity-0 group-hover:opacity-100 transition-opacity">Importar para o Mapa →</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiaryView;
