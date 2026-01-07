
import React, { useState, useEffect, useRef } from 'react';
import { WarMapNode, WarMapConnection, NodeType, WarMapFolder, Message } from '../types';
import { storage } from '../services/storage';

interface WarMapViewProps {
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

const WarMapView: React.FC<WarMapViewProps> = ({ onNavigateToChat }) => {
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
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setNodes(storage.getNodes());
    setConns(storage.getConnections());
    setFolders(storage.getFolders());
  }, []);

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

  const createFolder = () => {
    const name = prompt('Nome da nova pasta:');
    if (name) {
      const f: WarMapFolder = { id: crypto.randomUUID(), name, icon: '📁', color: '#4f46e5', createdAt: Date.now() };
      storage.saveFolder(f);
      setFolders(prev => [...prev, f]);
      setActiveFolderId(f.id);
    }
  };

  const deleteFolder = (id: string) => {
    if (id === 'general') return;
    if (confirm('Excluir esta pasta? Nós serão movidos para Geral.')) {
      storage.deleteFolder(id);
      setFolders(storage.getFolders());
      setActiveFolderId('general');
      setNodes(storage.getNodes());
    }
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

      <div className="absolute top-0 left-0 h-full bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-r border-gray-100 dark:border-gray-800 w-60 z-40 flex flex-col p-4 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Pastas</h3>
          <button onClick={createFolder} className="p-1.5 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg></button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 no-scrollbar">
          {folders.map(f => (
            <div key={f.id} className="relative group">
              <button onClick={() => setActiveFolderId(f.id)} className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all ${activeFolderId === f.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                <span className="text-xs font-bold truncate">{f.name}</span>
              </button>
              {f.id !== 'general' && <button onClick={(e) => { e.stopPropagation(); deleteFolder(f.id); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white bg-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-sm">✕</button>}
            </div>
          ))}
        </div>
      </div>

      <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md px-6 py-3 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 flex items-center gap-6 z-30">
        <div className="flex flex-col min-w-[100px]"><h2 className="text-[10px] font-black uppercase text-gray-400 truncate">{activeFolder?.name}</h2><p className="text-[8px] font-bold text-indigo-500 uppercase">{filteredNodes.length} nós</p></div>
        <div className="h-8 w-px bg-gray-100 dark:bg-gray-700" />
        <div className="flex gap-2">{(['insight', 'tensao', 'pergunta', 'decisao', 'acao', 'evidencia'] as NodeType[]).map(type => (<button key={type} onClick={() => createNode(type)} className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg hover:scale-110 transition-transform ${TYPE_CONFIG[type].color} bg-opacity-20`}>{TYPE_CONFIG[type].icon}</button>))}</div>
        <button onClick={() => setShowTagSelector(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-lg">Tags p/ Mapa</button>
        {selectedNodeId && <button onClick={() => { storage.deleteNode(selectedNodeId); setNodes(storage.getNodes()); setSelectedNodeId(null); }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">Excluir</button>}
      </div>

      <div style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`, transformOrigin: '0 0' }} className="absolute inset-0 pointer-events-none">
        <svg className="absolute inset-0 overflow-visible w-full h-full">
          {conns.map(conn => {
            const from = nodes.find(n => n.id === conn.fromId && n.folderId === activeFolderId);
            const to = nodes.find(n => n.id === conn.toId && n.folderId === activeFolderId);
            if (!from || !to) return null;
            return <line key={conn.id} x1={from.x + 140} y1={from.y + 90} x2={to.x + 140} y2={to.y + 90} stroke="#4f46e5" strokeWidth="2" strokeDasharray="5,5" opacity="0.3" />;
          })}
        </svg>
        {filteredNodes.map(node => (
          <div key={node.id} onMouseDown={(e) => { e.stopPropagation(); setDraggingNode(node.id); setSelectedNodeId(node.id); }} onClick={(e) => { e.stopPropagation(); if(connectingFrom && connectingFrom !== node.id) { storage.saveConnection({ id: crypto.randomUUID(), fromId: connectingFrom, toId: node.id }); setConns(storage.getConnections()); setConnectingFrom(null); } }} style={{ left: node.x, top: node.y, width: 280, zIndex: selectedNodeId === node.id ? 100 : 10 }} className={`absolute pointer-events-auto bg-white dark:bg-gray-800 rounded-2xl border-2 transition-shadow p-4 flex flex-col gap-3 shadow-xl ${TYPE_CONFIG[node.type].border} ${selectedNodeId === node.id ? 'ring-4 ring-indigo-500/20 shadow-indigo-500/10' : ''}`}>
            <div className="flex justify-between items-center"><div className="flex items-center gap-2"><span className="text-xl">{TYPE_CONFIG[node.type].icon}</span><span className={`text-[9px] font-black uppercase tracking-widest ${TYPE_CONFIG[node.type].color}`}>{TYPE_CONFIG[node.type].label}</span></div><button onMouseDown={(e) => { e.stopPropagation(); setConnectingFrom(node.id); }} className="w-6 h-6 rounded-full bg-gray-50 flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-colors">🔗</button></div>
            <textarea onMouseDown={e => e.stopPropagation()} className="bg-transparent text-xs font-bold dark:text-white outline-none resize-none no-scrollbar min-h-[50px] border-b border-gray-100 dark:border-gray-700 pb-2" value={node.content} onChange={e => { const updated = { ...node, content: e.target.value }; setNodes(prev => prev.map(n => n.id === node.id ? updated : n)); storage.saveNode(updated); }} />
            <div className="flex flex-col gap-2">
              <button onMouseDown={e => e.stopPropagation()} onClick={() => setExpandedNotesId(expandedNotesId === node.id ? null : node.id)} className="text-[8px] font-black text-gray-400 uppercase tracking-widest hover:text-indigo-500 flex items-center gap-1">{expandedNotesId === node.id ? 'Fechar' : 'Ver Anotações'}</button>
              {expandedNotesId === node.id && <textarea autoFocus onMouseDown={e => e.stopPropagation()} className="bg-gray-50 dark:bg-gray-900 p-2 rounded-xl text-[10px] text-gray-600 dark:text-gray-300 outline-none resize-none min-h-[80px]" value={node.notes || ''} onChange={e => { const updated = { ...node, notes: e.target.value }; setNodes(prev => prev.map(n => n.id === node.id ? updated : n)); storage.saveNode(updated); }} />}
            </div>
            {node.sourceThreadId && <button onMouseDown={e => e.stopPropagation()} onClick={() => onNavigateToChat(node.sourceThreadId!, node.sourceMessageId)} className="text-[7px] font-black text-indigo-500 uppercase tracking-widest text-left hover:underline">Ir para Diálogo</button>}
          </div>
        ))}
      </div>

      {showTagSelector && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-6 animate-in fade-in">
          <div className="bg-white dark:bg-[#111b21] rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-6"><h3 className="text-sm font-black dark:text-white uppercase tracking-widest">Biblioteca de Tags</h3><button onClick={() => setShowTagSelector(false)} className="text-gray-400 hover:text-red-500 transition-colors">✕</button></div>
            <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar">
              {taggedMessages.map(m => (<button key={m.id} onClick={() => handleAddTaggedMessage(m)} className="w-full text-left p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all border border-transparent hover:border-indigo-200">
                <div className="flex gap-1 mb-2">{m.tagIds?.map(tid => (<span key={tid} className="text-[7px] font-bold text-indigo-500 uppercase">#{storage.getTags().find(t => t.id === tid)?.name}</span>))}</div>
                <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2">{m.content}</p>
              </button>))}
              {taggedMessages.length === 0 && <p className="text-center py-10 text-gray-400 text-xs font-bold">Nenhuma mensagem com tag.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarMapView;
