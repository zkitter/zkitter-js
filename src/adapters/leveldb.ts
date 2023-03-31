import { BatchOperation, Level } from 'level';
import { ChatMeta } from '../models/chats';
import { GroupMember } from '../models/group';
import { EmptyPostMeta, PostMeta } from '../models/postmeta';

const charwise = require('charwise');

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
} from '../utils/message';
import { GenericDBAdapterInterface } from './db';

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

  static async initialize(path?: string) {
    const db = new Level(path || './zkitterdb', { valueEncoding: 'json' });
    await db.open();
    return new LevelDBAdapter(db);
  }

  constructor(db: Level) {
    this.db = db;
  }

  get appDB() {
    return this.db.sublevel<string, number | string | boolean>('app', {
      valueEncoding: 'json',
    });
  }

  get metaDB() {
    return this.db.sublevel<string, number>('meta', { valueEncoding: 'json' });
  }

  get userDB() {
    return this.db.sublevel<string, User>('users', { valueEncoding: 'json' });
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
    return this.metaDB.get(keys.META.userCount).catch(() => 0);
  }

  async getArbitrumProvider(): Promise<string> {
    const arbitrumProvider = await this.appDB.get(keys.APP.arbitrumProvider).catch(() => '');
    return String(arbitrumProvider) || 'https://arb1.arbitrum.io/rpc';
  }

  async setHistoryDownloaded(downloaded: boolean, user?: string): Promise<void> {
    const mod = typeof user === 'string' ? '/' + user : '';
    return this.appDB.put(keys.APP.historyDownloaded + mod, downloaded);
  }

  async getHistoryDownloaded(user?: string): Promise<boolean> {
    const mod = typeof user === 'string' ? '/' + user : '';
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
      const block = await this.appDB.get(keys.APP.lastArbitrumBlockScanned);
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

  async getProof(hash: string): Promise<Proof | null> {
    return this.proofDB<Proof>()
      .get(hash)
      .catch(() => null);
  }

  async updateLastArbitrumBlockScanned(block: number): Promise<any> {
    return this.appDB.put(keys.APP.lastArbitrumBlockScanned, block);
  }

  async updateUser(user: User): Promise<User> {
    const existing = await this.getUser(user.address);

    if (!existing) {
      const count = await this.metaDB.get(keys.META.userCount).catch(() => 0);
      await this.db.batch([
        {
          key: user.address,
          sublevel: this.userDB,
          type: 'put',
          // @ts-ignore
          value: user,
        },
        {
          key: keys.META.userCount,
          sublevel: this.metaDB,
          type: 'put',
          // @ts-ignore
          value: count + 1,
        },
      ]);
    } else if (existing.joinedAt < user.joinedAt) {
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

    const { creator } = parseMessageId(json.messageId);

    if (json.type === MessageType.Post) {
      return new Post({
        ...(json as PostJSON),
        createdAt: new Date(json.createdAt),
        creator,
      });
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

  async insertProfile(profile: Profile, proof: Proof): Promise<Profile | null> {
    const json = profile.toJSON();
    const existing = await this.messageDB()
      .get(json.hash)
      .catch(() => null);

    if (existing) {
      throw AlreadyExistError;
    }

    const creatorMeta = await this.userMetaDB.get(profile.creator).catch(() => EmptyUserMeta());
    const operations: BatchOperation<any, any, any>[] = [
      {
        key: json.hash,
        sublevel: this.messageDB(),
        type: 'put',
        // @ts-ignore
        value: json,
      },
      {
        key: json.hash,
        sublevel: this.proofDB(),
        type: 'put',
        // @ts-ignore
        value: proof,
      },
      {
        key: charwise.encode(profile.createdAt.getTime()),
        sublevel: this.userMessageDB(profile.creator),
        type: 'put',
        // @ts-ignore
        value: json.hash,
      },
    ];

    const checkAndReplace = async (key: UserMetaKey) => {
      const hash = creatorMeta[key];
      const msg = await this.messageDB<ProfileJSON>()
        .get(hash)
        .catch(() => null);
      if (!msg || msg.createdAt < profile.createdAt.getTime()) {
        creatorMeta[key] = profile.hash();
      }
    };

    switch (profile.subtype) {
      case ProfileMessageSubType.Bio:
        await checkAndReplace('bio');
        break;
      case ProfileMessageSubType.CoverImage:
        await checkAndReplace('coverImage');
        break;
      case ProfileMessageSubType.ProfileImage:
        await checkAndReplace('profileImage');
        break;
      case ProfileMessageSubType.Group:
        creatorMeta.group = true;
        break;
      case ProfileMessageSubType.Name:
        await checkAndReplace('nickname');
        break;
      case ProfileMessageSubType.TwitterVerification:
        await checkAndReplace('twitterVerification');
        break;
      case ProfileMessageSubType.Website:
        await checkAndReplace('website');
        break;
      case ProfileMessageSubType.Custom:
        if (profile.payload.key === 'id_commitment') {
          await checkAndReplace('idCommitment');
        } else if (profile.payload.key === 'ecdh_pubkey') {
          await checkAndReplace('ecdh');
          operations.push({
            key: profile.payload.value,
            sublevel: this.userECDHDB,
            type: 'put',
            value: profile.creator,
          });
        }
        break;
    }

    operations.push({
      key: profile.creator,
      sublevel: this.userMetaDB,
      type: 'put',
      // @ts-ignore,
      value: {
        ...creatorMeta,
      },
    });

    await this.db.batch(operations);

    return profile;
  }

  async insertConnection(conn: Connection, proof: Proof): Promise<Connection | null> {
    const json = conn.toJSON();
    const existing = await this.messageDB()
      .get(json.hash)
      .catch(() => null);

    if (!conn.payload.name) return null;

    if (existing) {
      throw AlreadyExistError;
    }

    const userMeta = await this.userMetaDB.get(conn.payload.name).catch(() => EmptyUserMeta());
    const creatorMeta = await this.userMetaDB.get(conn.creator).catch(() => EmptyUserMeta());
    const encodedKey = this.encodeMessageSortKey(conn);

    const operations: BatchOperation<any, any, any>[] = [
      {
        key: json.hash,
        sublevel: this.messageDB(),
        type: 'put',
        // @ts-ignore
        value: json,
      },
      {
        key: json.hash,
        sublevel: this.proofDB(),
        type: 'put',
        // @ts-ignore
        value: proof,
      },
      {
        key: charwise.encode(conn.createdAt.getTime()),
        sublevel: this.userMessageDB(conn.creator),
        type: 'put',
        // @ts-ignore
        value: json.hash,
      },
      {
        key: encodedKey,
        sublevel: this.connectionsDB(conn.payload.name),
        type: 'put',
        // @ts-ignore
        value: json.hash,
      },
    ];

    switch (conn.subtype) {
      case ConnectionMessageSubType.Follow:
        userMeta.followers = userMeta.followers + 1;
        creatorMeta.following = creatorMeta.following + 1;
        break;
      case ConnectionMessageSubType.Block:
        userMeta.blockers = userMeta.blockers + 1;
        creatorMeta.blocking = creatorMeta.blocking + 1;
        break;
    }

    operations.push({
      key: conn.payload.name,
      sublevel: this.userMetaDB,
      type: 'put',
      // @ts-ignore,
      value: {
        ...EmptyUserMeta(),
        ...userMeta,
      },
    });

    operations.push({
      key: conn.creator,
      sublevel: this.userMetaDB,
      type: 'put',
      // @ts-ignore,
      value: {
        ...EmptyUserMeta(),
        ...creatorMeta,
      },
    });

    await this.db.batch(operations);

    return conn;
  }

  async insertModeration(mod: Moderation, proof: Proof): Promise<Moderation | null> {
    const json = mod.toJSON();
    const existing = await this.messageDB()
      .get(json.hash)
      .catch(() => null);

    if (!mod.payload.reference) return null;

    if (existing) {
      throw AlreadyExistError;
    }

    const { creator, hash } = parseMessageId(mod.payload.reference);
    const postMeta = await this.getPostMeta(hash);
    const isOP = mod.creator === creator;

    const encodedKey = this.encodeMessageSortKey(mod);

    const operations: BatchOperation<any, any, any>[] = [
      {
        key: json.hash,
        sublevel: this.messageDB(),
        type: 'put',
        // @ts-ignore
        value: json,
      },
      {
        key: json.hash,
        sublevel: this.proofDB(),
        type: 'put',
        // @ts-ignore
        value: proof,
      },
      {
        key: charwise.encode(mod.createdAt.getTime()),
        sublevel: this.userMessageDB(mod.creator),
        type: 'put',
        // @ts-ignore
        value: json.hash,
      },
      {
        key: encodedKey,
        sublevel: this.moderationsDB(hash),
        type: 'put',
        // @ts-ignore,
        value: json.hash,
      },
    ];

    switch (mod.subtype) {
      case ModerationMessageSubType.Like:
        postMeta.like = postMeta.like + 1;
        break;
      case ModerationMessageSubType.Block:
        postMeta.block = postMeta.block + 1;
        break;
      case ModerationMessageSubType.Global:
        if (isOP) postMeta.global = true;
        break;
      case ModerationMessageSubType.ThreadBlock:
      case ModerationMessageSubType.ThreadFollow:
      case ModerationMessageSubType.ThreadMention:
        if (isOP) postMeta.moderation = mod.subtype;
        break;
    }

    operations.push({
      key: hash,
      sublevel: this.postMetaDB,
      type: 'put',
      // @ts-ignore,
      value: {
        ...EmptyPostMeta(),
        ...postMeta,
      },
    });

    await this.db.batch(operations);

    return mod;
  }

  async insertChat(chat: Chat, proof: Proof): Promise<Chat> {
    const json = chat.toJSON();
    const existing = await this.messageDB()
      .get(json.hash)
      .catch(() => null);

    if (existing) {
      throw AlreadyExistError;
    }

    const { receiverECDH, senderECDH, senderSeed } = chat.payload;

    const chatId = await deriveChatId(chat.payload.receiverECDH, chat.payload.senderECDH);

    const senderMeta = await this.chatMetaDB(chat.payload.senderECDH)
      .get(chatId)
      .catch(() => null);
    const receiverMeta = await this.chatMetaDB(chat.payload.receiverECDH)
      .get(chatId)
      .catch(() => null);

    const operations: BatchOperation<any, any, any>[] = [
      {
        key: json.hash,
        sublevel: this.messageDB(),
        type: 'put',
        value: json,
      },
      {
        key: json.hash,
        sublevel: this.proofDB(),
        type: 'put',
        value: proof,
      },
      {
        key: charwise.encode(chat.createdAt.getTime()),
        sublevel: this.chatDB(chatId),
        type: 'put',
        value: json.hash,
      },
    ];

    if (chat.creator) {
      operations.push({
        key: senderECDH,
        sublevel: this.savedChatECDHDB(chat.creator),
        type: 'put',
        value: senderECDH,
      });
    }

    if (!senderMeta) {
      operations.push({
        key: chatId,
        sublevel: this.chatMetaDB(chat.payload.senderECDH),
        type: 'put',
        value: {
          chatId,
          receiverECDH,
          senderECDH,
          senderSeed,
          type: chat.subtype,
        },
      });
    }

    if (!receiverMeta) {
      operations.push({
        key: chatId,
        sublevel: this.chatMetaDB(chat.payload.receiverECDH),
        type: 'put',
        value: {
          chatId,
          receiverECDH,
          senderECDH,
          senderSeed,
          type: chat.subtype,
        },
      });
    }

    await this.db.batch(operations);

    return chat;
  }

  async insertPost(post: Post, proof: Proof): Promise<Post> {
    const json = post.toJSON();
    const existing = await this.messageDB()
      .get(json.hash)
      .catch(() => null);

    if (existing) {
      throw AlreadyExistError;
    }

    const creatorMeta = await this.userMetaDB.get(post.creator).catch(() => EmptyUserMeta());
    const postMeta = await this.getPostMeta(json.hash);
    let postMetaDirty = false;
    const encodedKey = this.encodeMessageSortKey(post);

    const operations: BatchOperation<any, any, any>[] = [
      {
        key: json.hash,
        sublevel: this.messageDB(),
        type: 'put',
        value: json,
      },
      {
        key: json.hash,
        sublevel: this.proofDB(),
        type: 'put',
        value: proof,
      },
      {
        key: charwise.encode(post.createdAt.getTime()),
        sublevel: this.userMessageDB(post.creator),
        type: 'put',
        value: json.hash,
      },
    ];

    if (proof.type === ProofType.rln) {
      const groupId = await this.findGroupHash(
        proof.proof.publicSignals.merkleRoot as string,
        proof.groupId,
      );
      postMetaDirty = true;
      postMeta.groupId = groupId || '';
      operations.push({
        key: encodedKey,
        sublevel: this.groupPostsDB(groupId || ''),
        type: 'put',
        // @ts-ignore
        value: json.hash,
      });
    } else if (proof.type === '' && proof.group) {
      postMetaDirty = true;
      postMeta.groupId = proof.group;
    }

    if (!post.payload.reference) {
      operations.push({
        key: encodedKey,
        sublevel: this.postlistDB,
        type: 'put',
        value: json.hash,
      });
      operations.push({
        key: charwise.encode(post.createdAt.getTime()),
        sublevel: this.userPostsDB(post.creator),
        type: 'put',
        value: json.hash,
      });
      creatorMeta.posts = creatorMeta.posts + 1;
      operations.push({
        key: post.creator,
        sublevel: this.userMetaDB,
        type: 'put',
        value: {
          ...EmptyUserMeta(),
          ...creatorMeta,
        },
      });
    } else if (
      post.subtype === PostMessageSubType.Reply ||
      post.subtype === PostMessageSubType.MirrorReply
    ) {
      const { hash } = parseMessageId(post.payload.reference);
      postMeta.reply = postMeta.reply + 1;
      postMetaDirty = true;
      operations.push({
        key: encodedKey,
        sublevel: this.threadDB(hash),
        type: 'put',
        value: json.hash,
      });
    } else if (post.subtype === PostMessageSubType.Repost) {
      const { hash } = parseMessageId(post.payload.reference);
      postMetaDirty = true;
      postMeta.repost = postMeta.repost + 1;

      operations.push({
        key: encodedKey,
        sublevel: this.postlistDB,
        type: 'put',
        value: json.hash,
      });
      operations.push({
        key: charwise.encode(post.createdAt.getTime()),
        sublevel: this.userPostsDB(post.creator),
        type: 'put',
        value: json.hash,
      });
      operations.push({
        key: encodedKey,
        sublevel: this.repostDB(hash),
        type: 'put',
        value: json.hash,
      });
    }

    if (postMetaDirty) {
      operations.push({
        key: json.hash,
        sublevel: this.postMetaDB,
        type: 'put',
        value: postMeta,
      });
    }

    await this.db.batch(operations);

    return post;
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
      retValue = await this.groupRootsDB(hash).get(groupId).catch(() => null);
    }

    if (retValue) return retValue;

    for await (const value of this.groupRootsDB(hash).values({ valueEncoding: 'json' })) {
      return value;
    }

    return null;
  }
}
