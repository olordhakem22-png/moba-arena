export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  type: MessageType;
  timestamp: Date;
  isEdited: boolean;
  replyTo?: string;
  reactions: MessageReaction[];
  isDeleted: boolean;
}

export type MessageType = 'text' | 'system' | 'link' | 'image' | 'emote';

export interface MessageReaction {
  emoji: string;
  userIds: string[];
  count: number;
}

export interface ChatChannel {
  id: string;
  type: ChannelType;
  name: string;
  description: string;
  members: string[];
  isPrivate: boolean;
  createdAt: Date;
  lastMessage?: ChatMessage;
  unreadCount: number;
}

export type ChannelType = 'global' | 'team' | 'match' | 'clan' | 'private';

export interface ChatServerMessage {
  type: 'message' | 'typing' | 'read' | 'presence' | 'system';
  channelId: string;
  senderId?: string;
  content?: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

export interface Clan {
  id: string;
  name: string;
  tag: string;
  description: string;
  avatar: string;
  banner: string;
  level: number;
  memberCount: number;
  maxMembers: number;
  leaderId: string;
  leaderName: string;
  createdAt: Date;
  isRecruiting: boolean;
  requiredRank: string;
}

export interface ClanMember {
  userId: string;
  username: string;
  avatar: string;
  rank: string;
  role: ClanRole;
  joinedAt: Date;
  contribution: number;
  weeklyContribution: number;
}

export type ClanRole = 'leader' | 'officer' | 'member';
