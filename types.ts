
export type AgentId = 'flavio' | 'conrado' | 'rafa' | 'council';

export enum MessageMode {
  NOTE = 'note',
  SINGLE = 'single',
  COUNCIL = 'council'
}

export type NodeType = 'insight' | 'tensao' | 'pergunta' | 'decisao' | 'acao' | 'evidencia' | 'anexo';

export interface WarMapFolder {
  id: string;
  name: string;
  icon: string;
  color: string;
  createdAt: number;
}

export interface WarMapNode {
  id: string;
  folderId: string;
  type: NodeType;
  content: string;
  notes?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  author?: string;
  sourceThreadId?: string;
  sourceMessageId?: string;
  attachments?: Attachment[];
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface WarMapConnection {
  id: string;
  fromId: string;
  toId: string;
}

export type ConfrontationLevel = 'leve' | 'direto' | 'confrontador';

export interface Attachment {
  id: string;
  fileUrl: string;
  fileType: string;
  filename: string;
  base64?: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export interface Message {
  id: string;
  threadId: string;
  role: 'user' | 'agent';
  mode: MessageMode;
  agentId?: AgentId;
  content: string;
  attachments?: Attachment[];
  tagIds?: string[];
  createdAt: number;
  isFavorite?: boolean;
  isActionPlan?: boolean;
}

export interface Thread {
  id: string;
  title: string;
  projectId?: string;
  contactId?: string;
  tags: string[];
  createdAt: number;
  lastActivityAt: number;
  isArchived?: boolean;
  autoTitleSuggested?: boolean;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  defaultAgents: AgentId[];
  createdAt: number;
}

export interface Tese {
  id: string;
  title: string;
  context: string;
  decision: string;
  hypothesis: string;
  expectedResult: string;
  metric: string;
  reviewDate: number;
  status: 'active' | 'reviewed';
  outcome?: string;
  learnings?: string;
  createdAt: number;
}

export interface AgentProfile {
  id: AgentId;
  name: string;
  description: string;
  focus: string;
  template: string;
  color: string;
  avatar?: string;
}

export interface UserProfile {
  name: string;
  avatar?: string;
}

export interface AgentCustomizations {
  [key: string]: {
    avatar?: string;
  };
}

export interface TimeContext {
  localTime: string;
  timezone: string;
  dayOfWeek: string;
}
