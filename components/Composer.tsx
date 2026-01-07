
import React, { useState, useRef, useEffect } from 'react';
import { MessageMode, AgentId, Project, Attachment } from '../types';
import { AGENTS } from '../constants';
import { GoogleGenAI } from "@google/genai";

interface ComposerProps {
  onSend: (text: string, mode: MessageMode, targetAgents: AgentId[], attachments: Attachment[]) => void;
  initialMode: MessageMode;
  fixedTarget?: string;
  activeProject?: Project | null;
  isDiaryMode?: boolean;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 2000
): Promise<T> {
  let currentDelay = initialDelay;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const isQuotaError = error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED');
      if (isQuotaError && i < maxRetries - 1) {
        console.warn(`Quota atingida na transcrição. Tentando novamente em ${currentDelay}ms...`);
        await delay(currentDelay);
        currentDelay *= 2;
        continue;
      }
      throw error;
    }
  }
  return await fn();
}

const Composer: React.FC<ComposerProps> = ({ onSend, initialMode, fixedTarget, activeProject, isDiaryMode }) => {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<MessageMode>(initialMode);
  const [targetAgents, setTargetAgents] = useState<AgentId[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isStrategyMenuOpen, setIsStrategyMenuOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeProject) {
      setTargetAgents(activeProject.defaultAgents.length > 0 ? activeProject.defaultAgents : ['flavio', 'conrado', 'rafa']);
      setMode(activeProject.defaultAgents.length > 1 ? MessageMode.COUNCIL : MessageMode.SINGLE);
    } else if (fixedTarget) {
      if (fixedTarget === 'council') {
        setTargetAgents(['flavio', 'conrado', 'rafa']);
        setMode(MessageMode.COUNCIL);
      } else if (fixedTarget === 'diario') {
        setTargetAgents([]);
        setMode(MessageMode.NOTE);
      } else {
        setTargetAgents([fixedTarget as AgentId]);
        setMode(MessageMode.SINGLE);
      }
    }
  }, [fixedTarget, activeProject]);

  useEffect(() => {
    if (isRecording) {
      setRecordingDuration(0);
      timerRef.current = window.setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size > 0) await transcribeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start(200);
      setIsRecording(true);
    } catch (err) {
      alert("Erro ao acessar microfone. Verifique as permissões.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (blob: Blob) => {
    setIsUploading(true);
    const originalText = text;
    setText("Processando sua voz...");
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = async () => {
      const base64Audio = (reader.result as string).split(',')[1];
      try {
        const transcription = await retryWithExponentialBackoff(async () => {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
              parts: [
                { text: "Transcreva este áudio para texto em português. Retorne apenas o texto transcrito." },
                { inlineData: { mimeType: blob.type, data: base64Audio } }
              ]
            }
          });
          return response.text;
        });
        setText(transcription ? (originalText ? `${originalText}\n${transcription.trim()}` : transcription.trim()) : originalText);
      } catch (err) {
        setText(originalText);
      } finally {
        setIsUploading(false);
      }
    };
  };

  const handleSend = () => {
    if (!text.trim() && attachments.length === 0) return;
    onSend(text, mode, targetAgents, attachments);
    setText('');
    setAttachments([]);
    setIsStrategyMenuOpen(false);
  };

  return (
    <div className="p-4 md:p-6 bg-white/95 dark:bg-[#111b21]/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 shrink-0 shadow-2xl z-40">
      <div className="max-w-4xl mx-auto flex flex-col gap-4">
        
        {isStrategyMenuOpen && (
          <div className="bg-white dark:bg-gray-800 p-4 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl flex flex-wrap gap-2 animate-in fade-in slide-in-from-bottom-2">
            {(['flavio', 'conrado', 'rafa'] as AgentId[]).map(id => (
              <button
                key={id}
                onClick={() => setTargetAgents(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id])}
                className={`px-4 py-2 rounded-2xl text-[10px] font-bold uppercase tracking-wider transition-all ${targetAgents.includes(id) ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-100 dark:bg-gray-900 text-gray-400'}`}
              >
                {AGENTS[id].name}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsStrategyMenuOpen(!isStrategyMenuOpen)}
            className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-800 text-gray-500 hover:text-indigo-500 transition-colors shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
          </button>

          <div className="flex-1 relative">
            <textarea
              className={`w-full bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 pr-12 outline-none text-sm dark:text-gray-100 resize-none border-2 transition-all ${isRecording ? 'border-red-400 ring-4 ring-red-400/10' : 'border-transparent focus:border-indigo-500/20 focus:bg-white dark:focus:bg-gray-700'}`}
              placeholder={isRecording ? "Gravando áudio..." : "Digite sua estratégia..."}
              rows={1}
              style={{ minHeight: '50px', maxHeight: '120px' }}
              value={text}
              disabled={isUploading}
              onChange={e => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="absolute right-3 bottom-3 p-1 text-gray-400 hover:text-indigo-500"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
            </button>
            <input type="file" ref={fileInputRef} onChange={async e => {
              const files = e.target.files; if (!files) return;
              setIsUploading(true);
              const newAtts: Attachment[] = [];
              for (const f of files) {
                const b64 = await new Promise<string>((res) => {
                  const r = new FileReader(); r.readAsDataURL(f); r.onload = () => res(r.result as string);
                });
                newAtts.push({ id: crypto.randomUUID(), fileUrl: URL.createObjectURL(f), fileType: f.type, filename: f.name, base64: b64 });
              }
              setAttachments(p => [...p, ...newAtts]);
              setIsUploading(false);
            }} multiple className="hidden" accept="image/*,video/*,application/pdf" />
          </div>

          <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            {isRecording && (
              <span className="text-[10px] font-mono font-bold text-red-500 px-2 animate-pulse">
                {formatDuration(recordingDuration)}
              </span>
            )}
            <button 
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              onMouseLeave={isRecording ? stopRecording : undefined}
              className={`p-3 rounded-xl transition-all ${isRecording ? 'bg-red-500 text-white scale-110' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-20a3 3 0 013 3v8a3 3 0 01-3 3 3 3 0 01-3-3V5a3 3 0 013-3z"/></svg>
            </button>

            <button 
              onClick={handleSend}
              disabled={(!text.trim() && attachments.length === 0) || isUploading || isRecording}
              className={`p-3 rounded-xl transition-all ${text.trim() || attachments.length > 0 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-gray-200 dark:bg-gray-700 text-gray-400 opacity-50'}`}
            >
              {isUploading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Composer;
