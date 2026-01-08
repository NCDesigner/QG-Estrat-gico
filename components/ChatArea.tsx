
import React, { useState, useEffect, useRef } from 'react';
import { Thread, Project, Message, MessageMode, AgentId, TimeContext, Tag, WarMapNode, NodeType, WarMapFolder, ExportFormat } from '../types';
import { storage } from '../services/storage';
import { generateAgentResponse } from '../services/gemini';
import { AGENTS } from '../constants';
import Composer from './Composer';

const TYPE_CONFIG: Record<NodeType, { icon: string, label: string, color: string, border: string }> = {
  insight: { icon: '💡', label: 'Insight', color: 'bg-yellow-50 text-yellow-700', border: 'border-yellow-200' },
  tensao: { icon: '⚠️', label: 'Tensão', color: 'bg-red-50 text-red-700', border: 'border-red-200' },
  pergunta: { icon: '❓', label: 'Pergunta', color: 'bg-purple-50 text-purple-700', border: 'border-purple-200' },
  decisao: { icon: '⚖️', label: 'Decisão', color: 'bg-blue-50 text-blue-700', border: 'border-blue-200' },
  acao: { icon: '🚀', label: 'Ação', color: 'bg-green-50 text-green-700', border: 'border-green-200' },
  evidencia: { icon: '📊', label: 'Evidência', color: 'bg-teal-50 text-teal-700', border: 'border-teal-200' },
  anexo: { icon: '📎', label: 'Anexo', color: 'bg-gray-50 text-gray-700', border: 'border-gray-200' },
};

const AGENT_ORDER: AgentId[] = ['flavio', 'alfredo', 'conrado', 'rafa', 'luciano'];

interface ChatAreaProps {
  activeThread: Thread;
  activeProject: Project | null;
  isDarkMode: boolean;
  onDeleteThread: () => void;
  onUpdateThread: (thread: Thread) => void;
}

const ChatArea: React.FC<ChatAreaProps> = ({ activeThread, activeProject, isDarkMode, onDeleteThread, onUpdateThread }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [interaction, setInteraction] = useState<{agentId: AgentId, status: 'analisando' | 'digitando'} | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(activeThread.title);
  const [showTagMenu, setShowTagMenu] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<Tag[]>(storage.getTags());
  const [showWarMapModal, setShowWarMapModal] = useState<Message | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState('general');
  const [folders, setFolders] = useState<WarMapFolder[]>([]);
  const [mapSuccess, setMapSuccess] = useState(false);
  
  // Export states
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportAgents, setExportAgents] = useState<string[]>(['all']);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('md');

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(storage.getMessagesByThread(activeThread.id));
    setTempTitle(activeThread.title);
    setAllTags(storage.getTags());
    setFolders(storage.getFolders());
  }, [activeThread.id, activeThread.title]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, interaction]);

  const handleSendMessage = async (text: string, mode: MessageMode, targetAgents: AgentId[], attachments: any[]) => {
    const effectiveMode = targetAgents.length > 1 ? MessageMode.COUNCIL : 
                         targetAgents.length === 1 ? MessageMode.SINGLE : MessageMode.NOTE;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      threadId: activeThread.id,
      role: 'user',
      mode: effectiveMode,
      agentId: targetAgents.length === 1 ? targetAgents[0] : undefined,
      content: text,
      createdAt: Date.now(),
      attachments
    };

    const currentHistory = [...messages];
    setMessages(prev => [...prev, userMsg]);
    storage.saveMessage(userMsg);
    onUpdateThread({ ...activeThread, lastActivityAt: Date.now() });

    if (effectiveMode === MessageMode.NOTE) return;

    let agentsToCall = [...targetAgents];
    if (effectiveMode === MessageMode.COUNCIL) {
      agentsToCall = AGENT_ORDER.filter(id => targetAgents.includes(id));
    }

    const timeCtx: TimeContext = {
      localTime: new Date().toLocaleTimeString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      dayOfWeek: new Date().toLocaleDateString('pt-BR', { weekday: 'long' })
    };

    const lastMsg = currentHistory[currentHistory.length - 1];
    const isNewInteraction = !lastMsg || (Date.now() - lastMsg.createdAt > 6 * 60 * 60 * 1000);

    for (const agentId of agentsToCall) {
      setInteraction({ agentId, status: 'analisando' });
      const apiResponse = await generateAgentResponse(
        agentId, 
        text, 
        currentHistory.concat(userMsg), 
        timeCtx, 
        'direto', 
        attachments,
        isNewInteraction
      );
      
      const analysisTime = 1500 + Math.random() * 2000;
      await new Promise(r => setTimeout(r, analysisTime));

      setInteraction({ agentId, status: 'digitando' });
      const typingTime = Math.min(Math.max(apiResponse.length * 10, 1000), 4000);
      await new Promise(r => setTimeout(r, typingTime));

      const agentMsg: Message = { 
        id: crypto.randomUUID(), 
        threadId: activeThread.id, 
        role: 'agent', 
        mode: MessageMode.SINGLE, 
        agentId, 
        content: apiResponse || 'Processado.', 
        createdAt: Date.now() 
      };
      
      setMessages(prev => {
        const updated = [...prev, agentMsg];
        storage.saveMessage(agentMsg);
        return updated;
      });
      
      setInteraction(null);
      await new Promise(r => setTimeout(r, 800));
    }
  };

  const toggleExportAgent = (id: string) => {
    if (id === 'all') {
      setExportAgents(['all']);
    } else {
      const filtered = exportAgents.filter(a => a !== 'all');
      if (filtered.includes(id)) {
        const next = filtered.filter(a => a !== id);
        setExportAgents(next.length === 0 ? ['all'] : next);
      } else {
        setExportAgents([...filtered, id]);
      }
    }
  };

  const handleExport = () => {
    const selectedMessages = messages.filter(m => {
      if (exportAgents.includes('all')) return true;
      if (m.role === 'user' && exportAgents.includes('user')) return true;
      if (m.role === 'agent' && m.agentId && exportAgents.includes(m.agentId)) return true;
      return false;
    });

    let content = "";
    const filename = `QG_${activeThread.title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}`;

    if (exportFormat === 'json') {
      content = JSON.stringify(selectedMessages, null, 2);
    } else if (exportFormat === 'txt' || exportFormat === 'md') {
      content = `${exportFormat === 'md' ? '# ' : ''}${activeThread.title.toUpperCase()}\n`;
      content += `Data: ${new Date().toLocaleDateString()}\n\n`;
      
      selectedMessages.forEach(m => {
        const author = m.role === 'user' ? 'VOCÊ' : (m.agentId ? AGENTS[m.agentId].name : 'AGENTE');
        const time = new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        if (exportFormat === 'md') {
          content += `**${author}** [${time}]\n${m.content}\n\n`;
        } else {
          content += `${author} [${time}]:\n${m.content}\n\n`;
        }
      });
    }

    const blob = new Blob([content], { type: exportFormat === 'json' ? 'application/json' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.${exportFormat}`;
    link.click();
    setShowExportModal(false);
  };

  const handleSaveTitle = () => {
    if (tempTitle.trim() && tempTitle !== activeThread.title) onUpdateThread({ ...activeThread, title: tempTitle });
    setEditingTitle(false);
  };

  const toggleTagInMessage = (msgId: string, tagId: string) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;
    const currentTags = msg.tagIds || [];
    const newTags = currentTags.includes(tagId) ? currentTags.filter(id => id !== tagId) : [...currentTags, tagId];
    const updated = { ...msg, tagIds: newTags };
    storage.updateMessage(updated);
    setMessages(prev => prev.map(m => m.id === msgId ? updated : m));
  };

  const sendToWarMap = (type: NodeType) => {
    if (!showWarMapModal) return;
    const node: WarMapNode = {
      id: crypto.randomUUID(), folderId: selectedFolderId, type, content: showWarMapModal.content, notes: '', x: Math.random() * 500, y: Math.random() * 500, width: 280, height: 180, author: showWarMapModal.role === 'agent' ? showWarMapModal.agentId : 'User', sourceThreadId: activeThread.id, sourceMessageId: showWarMapModal.id, attachments: showWarMapModal.attachments, tags: [], createdAt: Date.now(), updatedAt: Date.now()
    };
    storage.saveNode(node);
    setShowWarMapModal(null);
    setMapSuccess(true);
    setTimeout(() => setMapSuccess(false), 3000);
  };

  return (
    <div className="flex flex-col h-full bg-[#f0f2f5] dark:bg-[#0b141a]">
      <header className="h-16 bg-white/90 dark:bg-[#111b21]/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-4 flex-1">
          {editingTitle ? (
            <input autoFocus className="bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-lg text-sm font-bold dark:text-white outline-none ring-2 ring-indigo-500 w-full max-w-md" value={tempTitle} onChange={e => setTempTitle(e.target.value)} onBlur={handleSaveTitle} onKeyDown={e => e.key === 'Enter' && handleSaveTitle()} />
          ) : (
            <div className="flex flex-col cursor-pointer group" onClick={() => setEditingTitle(true)}>
              <div className="flex items-center gap-2"><h2 className="font-bold text-sm dark:text-white tracking-tight uppercase">{activeThread.title}</h2><span className="opacity-0 group-hover:opacity-100 text-[10px] text-indigo-500 transition-opacity">editar</span></div>
              <p className="text-[8px] text-gray-400 font-black uppercase tracking-widest">{activeThread.contactId === 'diario' ? 'Diário de Guerra' : 'Canal de Inteligência'}</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowExportModal(true)} className="p-2 text-gray-400 hover:text-indigo-500 transition-colors" title="Exportar Inteligência">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
          </button>
          <button onClick={onDeleteThread} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-12 py-10 no-scrollbar scroll-smooth">
        <div className="max-w-4xl mx-auto">
          {messages.map((m) => {
            const isUser = m.role === 'user';
            const agent = m.agentId ? AGENTS[m.agentId] : null;
            const customAvatar = m.agentId ? storage.getAgentCustoms()[m.agentId]?.avatar : null;
            const userAvatar = storage.getUserProfile().avatar;
            
            return (
              <div id={`msg-${m.id}`} key={m.id} className={`flex flex-col mb-8 ${isUser ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300 group`}>
                <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} max-w-[90%] md:max-w-[80%]`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 overflow-hidden shadow-sm ${isUser ? 'bg-indigo-600' : (agent?.color || 'bg-gray-600')}`}>
                    {isUser ? (userAvatar ? <img src={userAvatar} className="w-full h-full object-cover" /> : 'U') : (customAvatar ? <img src={customAvatar} className="w-full h-full object-cover" /> : m.agentId?.charAt(0).toUpperCase())}
                  </div>
                  <div className="relative">
                    <div className={`p-4 rounded-2xl shadow-sm ${isUser ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-tl-none border border-gray-100 dark:border-gray-800'}`}>
                      <div className="text-[14px] leading-relaxed whitespace-pre-wrap">{m.content}</div>
                      
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {m.attachments.map(att => (
                            <div key={att.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold uppercase border ${isUser ? 'bg-white/10 border-white/20 text-white' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500'}`}>
                              <span>{att.fileType === 'audio' ? '🎙️ Áudio' : '📎 Arquivo'}</span>
                              {att.duration && <span>({Math.floor(att.duration/60)}:{(att.duration%60).toString().padStart(2,'0')})</span>}
                              {att.fileUrl && <a href={att.fileUrl} download={att.filename} className="hover:text-indigo-500">↓</a>}
                            </div>
                          ))}
                        </div>
                      )}

                      {m.tagIds && m.tagIds.length > 0 && (<div className="flex flex-wrap gap-1 mt-3">{m.tagIds.map(id => (<span key={id} style={{ backgroundColor: storage.getTags().find(t => t.id === id)?.color + '30', color: storage.getTags().find(t => t.id === id)?.color }} className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase border border-current">{storage.getTags().find(t => t.id === id)?.name}</span>))}</div>)}
                      <div className="mt-2 text-[8px] font-bold uppercase opacity-40">{new Date(m.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                    </div>
                    <div className={`absolute top-0 ${isUser ? '-left-20 flex-row-reverse' : '-right-20 flex-row'} flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
                      <button onClick={() => setShowTagMenu(showTagMenu === m.id ? null : m.id)} className="p-2 rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 text-gray-400 hover:text-indigo-500 transition-all">🏷️</button>
                      <button onClick={() => setShowWarMapModal(m)} className="p-2 rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 text-gray-400 hover:text-purple-500 transition-all">🧠</button>
                      {showTagMenu === m.id && (
                        <div className="absolute top-10 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl shadow-2xl p-2 z-50 w-40 flex flex-col gap-1">
                          {storage.getTags().map(tag => (<button key={tag.id} onClick={() => { toggleTagInMessage(m.id, tag.id); setShowTagMenu(null); }} className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-[10px] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${m.tagIds?.includes(tag.id) ? 'text-indigo-600 font-bold' : 'text-gray-500'}`}><span>#{tag.name}</span>{m.tagIds?.includes(tag.id) && <span>✓</span>}</button>))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          
          {interaction && (
            <div className="flex items-center gap-4 mb-10 animate-pulse">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 overflow-hidden shadow-sm ${AGENTS[interaction.agentId]?.color}`}>
                {storage.getAgentCustoms()[interaction.agentId]?.avatar ? <img src={storage.getAgentCustoms()[interaction.agentId]?.avatar} className="w-full h-full object-cover" /> : interaction.agentId.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">
                  {AGENTS[interaction.agentId]?.name} {interaction.status === 'analisando' ? 'está analisando...' : 'está digitando...'}
                </span>
                {interaction.status === 'digitando' && (
                  <div className="flex gap-1 mt-1">
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce delay-75"></div>
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce delay-150"></div>
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce delay-225"></div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <Composer onSend={handleSendMessage} initialMode={activeThread.contactId === 'diario' ? MessageMode.NOTE : MessageMode.SINGLE} fixedTarget={activeThread.contactId} />

      {/* Modal Exportar */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-6 animate-in fade-in">
          <div className="bg-white dark:bg-[#111b21] rounded-3xl p-8 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800">
            <h3 className="text-sm font-black dark:text-white uppercase tracking-wider text-center mb-6">Exportar Inteligência</h3>
            
            <div className="mb-6">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3">Autores</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => toggleExportAgent('all')} className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${exportAgents.includes('all') ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 dark:bg-gray-800 text-gray-500 border-transparent'}`}>TODOS</button>
                <button onClick={() => toggleExportAgent('user')} className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${exportAgents.includes('user') ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 dark:bg-gray-800 text-gray-500 border-transparent'}`}>EU</button>
                {AGENT_ORDER.map(id => (
                  <button key={id} onClick={() => toggleExportAgent(id)} className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${exportAgents.includes(id) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 dark:bg-gray-800 text-gray-500 border-transparent'}`}>
                    {AGENTS[id].name.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3">Formato</p>
              <div className="grid grid-cols-3 gap-2">
                {(['md', 'txt', 'json'] as ExportFormat[]).map(fmt => (
                  <button key={fmt} onClick={() => setExportFormat(fmt)} className={`py-3 rounded-2xl text-[10px] font-black uppercase transition-all border ${exportFormat === fmt ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 dark:bg-gray-800 text-gray-500 border-transparent'}`}>.{fmt}</button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowExportModal(false)} className="flex-1 py-3 text-[10px] font-black text-gray-400 uppercase">Cancelar</button>
              <button onClick={handleExport} className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-indigo-600/20">Baixar</button>
            </div>
          </div>
        </div>
      )}

      {mapSuccess && <div className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-purple-600 text-white px-6 py-3 rounded-full shadow-2xl z-50 animate-in slide-in-from-bottom-4 duration-300 uppercase text-[10px] font-black">Adicionado ao Mapa</div>}

      {showWarMapModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-6">
           <div className="bg-white dark:bg-[#111b21] rounded-3xl p-8 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800 max-h-[90vh] overflow-y-auto no-scrollbar">
              <h3 className="text-sm font-black dark:text-white uppercase tracking-wider text-center mb-6">Mapeamento Cognitivo</h3>
              <div className="mb-6"><p className="text-[9px] font-black text-gray-400 uppercase mb-2">Pasta</p><div className="flex flex-wrap gap-2">{folders.map(f => (<button key={f.id} onClick={() => setSelectedFolderId(f.id)} className={`px-4 py-2 rounded-xl text-[10px] font-bold transition-all border ${selectedFolderId === f.id ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-gray-50 dark:bg-gray-800 text-gray-400 border-transparent'}`}>{f.name}</button>))}</div></div>
              <div className="grid grid-cols-2 gap-3">{(['insight', 'tensao', 'pergunta', 'decisao', 'acao', 'evidencia'] as NodeType[]).map(type => (<button key={type} onClick={() => sendToWarMap(type)} className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all border border-transparent hover:border-indigo-300 ${TYPE_CONFIG[type].color} bg-opacity-20`}><span>{TYPE_CONFIG[type].icon}</span><span className="text-[9px] font-black uppercase">{TYPE_CONFIG[type].label}</span></button>))}</div>
              <button onClick={() => setShowWarMapModal(null)} className="w-full mt-6 py-3 text-xs font-black text-gray-400 uppercase">Cancelar</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default ChatArea;
