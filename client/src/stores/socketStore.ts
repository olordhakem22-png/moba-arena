import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './authStore.js';
import toast from 'react-hot-toast';

export const useSocketStore = create<{
  socket: Socket | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  emit: (event: string, data?: any) => void;
}>((set, get) => ({
  socket: null,
  isConnected: false,

  connect: () => {
    const { accessToken } = useAuthStore.getState();
    if (!accessToken || get().socket?.connected) return;

    const socket = io({
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      set({ isConnected: true });
      console.log('🔌 Socket connected');
    });

    socket.on('disconnect', () => {
      set({ isConnected: false });
      console.log('🔌 Socket disconnected');
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    // Game events
    socket.on('game:chat', (data) => {
      useGameStore.getState().addChatMessage(data);
    });

    socket.on('game:ping', (data) => {
      useGameStore.getState().handlePing(data);
    });

    socket.on('game:emote', (data) => {
      useGameStore.getState().handleEmote(data);
    });

    socket.on('queue:matched', (data) => {
      toast.success('Match found! Entering game...');
      window.location.href = `/game/${data.gameId}`;
    });

    socket.on('friends:statusChange', (data) => {
      useSocialStore.getState().updateFriendStatus(data.userId, data.status);
    });

    set({ socket });
  },

  disconnect: () => {
    get().socket?.disconnect();
    set({ socket: null, isConnected: false });
  },

  emit: (event, data) => {
    get().socket?.emit(event, data);
  },
}));

// Game store for in-game state
export const useGameStore = create<{
  gameId: string | null;
  phase: string;
  time: number;
  isInGame: boolean;
  chatMessages: any[];
  addChatMessage: (msg: any) => void;
  handlePing: (data: any) => void;
  handleEmote: (data: any) => void;
  setGameId: (id: string | null) => void;
  setPhase: (phase: string) => void;
  setTime: (time: number) => void;
  setInGame: (inGame: boolean) => void;
}>((set, get) => ({
  gameId: null,
  phase: 'loading',
  time: 0,
  isInGame: false,
  chatMessages: [],

  addChatMessage: (msg) => {
    set({ chatMessages: [...get().chatMessages, msg].slice(-100) });
  },
  handlePing: () => {},
  handleEmote: () => {},
  setGameId: (id) => set({ gameId: id }),
  setPhase: (phase) => set({ phase }),
  setTime: (time) => set({ time }),
  setInGame: (inGame) => set({ isInGame: inGame }),
}));

// Social store
export const useSocialStore = create<{
  friends: any[];
  onlineUsers: any[];
  updateFriendStatus: (userId: string, status: string) => void;
}>((set) => ({
  friends: [],
  onlineUsers: [],

  updateFriendStatus: (userId, status) => {
    set((state) => ({
      friends: state.friends.map((f) => (f.id === userId ? { ...f, status } : f)),
    }));
  },
}));
