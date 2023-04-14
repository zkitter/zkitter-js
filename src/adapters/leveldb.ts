import { BatchOperation, Level } from 'level';
import { ChatMeta } from '../models/chats';
import { GroupMember } from '../models/group';
import { EmptyPostMeta, PostMeta } from '../models/postmeta';
import { Proof, ProofType } from '../models/proof';
import { User } from '../models/user';
import { EmptyUserMeta, UserMeta, UserMetaKey } from '../models/usermeta';
import { deriveChatId } from '../utils/chat';
import { Filter } from '../utils/filters';
import {
  AnyMessage,
  Chat,
  ChatJSON,
  Connection,
  ConnectionJSON,
  ConnectionMessageSubType,
  Message,
  MessageType,
  Moderation,
  ModerationJSON,
  ModerationMessageSubType,
  parseMessageId,
  Post,
  PostJSON,
  PostMessageSubType,
  Profile,
  ProfileJSON,
  ProfileMessageSubType,
  Revert,
  RevertJSON,
} from '../utils/message';
import { GenericDBAdapterInterface } from './db';

const charwise = require('charwise');

const keys = {
  APP: {
    arbitrumProvider: 'arbitrumProvider',
    historyDownloaded: 'historyDownloaded',
    lastArbitrumBlockScanned: 'lastArbitrumBlockScanned',
  },
  META: {
    userCount: 'userCount',
  },
};

export const AlreadyExistError = new Error('already exist');

export class LevelDBAdapter implements GenericDBAdapterInterface {
  db: Level;
  udb: Level;

  static async initialize(path?: string, udbPath?: string) {
    const db = new Level(path || './zkitterdb', { valueEncoding: 'json' });
    const udb = new Level(udbPath || './zkitter_userdb', { valueEncoding: 'json' });
    await db.open();
    await udb.open();
    return new LevelDBAdapter(db, udb);
  }

  constructor(db: Level, udb: Level) {
    this.db = db;
    this.udb = udb;
  }

  get appDB() {
    return this.db.sublevel<string, number | string | boolean>('app', {
      valueEncoding: 'json',
    });
  }

  get arbDB() {
    return this.udb.sublevel<string, number>('arbitrum', { valueEncoding: 'json' });
  }

  get userDB() {
    return this.udb.sublevel<string, User>('users', { valueEncoding: 'json' });
  }

  get postMetaDB() {
    return this.db.sublevel<string, PostMeta>('postmeta', {
      valueEncoding: 'json',
    });
  }

  get userMetaDB() {
    return this.db.sublevel<string, UserMeta>('usermeta', {
      valueEncoding: 'json',
    });
  }

  get postlistDB() {
    return this.db.sublevel<string, string>('postlist', {
      valueEncoding: 'json',
    });
  }

  get lastSyncDB() {
    return this.db.sublevel<string, number>('lastSync', { valueEncoding: 'json' });
  }

  proofDB<proofType>() {
    return this.db.sublevel<string, proofType>('proofs', {
      valueEncoding: 'json',
    });
  }

  messageDB<messageType>() {
    return this.db.sublevel<string, messageType>('messages', {
      valueEncoding: 'json',
    });
  }

  moderationsDB(threadHash: string) {
    return this.db.sublevel<string, string>(threadHash + '/moderations', {
      valueEncoding: 'json',
    });
  }

  connectionsDB(address: string) {
    return this.db.sublevel<string, string>(address + '/connections', {
      valueEncoding: 'json',
    });
  }

  userPostsDB(address: string) {
    return this.db.sublevel<string, string>(address + '/posts', {
      valueEncoding: 'json',
    });
  }

  groupPostsDB(groupId: string) {
    return this.db.sublevel<string, string>(groupId + '/gposts', {
      valueEncoding: 'json',
    });
  }

  userMessageDB(address: string) {
    return this.db.sublevel<string, string>(address + '/messages', {
      valueEncoding: 'json',
    });
  }

  chatDB(chatId: string) {
    return this.db.sublevel<string, string>(chatId, { valueEncoding: 'json' });
  }

  chatMetaDB(ecdh: string) {
    return this.db.sublevel<string, ChatMeta>(ecdh + '/chatMeta', {
      valueEncoding: 'json',
    });
  }

  savedChatECDHDB(addressOrIdCommitment: string) {
    return this.db.sublevel<string, string>(addressOrIdCommitment + '/savedChatECDH', {
      valueEncoding: 'json',
    });
  }

  threadDB(threadHash: string) {
    return this.db.sublevel<string, string>(threadHash + '/replies', {
      valueEncoding: 'json',
    });
  }

  repostDB(threadHash: string) {
    return this.db.sublevel<string, string>(threadHash + '/reposts', {
      valueEncoding: 'json',
    });
  }

  groupMembersDB(groupId: string) {
    return this.db.sublevel<string, GroupMember>(groupId + '/members', {
      valueEncoding: 'json',
    });
  }

  groupMemberlistDB(groupId: string) {
    return this.db.sublevel<string, string>(groupId + '/memberlist', {
      valueEncoding: 'json',
    });
  }

  get userECDHDB() {
    return this.db.sublevel<string, string>('userECDH', { valueEncoding: 'json' });
  }

  groupRootsDB(rootHash: string) {
    return this.db.sublevel<string, string>(rootHash + '/groupRoots', {
      valueEncoding: 'json',
    });
  }

  private encodeMessageSortKey(message: Message): string {
    return (
      charwise.encode(message.createdAt.getTime()) +
      '_' +
      charwise.encode(message.creator).toString('hex')
    );
  }

  async getUserCount(): Promise<number> {
    const keys = await this.userDB.keys().all();
    return keys.length;
  }

  async getArbitrumProvider(): Promise<string> {
    const arbitrumProvider = await this.appDB.get(keys.APP.arbitrumProvider).catch(() => '');
    return String(arbitrumProvider) || 'https://arb1.arbitrum.io/rpc';
  }

  async setHistoryDownloaded(downloaded: boolean, user?: string, group = false): Promise<void> {
    if (group) {
      return this.appDB.put(keys.APP.historyDownloaded + '/group', downloaded);
    }

    if (typeof user === 'string') {
      return this.appDB.put(keys.APP.historyDownloaded + '/' + user, downloaded);
    }

    return this.appDB.put(keys.APP.historyDownloaded, downloaded);
  }

  async getHistoryDownloaded(user?: string, group = false): Promise<boolean> {
    const mod = typeof user === 'string' ? '/' + user : '';

    if (await this.appDB.get(keys.APP.historyDownloaded).catch(() => false)) {
      return true;
    }

    if (group) {
      return this.appDB
        .get(keys.APP.historyDownloaded + '/group')
        .catch(() => false) as Promise<boolean>;
    }

    if (typeof user === 'string') {
      return this.appDB
        .get(keys.APP.historyDownloaded + '/' + user)
        .catch(() => false) as Promise<boolean>;
    }

    return this.appDB
      .get(keys.APP.historyDownloaded + mod)
      .then(historyDownloaded => !!historyDownloaded)
      .catch(() => false);
  }

  async setArbitrumProvider(provider: string): Promise<void> {
    return this.appDB.put(keys.APP.arbitrumProvider, provider);
  }

  async getLastArbitrumBlockScanned(): Promise<number> {
    try {
      const block = await this.arbDB.get(keys.APP.lastArbitrumBlockScanned);
      const blockNumber = Number(block);
      if (block && !isNaN(blockNumber)) {
        return blockNumber;
      }
    } catch (err) {
      if (err && err.code === 'LEVEL_NOT_FOUND') {
        await this.updateLastArbitrumBlockScanned(2193241);
      }
    }

    return 2193241;
  }

  async setLastSync(
    id: string,
    type: 'address' | 'group' | 'ecdh' | 'thread',
    time?: Date
  ): Promise<void> {
    return this.lastSyncDB.put(type + '_' + id, time?.getTime() || Date.now());
  }

  async getLastSync(id: string, type: 'address' | 'group' | 'ecdh' | 'thread'): Promise<number> {
    return this.lastSyncDB.get(type + '_' + id).catch(() => 0);
  }

  async getProof(hash: string): Promise<Proof | null> {
    return this.proofDB<Proof>()
      .get(hash)
      .catch(() => null);
  }

  async updateLastArbitrumBlockScanned(block: number): Promise<any> {
    return this.arbDB.put(keys.APP.lastArbitrumBlockScanned, block);
  }

  async updateUser(user: User): Promise<User> {
    const existing = await this.getUser(user.address);

    if (!existing || existing.joinedAt < user.joinedAt) {
      await this.userDB.put(user.address, user);
    }

    return user;
  }

  async getUsers(limit?: number, gt?: number | string): Promise<User[]> {
    const options: any = { valueEncoding: 'json' };

    if (typeof gt === 'number') throw new Error(`"gte" must be an address`);
    if (typeof gt === 'string') options.gt = gt;
    if (typeof limit === 'number') options.limit = limit;

    return (await this.userDB.values(options).all()).map(user => {
      if (user?.joinedAt) user.joinedAt = new Date(user.joinedAt);
      return user;
    });
  }

  async getUser(address: string): Promise<User | null> {
    try {
      const user = await this.userDB.get(address);
      if (user?.joinedAt) user.joinedAt = new Date(user.joinedAt);
      return user || null;
    } catch (err) {
      return null;
    }
  }

  async getPostMeta(postHash: string): Promise<PostMeta> {
    const postmeta = await this.postMetaDB.get(postHash).catch(() => EmptyPostMeta());
    return postmeta;
  }

  async getPost(postHash: string): Promise<Post | null> {
    const json = await this.messageDB<PostJSON>()
      .get(postHash)
      .catch(() => null);

    if (!json) return null;

    if (json.type === MessageType.Post) {
      return Post.fromJSON(json);
    }

    return null;
  }

  async getMessage(hash: string): Promise<AnyMessage | null> {
    const json = await this.messageDB<
      PostJSON | ModerationJSON | ConnectionJSON | ProfileJSON | ChatJSON | RevertJSON
    >()
      .get(hash)
      .catch(() => null);

    if (!json) return null;

    switch (json.type) {
      case MessageType.Post:
        return Post.fromJSON(json as PostJSON);
      case MessageType.Moderation:
        return Moderation.fromJSON(json as ModerationJSON);
      case MessageType.Connection:
        return Connection.fromJSON(json as ConnectionJSON);
      case MessageType.Profile:
        return Profile.fromJSON(json as ProfileJSON);
      case MessageType.Chat:
        return Chat.fromJSON(json as ChatJSON);
      case MessageType.Revert:
        return Revert.fromJSON(json as RevertJSON);
    }

    return null;
  }

  async getUserByECDH(ecdh: string): Promise<string | null> {
    return this.userECDHDB.get(ecdh).catch(() => null);
  }

  async getUserMeta(address: string): Promise<UserMeta> {
    const usermeta = await this.userMetaDB.get(address).catch(() => EmptyUserMeta());
    const getValue = async (key: UserMetaKey) => {
      return this.messageDB<ProfileJSON>()
        .get(usermeta[key])
        .then(p => p.payload.value)
        .catch(() => '');
    };

    if (usermeta.nickname) usermeta.nickname = await getValue('nickname');
    if (usermeta.coverImage) usermeta.coverImage = await getValue('coverImage');
    if (usermeta.profileImage) usermeta.profileImage = await getValue('profileImage');
    if (usermeta.bio) usermeta.bio = await getValue('bio');
    if (usermeta.twitterVerification)
      usermeta.twitterVerification = await getValue('twitterVerification');
    if (usermeta.website) usermeta.website = await getValue('website');
    if (usermeta.ecdh) usermeta.ecdh = await getValue('ecdh');
    if (usermeta.idCommitment) usermeta.idCommitment = await getValue('idCommitment');

    return usermeta;
  }

  async getFollowings(address: string): Promise<string[]> {
    const followings = [];
    for (const hash of await this.userMessageDB(address).values().all()) {
      const msg = await this.messageDB<ConnectionJSON>().get(hash);
      if (msg.type === MessageType.Connection && msg.subtype === ConnectionMessageSubType.Follow) {
        followings.push(msg.payload.name);
      }
    }
    return followings;
  }

  async insertGroupMember(groupId: string, member: GroupMember): Promise<GroupMember | null> {
    const existing = await this.groupMembersDB(groupId)
      .get(member.idCommitment)
      .catch(() => null);

    if (existing) {
      return null;
    }

    await this.db.batch([
      {
        key: member.idCommitment,
        sublevel: this.groupMembersDB(groupId),
        type: 'put',
        // @ts-ignore
        value: member,
      },
      {
        key: charwise.encode(member.index).toString('hex'),
        sublevel: this.groupMemberlistDB(groupId),
        type: 'put',
        // @ts-ignore
        value: member.idCommitment,
      },
      {
        key: groupId,
        sublevel: this.groupRootsDB(member.newRoot),
        type: 'put',
        // @ts-ignore
        value: groupId,
      },
    ]);

    return member;
  }

  async updateProfile(profile: Profile, key: UserMetaKey): Promise<void> {
    if (!profile.creator) throw new Error('profile does not have a creator');

    const creatorMeta = await this.userMetaDB.get(profile.creator).catch(() => EmptyUserMeta());
    const hash = creatorMeta[key];
    const msg = await this.messageDB<ProfileJSON>()
      .get(hash)
      .catch(() => null);

    if (!msg || msg.createdAt < profile.createdAt.getTime()) {
      creatorMeta[key] = profile.hash();
    }

    return this.userMetaDB.put(profile.creator, creatorMeta);
  }

  async updateUserECDH(profile: Profile): Promise<void> {
    if (!profile.creator) throw new Error('profile does not have a creator');
    const creatorMeta = await this.getUserMeta(profile.creator);
    const hash = creatorMeta.ecdh;
    const msg = await this.messageDB<ProfileJSON>()
      .get(hash)
      .catch(() => null);

    if (!msg || msg.createdAt < profile.createdAt.getTime()) {
      return this.userECDHDB.put(profile.payload.value, profile.creator);
    }
  }

  async addChatMessage(chat: Chat): Promise<void> {
    const { receiverECDH, senderECDH, senderSeed } = chat.payload;

    const chatId = await deriveChatId(receiverECDH, senderECDH);

    if (chat.creator) {
      await this.savedChatECDHDB(chat.creator).put(senderECDH, senderECDH);
    }

    const receiver = await this.getUserByECDH(receiverECDH);

    if (receiver) {
      await this.savedChatECDHDB(receiver).put(receiverECDH, receiverECDH);
    }

    await this.chatDB(chatId).put(charwise.encode(chat.createdAt.getTime()), chat.hash());
  }

  async addDirectChatMeta(chat: Chat): Promise<void> {
    const { receiverECDH, senderECDH, senderSeed } = chat.payload;

    const chatId = await deriveChatId(receiverECDH, senderECDH);
    const senderMeta = await this.chatMetaDB(chat.payload.senderECDH)
      .get(chatId)
      .catch(() => null);

    const receiverMeta = await this.chatMetaDB(chat.payload.receiverECDH)
      .get(chatId)
      .catch(() => null);

    if (chat.subtype === 'DIRECT') {
      if (!senderMeta) {
        await this.chatMetaDB(senderECDH).put(chatId, {
          chatId,
          receiverECDH,
          senderECDH,
          senderSeed,
          type: chat.subtype,
        });
      }

      if (!receiverMeta) {
        await this.chatMetaDB(receiverECDH).put(chatId, {
          chatId,
          receiverECDH,
          senderECDH,
          senderSeed,
          type: chat.subtype,
        });
      }
    }
  }

  async addMessage(msg: Message): Promise<void> {
    const json = msg.toJSON();
    return this.messageDB().put(json.hash, json);
  }

  async revertMessage(msg: Message): Promise<void> {
    return this.messageDB().del(msg.hash());
  }

  async addProof(msg: Message, proof: Proof): Promise<void> {
    return this.proofDB().put(msg.hash(), proof);
  }

  async addUserMessage(msg: Message): Promise<void> {
    if (!msg.creator) throw new Error('message has no creator');

    return this.userMessageDB(msg.creator).put(
      charwise.encode(msg.createdAt.getTime()),
      msg.hash()
    );
  }

  async addToPostlist(post: Post): Promise<void> {
    return this.postlistDB.put(this.encodeMessageSortKey(post), post.hash());
  }

  async addToUserPosts(post: Post): Promise<void> {
    if (!post.creator) throw new Error('post has no creator');
    return this.userPostsDB(post.creator).put(
      charwise.encode(post.createdAt.getTime()),
      post.hash()
    );
  }

  async addToGroupPosts(post: Post, proof: Proof): Promise<void> {
    if (proof.type !== 'rln') throw new Error('post is not from a group');

    const groupId = await this.findGroupHash(
      proof.proof.publicSignals.merkleRoot as string,
      proof.groupId
    );

    return this.groupPostsDB(groupId || '').put(
      charwise.encode(post.createdAt.getTime()),
      post.hash()
    );
  }

  async addToThread(post: Post): Promise<void> {
    if (
      post.subtype !== PostMessageSubType.Reply &&
      post.subtype !== PostMessageSubType.MirrorReply
    ) {
      throw new Error(`post subtype [${post.subtype}] is not a reply`);
    }

    const { hash } = parseMessageId(post.payload.reference);

    return this.threadDB(hash).put(this.encodeMessageSortKey(post), post.hash());
  }

  async addToThreadModerations(mod: Moderation): Promise<void> {
    const { hash } = parseMessageId(mod.payload.reference);
    return this.moderationsDB(hash).put(
      mod.creator ? mod.subtype + '_' + mod.creator : mod.hash(),
      mod.hash()
    );
  }

  async removeFromThreadModerations(mod: Moderation): Promise<void> {
    const { hash } = parseMessageId(mod.payload.reference);
    return this.moderationsDB(hash).del(mod.creator ? mod.subtype + '_' + mod.creator : mod.hash());
  }

  async updateThreadVisibility(mod: Moderation, isRevert = false): Promise<void> {
    const { hash } = parseMessageId(mod.payload.reference);
    const op = await this.getPost(hash);
    const opMeta = await this.getPostMeta(hash);

    if (op?.creator === mod.creator) {
      switch (mod.subtype) {
        case ModerationMessageSubType.Global:
          opMeta.global = !isRevert;
          return this.postMetaDB.put(hash, opMeta);
      }
    }
  }

  async updateThreadModeration(mod: Moderation): Promise<void> {
    const { hash } = parseMessageId(mod.payload.reference);
    const op = await this.getPost(hash);
    const opMeta = await this.getPostMeta(hash);

    if (op?.creator === mod.creator) {
      switch (mod.subtype) {
        case ModerationMessageSubType.ThreadBlock:
        case ModerationMessageSubType.ThreadFollow:
        case ModerationMessageSubType.ThreadMention:
          opMeta.moderation = mod.subtype;
          return this.postMetaDB.put(hash, opMeta);
        case ModerationMessageSubType.ThreadAll:
          opMeta.moderation = null;
          return this.postMetaDB.put(hash, opMeta);
      }
    }
  }

  async addToConnections(conn: Connection): Promise<void> {
    return this.connectionsDB(conn.payload.name).put(
      conn.creator ? conn.subtype + '_' + conn.creator : conn.hash(),
      conn.hash()
    );
  }

  async removeFromConnections(conn: Connection): Promise<void> {
    return this.connectionsDB(conn.payload.name).del(
      conn.creator ? conn.subtype + '_' + conn.creator : conn.hash()
    );
  }

  async incrementCreatorPostCount(post: Post): Promise<void> {
    if (!post.creator) throw new Error('post has no creator');
    const creatorMeta = await this.userMetaDB.get(post.creator).catch(() => EmptyUserMeta());
    creatorMeta.posts = creatorMeta.posts + 1;
    return this.userMetaDB.put(post.creator, creatorMeta);
  }

  async incrementReplyCount(post: Post): Promise<void> {
    const { hash } = parseMessageId(post.payload.reference);
    const postMeta = await this.getPostMeta(hash);
    postMeta.reply = postMeta.reply + 1;
    return this.postMetaDB.put(hash, postMeta);
  }

  async incrementRepostCount(post: Post): Promise<void> {
    const { hash } = parseMessageId(post.payload.reference);
    const postMeta = await this.getPostMeta(hash);
    postMeta.repost = postMeta.repost + 1;
    return this.postMetaDB.put(hash, postMeta);
  }

  async incrementLikeCount(mod: Moderation): Promise<void> {
    const { hash } = parseMessageId(mod.payload.reference);
    const postMeta = await this.getPostMeta(hash);
    const exist = await this.moderationsDB(hash)
      .get(mod.creator ? mod.subtype + '_' + mod.creator : mod.hash())
      .catch(() => null);

    if (!exist) {
      postMeta.like = postMeta.like + 1;
      return this.postMetaDB.put(hash, postMeta);
    }
  }

  async incrementBlockCount(mod: Moderation): Promise<void> {
    const { hash } = parseMessageId(mod.payload.reference);
    const postMeta = await this.getPostMeta(hash);
    const exist = await this.moderationsDB(hash)
      .get(mod.creator ? mod.subtype + '_' + mod.creator : mod.hash())
      .catch(() => null);

    if (!exist) {
      postMeta.block = postMeta.block + 1;
      return this.postMetaDB.put(hash, postMeta);
    }
  }

  async incrementFollowerCount(conn: Connection): Promise<void> {
    const exist = await this.connectionsDB(conn.payload.name)
      .get(conn.creator ? conn.subtype + '_' + conn.creator : conn.hash())
      .catch(() => null);

    if (!exist) {
      const meta = await this.getUserMeta(conn.payload.name);
      meta.followers = meta.followers + 1;
      await this.userMetaDB.put(conn.payload.name, meta);

      const creatorMeta = await this.getUserMeta(conn.creator);
      creatorMeta.following = creatorMeta.following + 1;
      await this.userMetaDB.put(conn.creator, creatorMeta);
    }
  }

  async incrementBlockerCount(conn: Connection): Promise<void> {
    const exist = await this.connectionsDB(conn.payload.name)
      .get(conn.creator ? conn.subtype + '_' + conn.creator : conn.hash())
      .catch(() => null);

    if (!exist) {
      const meta = await this.getUserMeta(conn.payload.name);
      const creatorMeta = await this.getUserMeta(conn.creator);

      meta.blockers = meta.blockers + 1;
      creatorMeta.blocking = creatorMeta.blocking + 1;

      await this.userMetaDB.put(conn.payload.name, meta);
      await this.userMetaDB.put(conn.creator, creatorMeta);
    }
  }

  async decrementFollowerCount(conn: Connection): Promise<void> {
    const exist = await this.connectionsDB(conn.payload.name)
      .get(conn.creator ? conn.subtype + '_' + conn.creator : conn.hash())
      .catch(() => null);

    if (exist) {
      const meta = await this.getUserMeta(conn.payload.name);
      meta.followers = Math.max(meta.followers - 1, 0);
      await this.userMetaDB.put(conn.payload.name, meta);

      const creatorMeta = await this.getUserMeta(conn.creator);
      creatorMeta.following = Math.max(creatorMeta.following - 1, 0);
      await this.userMetaDB.put(conn.creator, creatorMeta);
    }
  }

  async decrementBlockerCount(conn: Connection): Promise<void> {
    const exist = await this.connectionsDB(conn.payload.name)
      .get(conn.creator ? conn.subtype + '_' + conn.creator : conn.hash())
      .catch(() => null);

    if (exist) {
      const meta = await this.getUserMeta(conn.payload.name);
      const creatorMeta = await this.getUserMeta(conn.creator);

      meta.blockers = Math.max(meta.blockers - 1, 0);
      creatorMeta.blocking = Math.max(creatorMeta.blocking - 1, 0);

      await this.userMetaDB.put(conn.payload.name, meta);
      await this.userMetaDB.put(conn.creator, creatorMeta);
    }
  }

  async decrementCreatorPostCount(post: Post): Promise<void> {
    if (!post.creator) throw new Error('post has no creator');
    const creatorMeta = await this.userMetaDB.get(post.creator).catch(() => EmptyUserMeta());
    creatorMeta.posts = Math.max(creatorMeta.posts - 1, 0);
    return this.userMetaDB.put(post.creator, creatorMeta);
  }

  async decrementReplyCount(post: Post): Promise<void> {
    const { hash } = parseMessageId(post.payload.reference);
    const postMeta = await this.getPostMeta(hash);
    postMeta.reply = Math.max(postMeta.reply - 1, 0);
    return this.postMetaDB.put(hash, postMeta);
  }

  async decrementRepostCount(post: Post): Promise<void> {
    const { hash } = parseMessageId(post.payload.reference);
    const postMeta = await this.getPostMeta(hash);
    postMeta.repost = Math.max(postMeta.repost - 1, 0);
    return this.postMetaDB.put(hash, postMeta);
  }

  async decrementLikeCount(mod: Moderation): Promise<void> {
    const { hash } = parseMessageId(mod.payload.reference);
    const postMeta = await this.getPostMeta(hash);
    postMeta.like = Math.max(postMeta.like - 1, 0);
    return this.postMetaDB.put(hash, postMeta);
  }

  async decrementBlockCount(mod: Moderation): Promise<void> {
    const { hash } = parseMessageId(mod.payload.reference);
    const postMeta = await this.getPostMeta(hash);
    postMeta.block = Math.max(postMeta.block - 1, 0);
    return this.postMetaDB.put(hash, postMeta);
  }

  async removeFromPostlist(post: Post): Promise<void> {
    const encodedKey = this.encodeMessageSortKey(post);
    return this.postlistDB.del(encodedKey);
  }

  async removeFromUserPosts(post: Post): Promise<void> {
    const encodedKey = charwise.encode(post.createdAt.getTime());
    return this.userPostsDB(post.creator).del(encodedKey);
  }

  async removeFromGroupPosts(post: Post, proof: Proof): Promise<void> {
    if (proof.type !== 'rln') throw new Error('post is not from a group');

    const groupId = await this.findGroupHash(
      proof.proof.publicSignals.merkleRoot as string,
      proof.groupId
    );

    return this.groupPostsDB(groupId || '').del(charwise.encode(post.createdAt.getTime()));
  }

  async removeFromThread(post: Post): Promise<void> {
    const encodedKey = this.encodeMessageSortKey(post);
    const { hash } = parseMessageId(post.payload.reference);
    return this.threadDB(hash).del(encodedKey);
  }

  async saveChatECDH(addressOrIdCommitment: string, ecdh: string) {
    const db = this.savedChatECDHDB(addressOrIdCommitment);
    const existing = await db.get(ecdh).catch(() => null);

    if (!existing) {
      await db.put(ecdh, ecdh);
    }

    return ecdh;
  }

  async getPosts(limit?: number, offset?: number | string): Promise<Post[]> {
    const options: any = { reverse: true, valueEncoding: 'json' };

    if (typeof limit === 'number') options.limit = limit;

    if (typeof offset === 'string') {
      const offsetPost = await this.messageDB<PostJSON>()
        .get(offset)
        .catch(() => null);
      if (offsetPost) {
        const { messageId, ...json } = offsetPost;
        const { creator } = parseMessageId(messageId);
        const encodedKey = this.encodeMessageSortKey(
          new Post({
            ...json,
            createdAt: new Date(json.createdAt),
            creator,
          })
        );
        options.lt = encodedKey;
      }
    }

    const posts: Post[] = [];

    for await (const value of this.postlistDB.values(options)) {
      const post = await this.messageDB<PostJSON>().get(value);
      const { messageId, ...json } = post;
      const { creator } = parseMessageId(messageId);

      posts.push(
        new Post({
          ...json,
          createdAt: new Date(json.createdAt),
          creator,
        })
      );
    }

    return posts;
  }

  async getHomefeed(filter: Filter, limit = -1, offset?: number | string): Promise<Post[]> {
    const options: any = { reverse: true, valueEncoding: 'json' };

    if (typeof offset === 'string') {
      const offsetPost = await this.messageDB<PostJSON>()
        .get(offset)
        .catch(() => null);
      if (offsetPost) {
        const { messageId, ...json } = offsetPost;
        const { creator } = parseMessageId(messageId);
        const encodedKey = this.encodeMessageSortKey(
          new Post({
            ...json,
            createdAt: new Date(json.createdAt),
            creator,
          })
        );
        options.lt = encodedKey;
      }
    }

    const posts: Post[] = [];

    for await (const value of this.postlistDB.values(options)) {
      const post = await this.messageDB<PostJSON>().get(value);
      const { hash, messageId, ...json } = post;
      const { creator } = parseMessageId(messageId);

      if (creator && !filter.has(creator)) {
        continue;
      }

      const meta = await this.getPostMeta(hash);
      const groupId = meta?.groupId;

      if (!creator && !filter.has(groupId)) {
        continue;
      }

      posts.push(
        new Post({
          ...json,
          createdAt: new Date(json.createdAt),
          creator,
        })
      );

      if (limit > -1) {
        if (posts.length >= limit) {
          return posts;
        }
      }
    }

    return posts;
  }

  async getUserPosts(address: string, limit?: number, offset?: number | string): Promise<Post[]> {
    const options: any = { reverse: true, valueEncoding: 'json' };

    if (typeof limit === 'number') options.limit = limit;

    if (typeof offset === 'string') {
      const offsetPost = await this.messageDB<PostJSON>()
        .get(offset)
        .catch(() => null);
      if (offsetPost) {
        options.lt = charwise.encode(offsetPost.createdAt);
      }
    }

    const posts: Post[] = [];

    for await (const value of this.userPostsDB(address).values(options)) {
      const post = await this.messageDB<PostJSON>().get(value);
      const { messageId, ...json } = post;
      const { creator } = parseMessageId(messageId);

      posts.push(
        new Post({
          ...json,
          createdAt: new Date(json.createdAt),
          creator,
        })
      );
    }

    return posts;
  }

  async getGroupPosts(groupId: string, limit?: number, offset?: number | string): Promise<Post[]> {
    const options: any = { reverse: true, valueEncoding: 'json' };

    if (typeof limit === 'number') options.limit = limit;

    if (typeof offset === 'string') {
      const offsetPost = await this.messageDB<PostJSON>()
        .get(offset)
        .catch(() => null);
      if (offsetPost) {
        options.lt = charwise.encode(offsetPost.createdAt);
      }
    }

    const posts: Post[] = [];

    for await (const value of this.groupPostsDB(groupId).values(options)) {
      const post = await this.messageDB<PostJSON>().get(value);
      const { messageId, ...json } = post;
      const { creator } = parseMessageId(messageId);

      posts.push(
        new Post({
          ...json,
          createdAt: new Date(json.createdAt),
          creator,
        })
      );
    }

    return posts;
  }

  async getReplies(hash: string, limit?: number, offset?: number | string): Promise<Post[]> {
    const options: any = { valueEncoding: 'json', reverse: true };

    if (typeof limit === 'number') options.limit = limit;

    if (typeof offset === 'string') {
      const offsetPostHash = await this.threadDB(hash)
        .get(offset)
        .catch(() => null);
      if (offsetPostHash) {
        const offsetPost = await this.messageDB<PostJSON>().get(offsetPostHash);
        const { messageId, ...json } = offsetPost;
        const { creator } = parseMessageId(messageId);
        const encodedKey = this.encodeMessageSortKey(
          new Post({
            ...json,
            createdAt: new Date(json.createdAt),
            creator,
          })
        );
        options.gt = encodedKey;
      }
    }

    const posts: Post[] = [];

    for await (const value of this.threadDB(hash).values(options)) {
      const post = await this.messageDB<PostJSON>().get(value);
      const { messageId, ...json } = post;
      const { creator } = parseMessageId(messageId);

      posts.push(
        new Post({
          ...json,
          createdAt: new Date(json.createdAt),
          creator,
        })
      );
    }

    return posts;
  }

  async getReposts(hash: string, limit?: number, offset?: number | string): Promise<string[]> {
    const options: any = { valueEncoding: 'json' };

    if (typeof limit === 'number') options.limit = limit;

    if (typeof offset === 'string') {
      const offsetPostHash = await this.threadDB(hash)
        .get(offset)
        .catch(() => null);
      if (offsetPostHash) {
        const offsetPost = await this.messageDB<PostJSON>().get(offsetPostHash);
        const { messageId, ...json } = offsetPost;
        const { creator } = parseMessageId(messageId);
        const encodedKey = this.encodeMessageSortKey(
          new Post({
            ...json,
            createdAt: new Date(json.createdAt),
            creator,
          })
        );
        options.gt = encodedKey;
      }
    }

    const ids: string[] = [];

    for await (const value of this.threadDB(hash).values(options)) {
      const post = await this.messageDB<PostJSON>().get(value);
      const { messageId } = post;
      ids.push(messageId);
    }

    return ids;
  }

  async getModerations(
    hash: string,
    limit?: number,
    offset?: number | string
  ): Promise<Moderation[]> {
    const options: any = { valueEncoding: 'json' };

    if (typeof limit === 'number') options.limit = limit;

    if (typeof offset === 'string') {
      const offsetModHash = await this.moderationsDB(hash)
        .get(offset)
        .catch(() => null);
      if (offsetModHash) {
        const offsetMod = await this.messageDB<ModerationJSON>().get(offsetModHash);
        const { messageId, ...json } = offsetMod;
        const { creator } = parseMessageId(messageId);
        const encodedKey = this.encodeMessageSortKey(
          new Moderation({
            ...json,
            createdAt: new Date(json.createdAt),
            creator,
          })
        );
        options.gt = encodedKey;
      }
    }

    const ids: Moderation[] = [];

    for await (const value of this.moderationsDB(hash).values(options)) {
      const json = await this.messageDB<ModerationJSON>().get(value);
      const { creator } = parseMessageId(json.messageId);
      ids.push(
        new Moderation({
          ...json,
          createdAt: new Date(json.createdAt),
          creator,
        })
      );
    }

    return ids;
  }

  async getConnections(
    address: string,
    limit?: number,
    offset?: number | string
  ): Promise<Connection[]> {
    const options: any = { valueEncoding: 'json' };

    if (typeof limit === 'number') options.limit = limit;

    if (typeof offset === 'string') {
      const offsetConnHash = await this.connectionsDB(address)
        .get(offset)
        .catch(() => null);
      if (offsetConnHash) {
        const offsetConn = await this.messageDB<ConnectionJSON>().get(offsetConnHash);
        const { messageId, ...json } = offsetConn;
        const { creator } = parseMessageId(messageId);
        const encodedKey = this.encodeMessageSortKey(
          new Connection({
            ...json,
            createdAt: new Date(json.createdAt),
            creator,
          })
        );
        options.gt = encodedKey;
      }
    }

    const ids: Connection[] = [];

    for await (const value of this.connectionsDB(address).values(options)) {
      const json = await this.messageDB<ConnectionJSON>().get(value);
      const { creator } = parseMessageId(json.messageId);
      ids.push(
        new Connection({
          ...json,
          createdAt: new Date(json.createdAt),
          creator,
        })
      );
    }

    return ids;
  }

  async getMessagesByUser(
    address: string,
    limit?: number,
    offset?: number | string
  ): Promise<AnyMessage[]> {
    const options: any = { valueEncoding: 'json' };

    if (typeof limit === 'number') options.limit = limit;

    if (typeof offset === 'string') {
      const offsetMsg = await this.messageDB<PostJSON>()
        .get(offset)
        .catch(() => null);
      if (offsetMsg) {
        options.gt = charwise.encode(offsetMsg.createdAt);
      }
    }

    const ids: AnyMessage[] = [];

    for await (const value of this.userMessageDB(address).values(options)) {
      const json = await this.messageDB<
        PostJSON | ModerationJSON | ProfileJSON | ConnectionJSON
      >().get(value);
      const { creator } = parseMessageId(json.messageId);
      switch (json.type) {
        case MessageType.Post:
          ids.push(
            new Post({
              ...(json as PostJSON),
              createdAt: new Date(json.createdAt),
              creator,
            })
          );
          break;
        case MessageType.Moderation:
          ids.push(
            new Moderation({
              ...(json as ModerationJSON),
              createdAt: new Date(json.createdAt),
              creator,
            })
          );
          break;
        case MessageType.Connection:
          ids.push(
            new Connection({
              ...(json as ConnectionJSON),
              createdAt: new Date(json.createdAt),
              creator,
            })
          );
          break;
        case MessageType.Profile:
          ids.push(
            new Profile({
              ...(json as ProfileJSON),
              createdAt: new Date(json.createdAt),
              creator,
            })
          );
          break;
      }
    }

    return ids;
  }

  async getGroupMembers(
    groupId: string,
    limit?: number,
    offset?: number | string
  ): Promise<string[]> {
    const options: any = { valueEncoding: 'json' };

    if (typeof limit === 'number') options.limit = limit;

    if (typeof offset === 'string') {
      const offsetMember = await this.groupMembersDB(groupId)
        .get(offset)
        .catch(() => null);
      if (offsetMember) {
        const sortKey = charwise.encode(offsetMember.index).toString('hex');
        options.gt = sortKey;
      }
    }

    const members: string[] = [];

    for await (const value of this.groupMemberlistDB(groupId).values(options)) {
      const json = await this.groupMembersDB(groupId).get(value);
      members.push(json.idCommitment);
    }

    return members;
  }

  async getChatByECDH(ecdh: string): Promise<ChatMeta[]> {
    const options: any = { valueEncoding: 'json' };
    const chatMetas: ChatMeta[] = [];

    for await (const value of this.chatMetaDB(ecdh).values(options)) {
      chatMetas.push(value);
    }

    return chatMetas;
  }

  async getChatECDHByUser(addressOrIdCommitment: string): Promise<string[]> {
    const options: any = { valueEncoding: 'json' };
    const ecdhs: string[] = [];

    for await (const value of this.savedChatECDHDB(addressOrIdCommitment).values(options)) {
      ecdhs.push(value);
    }

    return ecdhs;
  }

  async getChatMeta(ecdh: string, chatId: string): Promise<ChatMeta | null> {
    return this.chatMetaDB(ecdh)
      .get(chatId)
      .catch(() => null);
  }

  async getChatMessages(chatId: string, limit?: number, offset?: number | string): Promise<Chat[]> {
    const options: any = { reverse: true, valueEncoding: 'json' };

    if (typeof limit === 'number') options.limit = limit;

    if (typeof offset === 'string') {
      const offsetPost = await this.messageDB<ChatJSON>()
        .get(offset)
        .catch(() => null);
      if (offsetPost) {
        const { createdAt, messageId, ...json } = offsetPost;
        const encodedKey = charwise.encode(createdAt);
        options.lt = encodedKey;
      }
    }

    const chats: Chat[] = [];

    for await (const value of this.chatDB(chatId).values(options)) {
      const chatJSON = await this.messageDB<ChatJSON>().get(value);
      const { messageId, ...json } = chatJSON;
      const { creator } = parseMessageId(messageId);

      chats.push(
        new Chat({
          ...json,
          createdAt: new Date(json.createdAt),
          creator,
        })
      );
    }

    return chats;
  }

  async findGroupHash(hash: string, groupId?: string): Promise<string | null> {
    let retValue;

    if (groupId) {
      retValue = await this.groupRootsDB(hash)
        .get(groupId)
        .catch(() => null);
    }

    if (retValue) return retValue;

    for await (const value of this.groupRootsDB(hash).values({ valueEncoding: 'json' })) {
      return value;
    }

    return null;
  }
}
