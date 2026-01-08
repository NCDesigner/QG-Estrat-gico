
import { GoogleGenAI } from "@google/genai";
import { AGENTS } from "../constants";
import { AgentId, Message, TimeContext, ConfrontationLevel, Attachment } from "../types";

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
        console.warn(`Quota atingida. Tentando novamente em ${currentDelay}ms... (Tentativa ${i + 1}/${maxRetries})`);
        await delay(currentDelay);
        currentDelay *= 2; 
        continue;
      }
      throw error;
    }
  }
  return await fn();
}

export const transcribeAudio = async (base64Audio: string, mimeType: string): Promise<string> => {
  const model = "gemini-3-flash-preview";
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { text: "Transcreva este áudio para texto em português do Brasil de forma natural. Retorne APENAS o texto transcrito, sem comentários adicionais." },
        { inlineData: { mimeType, data: base64Audio } }
      ]
    }
  });
  
  return response.text?.trim() || "";
};

export const generateAgentResponse = async (
  agentId: AgentId,
  userMessage: string,
  history: Message[],
  timeContext?: TimeContext,
  confrontationLevel: ConfrontationLevel = 'direto',
  attachments: Attachment[] = [],
  isNewInteraction: boolean = false
) => {
  const agent = AGENTS[agentId];
  const model = "gemini-3-flash-preview";
  
  const timeInfo = timeContext 
    ? `Contexto temporal: ${timeContext.localTime}, ${timeContext.dayOfWeek}.` 
    : "";

  const levelInstructions = {
    leve: "Tom de conselheiro sábio, menos pressão.",
    direto: "Sem rodeios. Vá no ponto crítico imediatamente.",
    confrontador: "Dureza total. Se a Nath estiver se enganando, exponha isso sem dó."
  };

  const humanCheck = isNewInteraction && (agentId === 'alfredo' || agentId === 'luciano')
    ? `Esta é uma nova conversa ou faz tempo que não se falam. Comece com uma saudação humana curta (1-2 linhas) usando "Nath", "Nata" ou "Natália" alternadamente. Ex: "E aí, Nath. Vamos organizar essa tração?" ou "Natália, qual o fundamento que estamos esquecendo aqui?".`
    : "";

  const systemInstruction = `Você é ${agent.name}. Parte do Conselho Estratégico da Nath.
MISSÃO: Dar clareza e direção imediata.

REGRAS DE OURO DE FORMATAÇÃO (ESTRITAMENTE OBRIGATÓRIO):
1. PROIBIDO: Usar '***', '---', divisores de seção ou cabeçalhos grandes (Markdown # ou ##).
2. RESPONDA EM BLOCOS PEQUENOS: Use parágrafos de no máximo 2-3 linhas.
3. ESTILO CHAT: Fale como no WhatsApp. Natural, sem cara de relatório formal.
4. CLAREZA: Se a Nath estiver sendo vaga, faça 1 ou 2 perguntas curtas de clarificação antes de aprofundar.

${humanCheck}

Nível de Confronto: ${confrontationLevel.toUpperCase()}. ${levelInstructions[confrontationLevel]}
${agent.template}
${timeInfo}`;

  const contents: any[] = history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));

  const currentMessageParts: any[] = [{ text: userMessage }];
  
  attachments.forEach(att => {
    if (att.base64) {
      currentMessageParts.push({
        inlineData: {
          mimeType: att.fileType === 'audio' ? 'audio/webm' : (att.fileType === 'image' ? 'image/jpeg' : 'application/pdf'),
          data: att.base64.split(',')[1]
        }
      });
    }
  });

  contents.push({ role: 'user', parts: currentMessageParts });

  return retryWithExponentialBackoff(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        temperature: 0.8,
      },
    });
    return response.text;
  }).catch(error => {
    console.error(`Erro final após retentativas para ${agentId}:`, error);
    return `Nath, tive um erro técnico (429 ou conexão). Pode tentar de novo em alguns segundos?`;
  });
};
