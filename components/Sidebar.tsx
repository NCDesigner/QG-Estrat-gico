
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Thread, AgentId, Tag, UserProfile, AgentCustomizations } from '../types';
import { AGENTS } from '../constants';
import { storage } from '../services/storage';

interface SidebarProps {
  threads: Thread[];
  tags: Tag[];
  activeContact: string | null;
  activeThread: Thread | null;
  activeTag: Tag | null;
  activeView: 'chat' | 'diario' | 'tags';
  onSelectContact: (contactId: string) => void;
  onSelectThread: (thread: Thread) => void;
  onSelectTag: (tag: Tag) => void;
  onSetView: (view: 'chat' | 'diario' | 'tags') => void;
  onCreateThread: (projectId?: string, contactId?: string) => void;
  onUpdateThread: (thread: Thread) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  onRefreshTags: () => void;
}

const TAG_COLORS = [
  { hex: '#fee2e2' }, { hex: '#dbeafe' }, { hex: '#dcfce7' }, { hex: '#fef9c3' }, { hex: '#f3e8ff' }, { hex: '#fce7f3' }, { hex: '#e0e7ff' },
];

const Sidebar: React.FC<SidebarProps> = ({
  threads, tags, activeContact, activeThread, activeTag, activeView,
  onSelectContact, onSelectThread, onSelectTag, onSetView, onCreateThread,
  isDarkMode, toggleDarkMode, onRefreshTags
}) => {
  const [showTagModal, setShowTagModal] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [userProfile, setUserProfile] = useState<UserProfile>(storage.getUserProfile());
  const [agentCustoms, setAgentCustoms] = useState<AgentCustomizations>(storage.getAgentCustoms());
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const agentFileInputRef = useRef<HTMLInputElement>(null);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);

  useEffect(() => {
    setUserProfile(storage.getUserProfile());
    setAgentCustoms(storage.getAgentCustoms());
  }, []);

  const contacts = ['flavio', 'conrado', 'rafa', 'council'];

  const getRecentThreads = (contactId: string) => {
    return threads
      .filter(t => t.contactId === contactId && !t.projectId)
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt)
      .slice(0, 5);
  };

  const handleCreateTag = () => {
    if (!newTagName.trim()) return;
    const color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)].hex;
    storage.saveTag({ id: crypto.randomUUID(), name: newTagName.trim(), color, createdAt: Date.now() });
    setNewTagName('');
    setShowTagModal(false);
    onRefreshTags();
  };

  const handleDeleteTag = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(confirm('Remover esta tag do sistema?')) {
      storage.deleteTag(id);
      onRefreshTags();
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      const updated = { ...userProfile, avatar: base64 };
      storage.saveUserProfile(updated);
      setUserProfile(updated);
    };
    reader.readAsDataURL(file);
  };

  const handleAgentAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingAgentId) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      storage.saveAgentCustom(editingAgentId, { avatar: base64 });
      setAgentCustoms(storage.getAgentCustoms());
      setEditingAgentId(null);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="w-72 h-full flex flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111b21] z-30 transition-all duration-300">
      <div className="p-6 shrink-0 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className="w-10 h-10 rounded-full overflow-hidden bg-indigo-100 flex items-center justify-center border-2 border-indigo-200 group-hover:border-indigo-500 transition-colors shadow-sm">
              {userProfile.avatar ? (
                <img src={userProfile.avatar} alt="User" className="w-full h-full object-cover" />
              ) : (
                <span className="text-indigo-600 font-black">U</span>
              )}
            </div>
            <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center text-[7px] text-white font-black uppercase">FOTO</div>
          </div>
          <div className="min-w-0">
            <h1 className="text-[10px] font-black tracking-[0.2em] dark:text-white uppercase truncate">QG Estratégico</h1>
            <p className="text-[8px] font-bold text-gray-400 uppercase truncate">{userProfile.name}</p>
          </div>
        </div>
        <button onClick={toggleDarkMode} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-lg">
          {isDarkMode ? '☀️' : '🌙'}
        </button>
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
      <input type="file" ref={agentFileInputRef} className="hidden" accept="image/*" onChange={handleAgentAvatarUpload} />

      <div className="flex-1 overflow-y-auto no-scrollbar py-4 px-3 space-y-6">
        <button 
          onClick={() => onSetView('diario')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeView === 'diario' ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 font-bold border-orange-200 border shadow-inner' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
        >
          <span className="text-lg">📓</span>
          <span className="text-xs uppercase tracking-wider">Diário de Guerra</span>
        </button>

        <div>
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3 px-4">Mentoria & Conselho</p>
          <div className="space-y-1">
            {contacts.map(id => {
              const agent = id === 'council' ? { name: 'Conselho Pleno', color: 'bg-indigo-600', focus: 'Estratégia 360' } : AGENTS[id];
              const customAvatar = agentCustoms[id]?.avatar;
              const isExpanded = activeContact === id;
              
              return (
                <div key={id} className="space-y-1">
                  <div className={`flex items-center gap-2 p-2 rounded-xl group transition-all ${activeContact === id && activeView === 'chat' ? 'bg-gray-50 dark:bg-gray-800' : 'hover:bg-gray-50/50'}`}>
                    <button onClick={() => onSelectContact(id)} className="flex-1 flex items-center gap-3 text-left min-w-0">
                      <div 
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-[10px] font-bold overflow-hidden relative shadow-sm ${customAvatar ? '' : agent.color}`}
                        onClick={(e) => { if (id !== 'council') { e.stopPropagation(); setEditingAgentId(id); agentFileInputRef.current?.click(); } }}
                      >
                        {customAvatar ? <img src={customAvatar} alt={agent.name} className="w-full h-full object-cover" /> : (id === 'council' ? '🛡️' : id.charAt(0).toUpperCase())}
                        {id !== 'council' && <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center text-[6px] font-black transition-opacity">FOTO</div>}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold dark:text-gray-200 truncate">{agent.name}</p>
                        <p className="text-[8px] text-gray-400 truncate uppercase">{agent.focus}</p>
                      </div>
                    </button>
                    <button onClick={() => onCreateThread(undefined, id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg></button>
                  </div>
                  {isExpanded && activeView === 'chat' && (
                    <div className="ml-11 space-y-0.5 border-l border-gray-100 dark:border-gray-800 pl-2">
                      {getRecentThreads(id).map(t => (
                        <button key={t.id} onClick={() => onSelectThread(t)} className={`w-full text-left px-3 py-1.5 rounded-lg text-[10px] truncate transition-all ${activeThread?.id === t.id ? 'bg-indigo-600 text-white font-medium shadow-md' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-50'}`}>{t.title}</button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center px-4 mb-3">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Tags</p>
            <button onClick={() => setShowTagModal(true)} className="text-indigo-500 hover:scale-110 transition-transform"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg></button>
          </div>
          <div className="flex flex-wrap gap-2 px-2">
            {tags.map(tag => (
              <button key={tag.id} onClick={() => onSelectTag(tag)} style={{ backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color + '40' }} className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border transition-all hover:brightness-95 flex items-center gap-2 group ${activeTag?.id === tag.id && activeView === 'tags' ? 'ring-2 ring-indigo-500' : ''}`}>
                #{tag.name}
                <span onClick={(e) => handleDeleteTag(tag.id, e)} className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity w-3 h-3 flex items-center justify-center font-bold">✕</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {showTagModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-6 animate-in fade-in">
          <div className="bg-white dark:bg-[#111b21] rounded-3xl p-6 w-full max-w-xs shadow-2xl border border-gray-100 dark:border-gray-800">
            <h3 className="text-sm font-bold mb-4 dark:text-white uppercase tracking-wider text-center">Nova Tag</h3>
            <input autoFocus type="text" placeholder="Nome da Tag" value={newTagName} onChange={e => setNewTagName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateTag()} className="w-full bg-gray-50 dark:bg-gray-800 p-3 rounded-xl text-xs outline-none dark:text-white border border-transparent focus:border-indigo-500" />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowTagModal(false)} className="flex-1 py-2 text-xs font-bold text-gray-400">Cancelar</button>
              <button onClick={handleCreateTag} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg">Criar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
