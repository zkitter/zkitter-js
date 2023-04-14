import {ZkIdentity} from '@zk-kit/identity';
import {ConstructorOptions} from 'eventemitter2';
import Web3 from 'web3';
import {Contract} from 'web3-eth-contract';
import {GenericDBAdapterInterface} from '../adapters/db';
import {GenericGroupAdapter} from '../adapters/group';
import {InterepGroup} from '../adapters/groups/interep';
import {TazGroup} from '../adapters/groups/taz';
import {AlreadyExistError, LevelDBAdapter} from '../adapters/leveldb';
import {ChatMeta} from '../models/chats';
import {PostMeta} from '../models/postmeta';
import {Proof} from '../models/proof';
import {User} from '../models/user';
import {UserMeta} from '../models/usermeta';
import {decrypt, deriveSharedSecret, encrypt, randomBytes} from '../utils/crypto';
import {Filter, FilterOptions} from '../utils/filters';
import {generateECDHKeyPairFromZKIdentity, generateECDHWithP256, Identity,} from '../utils/identity';
import {
  Chat,
  ChatMessageSubType,
  Connection,
  Message as ZkitterMessage,
  Message,
  MessageType,
  Moderation,
  parseMessageId,
  Post,
  PostMessageSubType,
  Profile,
} from '../utils/message';
import {GenericService} from '../utils/svc';
import {ChatService} from './chats';
import {ConnectionService} from './connections';
import {GroupService} from './groups';
import {ModerationService} from './moderations';
import {PostService} from './posts';
import {ProfileService} from './profile';
import {PubsubService} from './pubsub';
import {UserService} from './users';
import {DataService} from "./db";
import {ZkitterEvents} from "../utils/events";

export class Zkitter extends GenericService {
  web3: Web3;

  registrar: Contract;

  db: GenericDBAdapterInterface;

  historyAPI: string;

  services: {
    users: UserService;
    pubsub: PubsubService;
    posts: PostService;
    chats: ChatService;
    moderations: ModerationService;
    connections: ConnectionService;
    profile: ProfileService;
    groups: GroupService;
    data: DataService;
  };

  private filter: Filter;

  private unsubscribe: (() => Promise<void>) | null;

  static async initialize(options?: {
    arbitrumProvider?: string;
    groups?: GenericGroupAdapter[];
    db?: GenericDBAdapterInterface;
    historyAPI?: string;
    lazy?: boolean;
    topicPrefix?: string;
    filterOptions?: FilterOptions;
  }): Promise<Zkitter> {
    const db = options?.db || (await LevelDBAdapter.initialize());
    const users = new UserService({
      arbitrumProvider: options?.arbitrumProvider || 'https://arb1.arbitrum.io/rpc',
      db,
    });
    const posts = new PostService({ db });
    const moderations = new ModerationService({ db });
    const connections = new ConnectionService({ db });
    const profile = new ProfileService({ db });
    const chats = new ChatService({ db });
    const groups = new GroupService({ db });
    const data = new DataService({ db });

    const pubsub = await PubsubService.initialize(
      users,
      groups,
      db,
      options?.lazy,
      options?.topicPrefix
    );

    const grouplist = options?.groups || [
      new TazGroup({ db }),
      new InterepGroup({ db, groupId: 'interrep_twitter_unrated' }),
      new InterepGroup({ db, groupId: 'interrep_twitter_bronze' }),
      new InterepGroup({ db, groupId: 'interrep_twitter_silver' }),
      new InterepGroup({ db, groupId: 'interrep_twitter_gold' }),
      new InterepGroup({ db, groupId: 'interrep_reddit_unrated' }),
      new InterepGroup({ db, groupId: 'interrep_reddit_bronze' }),
      new InterepGroup({ db, groupId: 'interrep_reddit_silver' }),
      new InterepGroup({ db, groupId: 'interrep_reddit_gold' }),
      new InterepGroup({ db, groupId: 'interrep_github_unrated' }),
      new InterepGroup({ db, groupId: 'interrep_github_bronze' }),
      new InterepGroup({ db, groupId: 'interrep_github_silver' }),
      new InterepGroup({ db, groupId: 'interrep_github_gold' }),
    ];

    for (const group of grouplist) {
      groups.addGroup(group);
    }

    return new Zkitter({
      chats,
      connections,
      db,
      filter: new Filter({
        ...options?.filterOptions,
        prefix: options?.topicPrefix,
      }),
      groups,
      historyAPI: options?.historyAPI,
      moderations,
      posts,
      profile,
      pubsub,
      users,
      data,
    });
  }

  constructor(
    opts: ConstructorOptions & {
      db: GenericDBAdapterInterface;
      users: UserService;
      pubsub: PubsubService;
      posts: PostService;
      moderations: ModerationService;
      connections: ConnectionService;
      profile: ProfileService;
      chats: ChatService;
      groups: GroupService;
      data: DataService;
      historyAPI?: string;
      filter?: Filter;
    }
  ) {
    super(opts);
    this.db = opts.db;
    this.unsubscribe = null;
    this.filter = opts.filter || new Filter({});
    this.historyAPI = opts.historyAPI || 'https://api.zkitter.com/v1/history';

    this.services = {
      chats: opts.chats,
      connections: opts.connections,
      groups: opts.groups,
      data: opts.data,
      moderations: opts.moderations,
      posts: opts.posts,
      profile: opts.profile,
      pubsub: opts.pubsub,
      users: opts.users,
    };

    for (const service of Object.values(this.services)) {
      service.onAny((event, ...values) => {
        this.emit(event, ...values);
      });
    }
  }

  async status() {
    return {
      users: await this.services.users.status(),
      filter: this.filter.json,
    };
  }

  /**
   * start zkitter node
   * use zkitter.subscribe to subcribe to new messages
   */
  async start() {
    await this.services.users.watchArbitrum();
    await this.services.groups.watch();
    if (!this.filter.isEmpty) {
      await this.query();
      await this.subscribe();
    }
  }

  async subscribe() {
    if (this.unsubscribe) {
      await this.unsubscribe();
    }

    this.unsubscribe = await this.services.pubsub.subscribe(this.filter, async (msg, proof) => {
      if (msg) {
        await this.insert(msg, proof);
      }
    });

    return this.unsubscribe;
  }

  async updateFilter(options: Exclude<FilterOptions, { prefix?: string }>) {
    this.filter.update(options);
    await this.query();
    return this.subscribe();
  }

  async query() {
    const { all, address, group } = this.filter.json;

    if (all) {
      await this.downloadHistoryFromAPI().catch(() => null);
    } else {
      if (address.length) {
        for (const user of address) {
          await this.downloadHistoryFromAPI(user).catch(() => null);
        }
      }

      if (group) {
        await this.downloadHistoryFromAPI(undefined, true).catch(() => null);
      }
    }

    return this.services.pubsub.query(this.filter, async (msg, proof) => {
      if (msg) {
        await this.insert(msg, proof);
      }
    });
  }

  async syncUsers() {
    await this.services.users.syncUsers();
  }

  async syncGroup(groupId?: string) {
    await this.services.groups.sync(groupId);
  }

  async getGroupByRoot(rootHash: string, groupId?: string) {
    return this.services.groups.getGroupByRoot(rootHash, groupId);
  }

  async getGroupMembers(groupId: string) {
    return this.services.groups.members(groupId);
  }

  async getMerklePath(idCommitment: string, groupId: string) {
    return this.services.groups.getMerklePath(idCommitment, groupId);
  }

  async getUsers(limit?: number, offset?: string | number): Promise<User[]> {
    return this.services.users.getUsers(limit, offset);
  }

  async getUser(address: string): Promise<User | null> {
    return this.services.users.getUser(address);
  }

  async getUserMeta(address: string): Promise<UserMeta> {
    return this.services.users.getUserMeta(address);
  }

  async getUserByECDH(ecdh: string): Promise<string | null> {
    return this.db.getUserByECDH(ecdh);
  }

  async getPosts(limit?: number, offset?: string | number): Promise<Post[]> {
    return this.db.getPosts(limit, offset);
  }

  async getFollowings(address: string): Promise<string[]> {
    return this.services.users.getFollowings(address);
  }

  async getHomefeed(filter: Filter, limit = -1, offset?: number | string): Promise<Post[]> {
    return this.db.getHomefeed(filter, limit, offset);
  }

  async getUserPosts(address: string, limit?: number, offset?: string | number): Promise<Post[]> {
    return this.db.getUserPosts(address, limit, offset);
  }

  async getGroupPosts(groupId: string, limit?: number, offset?: string | number): Promise<Post[]> {
    return this.db.getGroupPosts(groupId, limit, offset);
  }

  async getThread(hash: string, limit?: number, offset?: string | number): Promise<Post[]> {
    return this.db.getReplies(hash, limit, offset);
  }

  async getPostMeta(hash: string): Promise<PostMeta> {
    return this.db.getPostMeta(hash);
  }

  async getMessagesByUser(address: string, limit?: number, offset?: number | string) {
    return this.services.users.getMessagesByUser(address, limit, offset);
  }

  async getChatByECDH(ecdh: string): Promise<ChatMeta[]> {
    return this.db.getChatByECDH(ecdh);
  }

  async getChatByUser(addressOrIdCommitment: string): Promise<ChatMeta[]> {
    const ecdhs = await this.db.getChatECDHByUser(addressOrIdCommitment);
    let chatMetas: ChatMeta[] = [];

    for (let i = 0; i < ecdhs.length; i++) {
      const metas = await this.db.getChatByECDH(ecdhs[i]);
      chatMetas = chatMetas.concat(metas);
    }

    return chatMetas;
  }

  async getChatMessages(
    chatId: string,
    limit?: number,
    offset?: number | string,
    identity?: Identity
  ): Promise<Chat[]> {
    const chats = await this.db.getChatMessages(chatId, limit, offset);
    let sharedSecret = '';

    if (chats.length) {
      if (identity?.type === 'zk') {
        const chatMetas = await this.getChatByUser(
          '0x' + identity.zkIdentity.genIdentityCommitment().toString(16)
        );
        const [chatMeta] = chatMetas.filter(meta => meta.chatId === chatId);
        const ecdhSeed = chatMeta?.senderSeed;
        const ecdh = await generateECDHKeyPairFromZKIdentity(identity.zkIdentity, ecdhSeed);
        const receiverECDH =
          chatMeta?.receiverECDH !== ecdh.pub ? chatMeta?.receiverECDH : chatMeta?.senderECDH;
        sharedSecret = receiverECDH ? await deriveSharedSecret(receiverECDH, ecdh.priv) : '';
      } else if (identity?.type === 'ecdsa') {
        const ecdh = await generateECDHWithP256(identity.privateKey, 0);
        const chatMeta = await this.db.getChatMeta(ecdh.pub, chatId);
        const receiverECDH =
          chatMeta?.receiverECDH !== ecdh.pub ? chatMeta?.receiverECDH : chatMeta?.senderECDH;
        sharedSecret = receiverECDH ? await deriveSharedSecret(receiverECDH, ecdh.priv) : '';
      }

      if (sharedSecret) {
        return chats.map(chat => {
          try {
            chat.payload.content = decrypt(chat.payload.encryptedContent, sharedSecret);
          } catch (e) {}
          return chat;
        });
      }
    }

    return chats;
  }

  private async insert(msg: ZkitterMessage, proof: Proof) {
    try {
      await this.services.data.insertMessage(msg, proof);
    } catch (e) {
      console.error(e);
    }
  }

  async revert(msg: Message, proof: Proof) {
  }

  async queryThread(address: string) {
    return this.services.pubsub.queryThread(address, async (msg, proof) => {
      if (msg) {
        await this.insert(msg, proof);
      }
    });
  }

  async queryUser(address: string) {
    this.downloadHistoryFromAPI(address);
    return this.services.pubsub.queryUser(address, async (msg, proof) => {
      if (msg) {
        await this.insert(msg, proof);
      }
    });
  }

  async queryGroup(groupId: string) {
    this.downloadHistoryFromAPI(undefined, true);
    return this.services.pubsub.queryGroup(groupId, async (msg, proof) => {
      if (msg) {
        await this.insert(msg, proof);
      }
    });
  }

  async queryAll() {
    this.downloadHistoryFromAPI();
    return this.services.pubsub.queryAll(async (msg, proof) => {
      if (msg) {
        await this.insert(msg, proof);
      }
    });
  }

  async downloadHistoryFromAPI(user?: string, group = false): Promise<void> {
    if (user && group) {
      throw new Error('must specify either user or group');
    }

    const downloaded = await this.db.getHistoryDownloaded(user, group);

    if (downloaded) return;

    const api = user
      ? this.historyAPI + '?user=' + user
      : group
      ? this.historyAPI + '?global=true'
      : this.historyAPI;
    const resp = await fetch(api);
    const json = await resp.json();

    return new Promise(async (resolve, reject) => {
      if (json.error) return reject(json.payload);

      try {
        const total = json.payload.length;
        let i = 0;

        for (const msg of json.payload) {
          if (!msg) continue;
          const { creator } = parseMessageId(msg.messageId);
          let message: Message | null = null;

          switch (msg.type) {
            case MessageType.Post:
              message = new Post({
                createdAt: new Date(msg.createdAt),
                creator,
                payload: msg.payload,
                subtype: msg.subtype,
                type: msg.type,
              });
              break;
            case MessageType.Moderation:
              message = new Moderation({
                createdAt: new Date(msg.createdAt),
                creator,
                payload: msg.payload,
                subtype: msg.subtype,
                type: msg.type,
              });
              break;
            case MessageType.Connection:
              message = new Connection({
                createdAt: new Date(msg.createdAt),
                creator,
                payload: msg.payload,
                subtype: msg.subtype,
                type: msg.type,
              });
              break;
            case MessageType.Profile:
              message = new Profile({
                createdAt: new Date(msg.createdAt),
                creator,
                payload: msg.payload,
                subtype: msg.subtype,
                type: msg.type,
              });
              break;
          }

          if (message) {
            await this.insert(message, {
              group: msg.group,
              proof: null,
              type: '',
            });
          }

          this.emit(ZkitterEvents.HistoryDowload, {
            total: total,
            currentIndex: ++i,
            user,
            group,
            all: !user && !group,
          });
        }

        await this.db.setHistoryDownloaded(true, user, group);
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  }

  async getProof(hash: string): Promise<Proof | null> {
    return this.db.getProof(hash);
  }

  async watchArbitrum(interval?: number) {
    return this.services.users.watchArbitrum(interval);
  }

  async write(options: {
    creator: string;
    content: string;
    reference?: string;
    privateKey?: string;
    zkIdentity?: ZkIdentity;
    global?: boolean;
    groupId?: string;
  }) {
    return this.services.pubsub.write(options);
  }

  async createProof(opts: {
    hash: string;
    address?: string;
    privateKey?: string;
    zkIdentity?: ZkIdentity;
    groupId?: string;
  }): Promise<Proof> {
    return this.services.pubsub.createProof(opts);
  }

  async publish(message: ZkitterMessage, proof: Proof, force = false) {
    await this.services.pubsub.publish(message, proof, force);
    await this.insert(message, proof);
    return [message, proof];
  }

  authorize = async (identity: Identity) => {
    const creator = identity.type === 'ecdsa' ? identity.address : '';

    const createProof = (hash: string) => {
      return this.createProof({
        address: identity.type === 'ecdsa' ? identity.address : undefined,
        groupId: identity.type === 'zk' ? identity.groupId : undefined,
        hash,
        privateKey: identity.type === 'ecdsa' ? identity.privateKey : undefined,
        zkIdentity: identity.type === 'zk' ? identity.zkIdentity : undefined,
      });
    };

    return {
      comment: async ({
        attachment,
        content,
        reference,
        seedOverride,
      }: {
        content: string;
        reference: string;
        attachment?: string;
        seedOverride?: string;
      }) => {
        const ecdhSeed = identity.type === 'zk' ? seedOverride || (await randomBytes()) : undefined;
        const senderECDH =
          identity.type === 'ecdsa'
            ? await generateECDHWithP256(identity.privateKey, 0)
            : await generateECDHKeyPairFromZKIdentity(identity.zkIdentity, ecdhSeed);

        const post = new Post({
          creator,
          payload: {
            attachment,
            content: content,
            // ecdh: senderECDH.pub,
            // ecdhSeed,
            reference,
          },
          subtype: PostMessageSubType.Default,
          type: MessageType.Post,
        });

        const proof = await createProof(post.hash());

        await this.publish(post, proof);

        if (identity.type === 'zk') {
          await this.db.saveChatECDH(
            '0x' + identity.zkIdentity.genIdentityCommitment().toString(16),
            senderECDH.pub
          );
        } else if (identity.type === 'ecdsa') {
          await this.db.saveChatECDH(identity.address, senderECDH.pub);
        }

        return [post, proof];
      },

      directMessage: async ({
        content,
        ecdh: receiverECDH,
        seedOverride,
      }: {
        content: string;
        ecdh: string;
        seedOverride?: string;
      }) => {
        const ecdhSeed = identity.type === 'zk' ? seedOverride || (await randomBytes()) : undefined;
        const senderECDH =
          identity.type === 'ecdsa'
            ? await generateECDHWithP256(identity.privateKey, 0)
            : await generateECDHKeyPairFromZKIdentity(identity.zkIdentity, ecdhSeed);
        const sharedKey = await deriveSharedSecret(receiverECDH, senderECDH.priv);

        const chat = new Chat({
          creator,
          payload: {
            encryptedContent: await encrypt(content, sharedKey),
            receiverECDH,
            senderECDH: senderECDH.pub,
            senderSeed: ecdhSeed,
          },
          subtype: ChatMessageSubType.Direct,
          type: MessageType.Chat,
        });

        const proof = await createProof(chat.hash());

        await this.publish(chat, proof);

        if (identity.type === 'zk') {
          await this.db.saveChatECDH(
            '0x' + identity.zkIdentity.genIdentityCommitment().toString(16),
            senderECDH.pub
          );
        } else if (identity.type === 'ecdsa') {
          await this.db.saveChatECDH(identity.address, senderECDH.pub);
        }

        return [chat, proof];
      },

      write: async ({
        attachment,
        content,
        seedOverride,
      }: {
        content: string;
        attachment?: string;
        seedOverride?: string;
      }) => {
        const ecdhSeed = identity.type === 'zk' ? seedOverride || (await randomBytes()) : undefined;
        const senderECDH =
          identity.type === 'ecdsa'
            ? await generateECDHWithP256(identity.privateKey, 0)
            : await generateECDHKeyPairFromZKIdentity(identity.zkIdentity, ecdhSeed);

        const post = new Post({
          creator,
          payload: {
            attachment: attachment,
            content: content,
            // ecdh: identity.type === 'zk' ? senderECDH.pub : '',
            // ecdhSeed: identity.type === 'zk' ? ecdhSeed : '',
          },
          subtype: PostMessageSubType.Default,
          type: MessageType.Post,
        });

        const proof = await createProof(post.hash());

        await this.publish(post, proof);

        if (identity.type === 'zk') {
          await this.db.saveChatECDH(
            '0x' + identity.zkIdentity.genIdentityCommitment().toString(16),
            senderECDH.pub
          );
        } else if (identity.type === 'ecdsa') {
          await this.db.saveChatECDH(identity.address, senderECDH.pub);
        }

        return [post, proof];
      },
    };
  };
}
