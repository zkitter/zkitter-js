import { ChatMeta } from '../models/chats';
import { GroupMember } from '../models/group';
import { PostMeta } from '../models/postmeta';
import { Proof } from '../models/proof';
import { User } from '../models/user';
import { UserMeta, UserMetaKey } from '../models/usermeta';
import { Filter } from '../utils/filters';
import { AnyMessage, Chat, Connection, Message, Moderation, Post, Profile } from '../utils/message';

export interface GenericDBAdapterInterface {
  getUserCount: () => Promise<number>;
  getLastArbitrumBlockScanned: () => Promise<number>;
  updateLastArbitrumBlockScanned: (block: number) => Promise<number>;
  getHistoryDownloaded: (user?: string, group?: boolean) => Promise<boolean>;
  setHistoryDownloaded: (downloaded: boolean, user?: string, group?: boolean) => Promise<void>;
  updateUser: (user: User) => Promise<User>;
  getUsers: (limit?: number, offset?: number | string) => Promise<User[]>;
  getUser: (address: string) => Promise<User | null>;
  getUserMeta: (address: string) => Promise<UserMeta>;
  getUserByECDH: (ecdh: string) => Promise<string | null>;
  getProof: (hash: string) => Promise<Proof | null>;
  insertGroupMember: (groupId: string, member: GroupMember) => Promise<GroupMember | null>;
  getGroupMembers: (groupId: string, limit?: number, offset?: number | string) => Promise<string[]>;
  findGroupHash: (hash: string, groupId?: string) => Promise<string | null>;
  saveChatECDH: (addressOrIdCommitment: string, ecdh: string) => Promise<string>;
  getMessagesByUser: (
    address: string,
    limit?: number,
    offset?: number | string
  ) => Promise<AnyMessage[]>;
  getPostMeta: (postHash: string) => Promise<PostMeta>;
  getMessage: (hash: string) => Promise<AnyMessage | null>;
  getPost: (hash: string) => Promise<Post | null>;
  getPosts: (limit?: number, offset?: number | string) => Promise<Post[]>;
  getFollowings: (address: string) => Promise<string[]>;
  getHomefeed: (filter: Filter, limit?: number, offset?: number | string) => Promise<Post[]>;
  getUserPosts: (address: string, limit?: number, offset?: number | string) => Promise<Post[]>;
  getGroupPosts: (groupId: string, limit?: number, offset?: number | string) => Promise<Post[]>;
  getReplies: (hash: string, limit?: number, offset?: number | string) => Promise<Post[]>;
  getReposts: (hash: string, limit?: number, offset?: number | string) => Promise<string[]>;
  getModerations: (hash: string, limit?: number, offset?: number | string) => Promise<Moderation[]>;
  getConnections: (
    address: string,
    limit?: number,
    offset?: number | string
  ) => Promise<Connection[]>;
  getChatECDHByUser: (addressOrIdCommitment: string) => Promise<string[]>;
  getChatByECDH: (ecdh: string) => Promise<ChatMeta[]>;
  getChatMeta: (ecdh: string, chatId: string) => Promise<ChatMeta | null>;
  getChatMessages: (chatId: string, limit?: number, offset?: number | string) => Promise<Chat[]>;
  addMessage: (msg: Message) => Promise<void>;
  addProof: (msg: Message, proof: Proof) => Promise<void>;
  addUserMessage: (msg: Message) => Promise<void>;
  addToPostlist: (post: Post) => Promise<void>;
  addToUserPosts: (post: Post) => Promise<void>;
  addToGroupPosts: (post: Post, proof: Proof) => Promise<void>;
  addToThread: (post: Post) => Promise<void>;
  incrementCreatorPostCount: (post: Post) => Promise<void>;
  incrementReplyCount: (post: Post) => Promise<void>;
  incrementRepostCount: (post: Post) => Promise<void>;
  incrementLikeCount: (mod: Moderation) => Promise<void>;
  incrementBlockCount: (mod: Moderation) => Promise<void>;
  decrementCreatorPostCount: (post: Post) => Promise<void>;
  decrementReplyCount: (post: Post) => Promise<void>;
  decrementRepostCount: (post: Post) => Promise<void>;
  decrementLikeCount: (mod: Moderation) => Promise<void>;
  decrementBlockCount: (mod: Moderation) => Promise<void>;
  removeFromPostlist: (post: Post) => Promise<void>;
  removeFromUserPosts: (post: Post) => Promise<void>;
  removeFromThread: (post: Post) => Promise<void>;
  removeFromGroupPosts(post: Post, proof: Proof): Promise<void>;
  addToThreadModerations: (mod: Moderation) => Promise<void>;
  updateThreadVisibility(mod: Moderation): Promise<void>;
  updateThreadModeration(mod: Moderation): Promise<void>;
  addToConnections(conn: Connection): Promise<void>;
  incrementFollowerCount(conn: Connection): Promise<void>;
  incrementBlockerCount(conn: Connection): Promise<void>;
  updateProfile(profile: Profile, key: UserMetaKey): Promise<void>;
  updateUserECDH(profile: Profile): Promise<void>;
  addChatMessage(chat: Chat): Promise<void>;
  addDirectChatMeta(chat: Chat): Promise<void>;
  setLastSync(
    id: string,
    type: 'address' | 'group' | 'ecdh' | 'thread',
    time?: Date
  ): Promise<void>;
  getLastSync(id: string, type: 'address' | 'group' | 'ecdh' | 'thread'): Promise<number>;
}
