
import React, { useState, useEffect, useCallback } from 'react';
import { Thread, Message, AgentId, MessageMode, Tese, Tag } from './types';
import { storage } from './services/storage';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import TaggedMessagesView from './components/TaggedMessagesView';
import DiaryView from './components/DiaryView';

const App: React.FC = () => {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [activeContact, setActiveContact] = useState<string | null>(null);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [activeTag, setActiveTag] = useState<Tag | null>(null);
  const [activeView, setActiveView] = useState<'chat' | 'diario' | 'tags'>('chat');
  
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  const refreshData = useCallback(() => {
    setThreads(storage.getThreads());
    setTags(storage.getTags());
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const handleCreateThread = (projectId?: string, contactId?: string, title?: string) => {
    const defaultTitle = title || (contactId === 'diario' ? 'Sessão de Despejo' : 'Nova Conversa');
    const newThread: Thread = {
      id: crypto.randomUUID(),
      title: defaultTitle,
      projectId,
      contactId,
      tags: [],
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };
    storage.saveThread(newThread);
    refreshData();
    setActiveThread(newThread);
    setActiveTag(null);
    setActiveView(contactId === 'diario' ? 'diario' : 'chat');
    return newThread;
  };

  const handleSelectContact = (id: string) => {
    const isDiario = id === 'diario';
    setActiveView(isDiario ? 'diario' : 'chat');
    setActiveContact(id);
    setActiveTag(null);
    if (isDiario) {
      setActiveThread(null);
    } else {
      const contThreads = threads.filter(t => t.contactId === id && !t.projectId);
      setActiveThread(contThreads.length > 0 ? contThreads.sort((a,b) => b.lastActivityAt - a.lastActivityAt)[0] : handleCreateThread(undefined, id));
    }
  };

  const handleSelectThread = (thread: Thread) => {
    setActiveThread(thread);
    setActiveTag(null);
    if (thread.contactId) {
      setActiveContact(thread.contactId);
      setActiveView(thread.contactId === 'diario' ? 'diario' : 'chat');
    }
  };

  const handleSelectTag = (tag: Tag) => {
    setActiveTag(tag);
    setActiveView('tags');
    setActiveThread(null);
    setActiveContact(null);
  };

  const handleGoToChat = (threadId: string, messageId?: string) => {
    const thread = threads.find(t => t.id === threadId);
    if (thread) {
      handleSelectThread(thread);
      if (messageId) {
         setTimeout(() => {
          const el = document.getElementById(`msg-${messageId}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el?.classList.add('ring-2', 'ring-indigo-500');
          setTimeout(() => el?.classList.remove('ring-2', 'ring-indigo-500'), 2000);
        }, 500);
      }
    }
  };

  return (
    <div className={`flex h-screen w-screen transition-colors duration-300 ${isDarkMode ? 'dark bg-gray-900' : 'bg-gray-50'} overflow-hidden`}>
      <Sidebar 
        threads={threads}
        tags={tags}
        activeContact={activeContact}
        activeThread={activeThread}
        activeTag={activeTag}
        activeView={activeView as any}
        onSelectContact={handleSelectContact}
        onSelectThread={handleSelectThread}
        onSelectTag={handleSelectTag}
        onCreateThread={handleCreateThread}
        onSetView={(v) => {
           if (v === 'diario') handleSelectContact('diario');
           else if (v === 'chat' && !activeContact) handleSelectContact('council');
           else setActiveView(v);
        }}
        onUpdateThread={t => { storage.saveThread(t); refreshData(); }}
        isDarkMode={isDarkMode}
        toggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        onRefreshTags={refreshData}
      />
      
      <main className="flex-1 min-w-0 bg-[#f0f2f5] dark:bg-[#0b141a] relative flex flex-col">
        {activeView === 'tags' && activeTag ? (
          <TaggedMessagesView 
            tag={activeTag} 
            onNavigate={handleGoToChat} 
          />
        ) : activeView === 'diario' ? (
          <DiaryView onNavigateToChat={handleGoToChat} />
        ) : activeThread ? (
          <ChatArea 
            activeThread={activeThread}
            activeProject={null}
            isDarkMode={isDarkMode}
            onDeleteThread={() => { storage.deleteThread(activeThread.id); refreshData(); setActiveThread(null); }}
            onUpdateThread={t => { storage.saveThread(t); refreshData(); }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center opacity-40 select-none flex-col gap-6">
             <div className="text-9xl grayscale blur-[0.5px]">🛡️</div>
             <div className="text-center">
               <h2 className="text-2xl font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">QG Estratégico</h2>
               <p className="text-xs font-bold text-gray-400 mt-2">SELECIONE UM CANAL DE INTELIGÊNCIA</p>
             </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
