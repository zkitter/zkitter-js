import { User } from '../models/user';
import { AnyMessage, Connection, Message, Moderation, Post, Profile } from '../utils/message';
import { PostMeta } from '../models/postmeta';
import { UserMeta } from '../models/usermeta';
import { Proof } from '../models/proof';
import { GroupMember } from '../models/group';

export interface GenericDBAdapterInterface {
  getUserCount: () => Promise<number>;
  getLastArbitrumBlockScanned: () => Promise<number>;
  updateLastArbitrumBlockScanned: (block: number) => Promise<number>;
  getHistoryDownloaded: (user?: string) => Promise<boolean>;
  setHistoryDownloaded: (downloaded: boolean, user?: string) => Promise<void>;
  updateUser: (user: User) => Promise<User>;
  getUsers: (limit?: number, offset?: number | string) => Promise<User[]>;
  getUser: (address: string) => Promise<User | null>;
  getUserMeta: (address: string) => Promise<UserMeta>;
  getProof: (hash: string) => Promise<Proof | null>;
  insertGroupMember: (groupId: string, member: GroupMember) => Promise<GroupMember | null>;
  getGroupMembers: (groupId: string, limit?: number, offset?: number | string) => Promise<string[]>;
  findGroupHash: (hash: string) => Promise<string | null>;
  insertPost: (post: Post, proof: Proof) => Promise<Post>;
  insertModeration: (moderation: Moderation, proof: Proof) => Promise<Moderation | null>;
  insertConnection: (connection: Connection, proof: Proof) => Promise<Connection | null>;
  insertProfile: (profile: Profile, proof: Proof) => Promise<Profile | null>;
  getMessagesByUser: (
    address: string,
    limit?: number,
    offset?: number | string
  ) => Promise<AnyMessage[]>;
  getPostMeta: (postHash: string) => Promise<PostMeta>;
  getPost: (hash: string) => Promise<Post | null>;
  getPosts: (limit?: number, offset?: number | string) => Promise<Post[]>;
  getFollowings: (address: string) => Promise<string[]>;
  getHomefeed: (
    filter: {
      addresses: { [address: string]: true };
      groups: { [groupId: string]: true };
    },
    limit?: number,
    offset?: number | string
  ) => Promise<Post[]>;
  getUserPosts: (address: string, limit?: number, offset?: number | string) => Promise<Post[]>;
  getReplies: (hash: string, limit?: number, offset?: number | string) => Promise<Post[]>;
  getReposts: (hash: string, limit?: number, offset?: number | string) => Promise<string[]>;
  getModerations: (hash: string, limit?: number, offset?: number | string) => Promise<Moderation[]>;
  getConnections: (
    address: string,
    limit?: number,
    offset?: number | string
  ) => Promise<Connection[]>;
}
