export type { GenericDBAdapterInterface } from './adapters/db';

export type { GenericGroupAdapter } from './adapters/group';

export { LevelDBAdapter } from './adapters/leveldb';

export type { GroupID, GroupMember } from './models/group';

export { EmptyPostMeta, type PostMeta } from './models/postmeta';

export type { Proof, ProofType, RLNProof, SignatureProof } from './models/proof';

export type { User } from './models/user';

export { EmptyUserMeta, type UserMeta, type UserMetaKey } from './models/usermeta';

export type { ChatMeta, DirectMessageChatMeta } from './models/chats';

export { Zkitter } from './services';

export { deriveChatId } from './utils/chat';

export {
  decrypt,
  deriveSharedSecret,
  encrypt,
  randomBytes,
  sha256,
  signWithP256,
  verifySignatureP256,
} from './utils/crypto';

export * as Utils from './utils/encoding';

export { hexify, toBigInt } from './utils/encoding';

export type { ZkitterEvents } from './utils/events';

export { Filter, type FilterOptions } from './utils/filters';

export {
  generateECDHKeyPairFromHex,
  generateECDHKeyPairFromZKIdentity,
  generateECDHWithP256,
  generateIdentity,
  generateP256FromHex,
  generateP256FromSeed,
  generateZkIdentityFromHex,
  generateZKIdentityWithP256,
} from './utils/identity';

export { Chat, Connection, Message, Moderation, Post, Profile, Revert, type AnyMessage, type AnyJSON } from './utils/message';

export {
  type ChatJSON,
  type ChatMessageOption,
  ChatMessageSubType,
  type ConnectionJSON,
  type ConnectionMessageOption,
  ConnectionMessageSubType,
  MessageType,
  type ModerationJSON,
  type ModerationMessageOption,
  ModerationMessageSubType,
  parseMessageId,
  type PostJSON,
  type PostMessageOption,
  PostMessageSubType,
  type ProfileJSON,
  type ProfileMessageOption,
  ProfileMessageSubType,
} from './utils/message';

export { createRLNProof, verifyRLNProof } from './utils/zk';
