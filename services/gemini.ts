
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
        currentDelay *= 2; // Dobra o tempo de espera
        continue;
      }
      throw error;
    }
  }
  return await fn();
}

export const generateAgentResponse = async (
  agentId: AgentId,
  userMessage: string,
  history: Message[],
  timeContext?: TimeContext,
  confrontationLevel: ConfrontationLevel = 'direto',
  attachments: Attachment[] = []
) => {
  const agent = AGENTS[agentId];
  // Mudando para gemini-3-flash-preview por padrão para evitar erros 429 frequentes no Pro
  // Flash tem limites de quota muito maiores para o plano gratuito.
  const model = "gemini-3-flash-preview";
  
  const timeInfo = timeContext 
    ? `Contexto temporal: ${timeContext.localTime}, ${timeContext.dayOfWeek}.` 
    : "";

  const levelInstructions = {
    leve: "Tom de conselheiro sábio, menos pressão.",
    direto: "Sem rodeios. Vá no ponto crítico imediatamente.",
    confrontador: "Dureza total. Se a Nath estiver se enganando, exponha isso sem dó."
  };

  const systemInstruction = `Você é ${agent.name}. Parte do Conselho Estratégico da Nath.
MISSÃO: Dar clareza e direção imediata.

DIRETRIZES DE RESPOSTA (CRÍTICO):
1. RESPONDA EM BLOCOS PEQUENOS: Nunca mande "textões". Use parágrafos de no máximo 2-3 linhas.
2. TOM DE CHAT: Fale como se estivesse no WhatsApp. Direto, autoritário, mas humano.
3. ANÁLISE MULTIMODAL: Se houver imagens ou vídeos, analise-os minuciosamente dentro do seu foco (${agent.focus}).
4. CONSELHO: Cite os outros membros do conselho se houver opiniões deles no histórico.

ESTRUTURA SUGERIDA:
- Feedback imediato sobre o que foi enviado.
- O perigo/oportunidade que ela não viu.
- O que fazer agora (Recomendação).
- Pergunta final de 1 linha.

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
          mimeType: att.fileType,
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
        temperature: 0.75,
      },
    });
    return response.text;
  }).catch(error => {
    console.error(`Erro final após retentativas para ${agentId}:`, error);
    if (error?.message?.includes('429')) {
      return `Nath, o limite de requisições foi atingido (Erro 429). Por favor, aguarde um minuto ou selecione sua própria chave de API nas configurações da barra lateral para continuar sem limites.`;
    }
    return `Nath, tive um erro técnico ao processar seu conteúdo. Pode reenviar?`;
  });
};
