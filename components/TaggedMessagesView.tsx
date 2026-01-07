
import React from 'react';
import { Tag, Message } from '../types';
import { storage } from '../services/storage';

interface TaggedMessagesViewProps {
  tag: Tag;
  onNavigate: (threadId: string, messageId: string) => void;
}

const TaggedMessagesView: React.FC<TaggedMessagesViewProps> = ({ tag, onNavigate }) => {
  const allMessages = storage.getAllMessages();
  const allThreads = storage.getThreads();
  const taggedMessages = allMessages.filter(m => m.tagIds?.includes(tag.id)).sort((a,b) => b.createdAt - a.createdAt);

  return (
    <div className="flex flex-col h-full bg-[#f0f2f5] dark:bg-[#0b141a] animate-in fade-in duration-500">
      <header className="h-16 bg-white/90 dark:bg-[#111b21]/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 flex items-center px-6 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div style={{ backgroundColor: tag.color + '20', color: tag.color }} className="w-8 h-8 rounded-full flex items-center justify-center font-bold">#</div>
          <div>
            <h2 className="font-bold text-sm dark:text-white tracking-tight uppercase tracking-wider">Acervo: {tag.name}</h2>
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{taggedMessages.length} ocorrências estratégicas</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 md:p-12 no-scrollbar">
        <div className="max-w-4xl mx-auto space-y-6">
          {taggedMessages.map(m => {
            const thread = allThreads.find(t => t.id === m.threadId);
            return (
              <div 
                key={m.id} 
                onClick={() => onNavigate(m.threadId, m.id)}
                className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: tag.color }}></div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${m.role === 'user' ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'}`}>
                      {m.role === 'user' ? 'Você' : (m.agentId ? m.agentId.toUpperCase() : 'AGENTE')}
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium">em {thread?.title || 'Conversa Excluída'}</span>
                  </div>
                  <span className="text-[9px] text-gray-400 font-bold">{new Date(m.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3 italic">"{m.content}"</p>
                <div className="mt-4 flex items-center gap-1 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] font-bold uppercase">Ir para discussão</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                </div>
              </div>
            );
          })}

          {taggedMessages.length === 0 && (
            <div className="text-center py-20 opacity-30">
              <span className="text-6xl mb-4 block">🔖</span>
              <p className="text-sm font-bold uppercase tracking-widest">Nenhuma mensagem marcada com esta tag.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaggedMessagesView;
