
import { Project, Thread, Message, AgentId, Tese, Tag, WarMapNode, WarMapConnection, WarMapFolder, UserProfile, AgentCustomizations } from '../types';

const STORAGE_KEYS = {
  PROJECTS: 'conselho_projects_v7',
  THREADS: 'conselho_threads_v7',
  MESSAGES: 'conselho_messages_v7',
  TAGS: 'conselho_tags_v7',
  COUNSELOR_PROFILES: 'conselho_agent_profiles_v7',
  USER_PROFILE: 'conselho_user_profile_v7',
  AGENT_CUSTOMS: 'conselho_agent_customs_v7',
  TESES: 'conselho_teses_v7',
  WAR_MAP_FOLDERS: 'conselho_warmap_folders_v7',
  WAR_MAP_NODES: 'conselho_warmap_nodes_v7',
  WAR_MAP_CONNECTIONS: 'conselho_warmap_conns_v7',
};

export const storage = {
  getProjects: (): Project[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.PROJECTS) || '[]'),
  saveProject: (project: Project) => {
    const projects = storage.getProjects();
    const index = projects.findIndex(p => p.id === project.id);
    if (index >= 0) projects[index] = project;
    else projects.push(project);
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
  },
  deleteProject: (id: string) => {
    const projects = storage.getProjects().filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
  },

  getThreads: (): Thread[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.THREADS) || '[]'),
  saveThread: (thread: Thread) => {
    const threads = storage.getThreads();
    const index = threads.findIndex(t => t.id === thread.id);
    if (index >= 0) threads[index] = thread;
    else threads.push(thread);
    localStorage.setItem(STORAGE_KEYS.THREADS, JSON.stringify(threads));
    return thread;
  },
  deleteThread: (id: string) => {
    const threads = storage.getThreads().filter(t => t.id !== id);
    localStorage.setItem(STORAGE_KEYS.THREADS, JSON.stringify(threads));
    const messages = storage.getAllMessages().filter(m => m.threadId !== id);
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
  },

  getAllMessages: (): Message[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.MESSAGES) || '[]'),
  getMessagesByThread: (threadId: string): Message[] => {
    return storage.getAllMessages().filter(m => m.threadId === threadId);
  },
  saveMessage: (message: Message) => {
    const messages = storage.getAllMessages();
    messages.push(message);
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
  },
  updateMessage: (message: Message) => {
    const messages = storage.getAllMessages();
    const index = messages.findIndex(m => m.id === message.id);
    if (index >= 0) {
      messages[index] = message;
      localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
    }
  },

  getTags: (): Tag[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.TAGS) || '[]'),
  saveTag: (tag: Tag) => {
    const tags = storage.getTags();
    const index = tags.findIndex(t => t.id === tag.id);
    if (index >= 0) tags[index] = tag;
    else tags.push(tag);
    localStorage.setItem(STORAGE_KEYS.TAGS, JSON.stringify(tags));
  },
  deleteTag: (tagId: string) => {
    const tags = storage.getTags().filter(t => t.id !== tagId);
    localStorage.setItem(STORAGE_KEYS.TAGS, JSON.stringify(tags));
    const messages = storage.getAllMessages().map(m => ({
      ...m,
      tagIds: m.tagIds?.filter(id => id !== tagId)
    }));
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
  },

  getFolders: (): WarMapFolder[] => {
    const stored = localStorage.getItem(STORAGE_KEYS.WAR_MAP_FOLDERS);
    if (!stored) {
      const defaultFolders: WarMapFolder[] = [{ id: 'general', name: 'Geral', icon: '📂', color: '#4f46e5', createdAt: Date.now() }];
      localStorage.setItem(STORAGE_KEYS.WAR_MAP_FOLDERS, JSON.stringify(defaultFolders));
      return defaultFolders;
    }
    return JSON.parse(stored);
  },
  saveFolder: (folder: WarMapFolder) => {
    const folders = storage.getFolders();
    const index = folders.findIndex(f => f.id === folder.id);
    if (index >= 0) folders[index] = folder;
    else folders.push(folder);
    localStorage.setItem(STORAGE_KEYS.WAR_MAP_FOLDERS, JSON.stringify(folders));
  },
  deleteFolder: (id: string) => {
    if (id === 'general') return;
    const folders = storage.getFolders().filter(f => f.id !== id);
    localStorage.setItem(STORAGE_KEYS.WAR_MAP_FOLDERS, JSON.stringify(folders));
    const nodes = storage.getNodes().map(n => n.folderId === id ? { ...n, folderId: 'general' } : n);
    localStorage.setItem(STORAGE_KEYS.WAR_MAP_NODES, JSON.stringify(nodes));
  },

  getNodes: (): WarMapNode[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.WAR_MAP_NODES) || '[]'),
  saveNode: (node: WarMapNode) => {
    const nodes = storage.getNodes();
    const index = nodes.findIndex(n => n.id === node.id);
    if (index >= 0) nodes[index] = node;
    else nodes.push(node);
    localStorage.setItem(STORAGE_KEYS.WAR_MAP_NODES, JSON.stringify(nodes));
  },
  deleteNode: (id: string) => {
    const nodes = storage.getNodes().filter(n => n.id !== id);
    localStorage.setItem(STORAGE_KEYS.WAR_MAP_NODES, JSON.stringify(nodes));
    const conns = storage.getConnections().filter(c => c.fromId !== id && c.toId !== id);
    localStorage.setItem(STORAGE_KEYS.WAR_MAP_CONNECTIONS, JSON.stringify(conns));
  },

  getConnections: (): WarMapConnection[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.WAR_MAP_CONNECTIONS) || '[]'),
  saveConnection: (conn: WarMapConnection) => {
    const conns = storage.getConnections();
    conns.push(conn);
    localStorage.setItem(STORAGE_KEYS.WAR_MAP_CONNECTIONS, JSON.stringify(conns));
  },
  deleteConnection: (id: string) => {
    const conns = storage.getConnections().filter(c => c.id !== id);
    localStorage.setItem(STORAGE_KEYS.WAR_MAP_CONNECTIONS, JSON.stringify(conns));
  },

  getAgentCustoms: (): AgentCustomizations => JSON.parse(localStorage.getItem(STORAGE_KEYS.AGENT_CUSTOMS) || '{}'),
  saveAgentCustom: (agentId: string, custom: { avatar?: string }) => {
    const customs = storage.getAgentCustoms();
    customs[agentId] = { ...customs[agentId], ...custom };
    localStorage.setItem(STORAGE_KEYS.AGENT_CUSTOMS, JSON.stringify(customs));
  },

  getUserProfile: (): UserProfile => JSON.parse(localStorage.getItem(STORAGE_KEYS.USER_PROFILE) || '{"name": "Diretora Nath"}'),
  saveUserProfile: (profile: UserProfile) => localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile))
};
