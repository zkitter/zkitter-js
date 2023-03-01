import { GenericService } from '../utils/svc';
import Web3 from 'web3';
import { Contract } from 'web3-eth-contract';
import { AlreadyExistError, LevelDBAdapter } from '../adapters/leveldb';
import { UserService } from './users';
import { User } from '../models/user';
import { PubsubService } from './pubsub';
import { PostService } from './posts';
import {
  Connection,
  Message,
  MessageType,
  Moderation,
  parseMessageId,
  Post,
  Profile,
} from '../utils/message';
import { ModerationService } from './moderations';
import { ConnectionService } from './connections';
import { UserMeta } from '../models/usermeta';
import { ProfileService } from './profile';
import { GenericDBAdapterInterface } from '../adapters/db';
import { PostMeta } from '../models/postmeta';
import { ConstructorOptions } from 'eventemitter2';
import { Proof } from '../models/proof';
import { GroupService } from './groups';
import { GenericGroupAdapter } from '../adapters/group';
import { TazGroup } from '../adapters/groups/taz';
import { ZkIdentity } from '@zk-kit/identity';
import { InterepGroup } from '../adapters/groups/interep';
import { GlobalGroup } from '../adapters/groups/global';

export enum ZkitterEvents {
  ArbitrumSynced = 'Users.ArbitrumSynced',
  NewUserCreated = 'Users.NewUserCreated',
  GroupSynced = 'Group.GroupSynced',
  NewGroupMemberCreated = 'Group.NewGroupMemberCreated',
  NewMessageCreated = 'Zkitter.NewMessageCreated',
  InvalidEventData = 'Users.InvalidEventData',
  AlreadyExist = 'Level.AlreadyExist',
}

export class Zkitter extends GenericService {
  web3: Web3;

  registrar: Contract;

  db: GenericDBAdapterInterface;

  historyAPI: string;

  services: {
    users: UserService;
    pubsub: PubsubService;
    posts: PostService;
    moderations: ModerationService;
    connections: ConnectionService;
    profile: ProfileService;
    groups: GroupService;
  };

  readonly subscriptions: {
    groups: { [groupId: string]: string };
    users: { [address: string]: string };
    threads: { [hash: string]: string };
    all: boolean;
  };

  private unsubscribe: (() => Promise<void>) | null;

  static async initialize(options?: {
    arbitrumProvider?: string;
    groups?: GenericGroupAdapter[];
    db?: GenericDBAdapterInterface;
    historyAPI?: string;
    lazy?: boolean;
    topicPrefix?: string;
  }): Promise<Zkitter> {
    const db = options?.db || (await LevelDBAdapter.initialize());
    const users = new UserService({
      db,
      arbitrumProvider: options?.arbitrumProvider || 'https://arb1.arbitrum.io/rpc',
    });
    const posts = new PostService({ db });
    const moderations = new ModerationService({ db });
    const connections = new ConnectionService({ db });
    const profile = new ProfileService({ db });
    const groups = new GroupService({ db });
    const pubsub = await PubsubService.initialize(
      users,
      groups,
      options?.lazy,
      options?.topicPrefix
    );

    const grouplist = options?.groups || [
      new GlobalGroup({ db }),
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
      db,
      users,
      pubsub,
      posts,
      moderations,
      connections,
      profile,
      groups,
      historyAPI: options?.historyAPI,
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
      groups: GroupService;
      historyAPI?: string;
    }
  ) {
    super(opts);
    this.db = opts.db;
    this.unsubscribe = null;
    this.subscriptions = {
      all: false,
      users: {},
      groups: {},
      threads: {},
    };
    this.historyAPI = opts.historyAPI || 'https://api.zkitter.com/v1/history';

    this.services = {
      pubsub: opts.pubsub,
      users: opts.users,
      posts: opts.posts,
      moderations: opts.moderations,
      connections: opts.connections,
      profile: opts.profile,
      groups: opts.groups,
    };

    for (const service of Object.values(this.services)) {
      service.onAny((event, ...values) => {
        this.emit(event, ...values);
      });
    }
  }

  async status() {
    return this.services.users.status();
  }

  private appendNewSubscription(
    options?: {
      groups?: string[];
      users?: string[];
      threads?: string[];
    } | null
  ) {
    this.subscriptions.all = !options;

    if (options?.users?.length) {
      this.subscriptions.users = {
        ...this.subscriptions.users,
        ...options.users.reduce((m: any, a) => {
          m[a] = a;
          return m;
        }, {}),
      };
    }

    if (options?.groups?.length) {
      this.subscriptions.groups = {
        ...this.subscriptions.groups,
        ...options.groups.reduce((m: any, a) => {
          m[a] = a;
          return m;
        }, {}),
      };
    }

    if (options?.threads?.length) {
      this.subscriptions.threads = {
        ...this.subscriptions.threads,
        ...options.threads.reduce((m: any, a) => {
          m[a] = a;
          return m;
        }, {}),
      };
    }
  }

  /**
   * start zkitter node
   * use zkitter.subscribe to subcribe to new messages
   */
  async start() {
    await this.services.users.watchArbitrum();
    await this.services.groups.watch();
  }

  /**
   * Subscribe to new messages (pass null will subcribe to all messages)
   *
   * @param options.groups string[]     list of group ids
   * @param options.users string[]     list of user address
   * @param options.threads string[]     list of thread hashes
   */
  async subscribe(
    options?: {
      groups?: string[];
      users?: string[];
      threads?: string[];
    } | null
  ) {
    this.appendNewSubscription(options);

    if (options?.users?.length) {
      for (const user of options.users) {
        await this.queryHistory(user);
      }
    }

    if (options?.groups?.length) {
      await this.queryHistory('');
    }

    if (!options) {
      await this.queryHistory();
    }

    if (this.unsubscribe) {
      await this.unsubscribe();
    }

    const { all, threads, users, groups } = this.subscriptions;
    const subs = all
      ? null
      : {
          threads: Object.keys(threads),
          users: Object.keys(users),
          groups: Object.keys(groups),
        };

    await this.query(subs);
    this.unsubscribe = await this.services.pubsub.subscribe(subs, async (msg, proof) => {
      if (msg) {
        await this.insert(msg, proof);
      }
    });

    return this.unsubscribe;
  }

  async query(
    options?: {
      groups?: string[];
      users?: string[];
      threads?: string[];
    } | null
  ) {
    return this.services.pubsub.query(options, async (msg, proof) => {
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

  async getGroupByRoot(rootHash: string) {
    return this.services.groups.getGroupByRoot(rootHash);
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

  async getPosts(limit?: number, offset?: string | number): Promise<Post[]> {
    return this.services.posts.getPosts(limit, offset);
  }

  async getFollowings(address: string): Promise<string[]> {
    return this.services.users.getFollowings(address);
  }

  async getHomefeed(
    filter: {
      addresses: { [address: string]: true };
      groups: { [groupId: string]: true };
    },
    limit = -1,
    offset?: number | string
  ): Promise<Post[]> {
    return this.services.posts.getHomefeed(filter, limit, offset);
  }

  async getUserPosts(address: string, limit?: number, offset?: string | number): Promise<Post[]> {
    return this.services.posts.getUserPosts(address, limit, offset);
  }

  async getThread(hash: string, limit?: number, offset?: string | number): Promise<Post[]> {
    return this.services.posts.getReplies(hash, limit, offset);
  }

  async getPostMeta(hash: string): Promise<PostMeta> {
    return this.services.posts.getPostMeta(hash);
  }

  async getMessagesByUser(address: string, limit?: number, offset?: number | string) {
    return this.services.users.getMessagesByUser(address, limit, offset);
  }

  private async insert(msg: Message, proof: Proof) {
    try {
      switch (msg?.type) {
        case MessageType.Post:
          await this.services.posts.insert(msg as Post, proof);
          this.emit(ZkitterEvents.NewMessageCreated, msg, proof);
          break;
        case MessageType.Moderation:
          await this.services.moderations.insert(msg as Moderation, proof);
          this.emit(ZkitterEvents.NewMessageCreated, msg, proof);
          break;
        case MessageType.Connection:
          await this.services.connections.insert(msg as Connection, proof);
          this.emit(ZkitterEvents.NewMessageCreated, msg, proof);
          break;
        case MessageType.Profile:
          await this.services.profile.insert(msg as Profile, proof);
          this.emit(ZkitterEvents.NewMessageCreated, msg, proof);
          break;
      }
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.error(e);
      }
      if (e === AlreadyExistError) {
        this.emit(ZkitterEvents.AlreadyExist, msg);
      }
    }
  }

  async queryThread(address: string) {
    return this.services.pubsub.queryThread(address, async (msg, proof) => {
      if (msg) {
        await this.insert(msg, proof);
      }
    });
  }

  async queryUser(address: string) {
    await this.queryHistory(address);
    return this.services.pubsub.queryUser(address, async (msg, proof) => {
      if (msg) {
        await this.insert(msg, proof);
      }
    });
  }

  async queryGroup(groupId: string) {
    return this.services.pubsub.queryGroup(groupId, async (msg, proof) => {
      if (msg) {
        await this.insert(msg, proof);
      }
    });
  }

  async queryAll() {
    return this.services.pubsub.queryAll(async (msg, proof) => {
      if (msg) {
        await this.insert(msg, proof);
      }
    });
  }

  async queryHistory(user?: string): Promise<void> {
    const downloaded = await this.db.getHistoryDownloaded(user);
    if (downloaded) return;

    const query = typeof user === 'string' ? (user ? '?user=' + user : '?global=true') : '';

    const resp = await fetch(this.historyAPI + query);
    const json = await resp.json();

    return new Promise(async (resolve, reject) => {
      if (json.error) return reject(json.payload);

      try {
        for (const msg of json.payload) {
          if (!msg) continue;
          const { creator } = parseMessageId(msg.messageId);
          let message: Message | null = null;

          switch (msg.type) {
            case MessageType.Post:
              message = new Post({
                type: msg.type,
                subtype: msg.subtype,
                payload: msg.payload,
                createdAt: new Date(msg.createdAt),
                creator,
              });
              break;
            case MessageType.Moderation:
              message = new Moderation({
                type: msg.type,
                subtype: msg.subtype,
                payload: msg.payload,
                createdAt: new Date(msg.createdAt),
                creator,
              });
              break;
            case MessageType.Connection:
              message = new Connection({
                type: msg.type,
                subtype: msg.subtype,
                payload: msg.payload,
                createdAt: new Date(msg.createdAt),
                creator,
              });
              break;
            case MessageType.Profile:
              message = new Profile({
                type: msg.type,
                subtype: msg.subtype,
                payload: msg.payload,
                createdAt: new Date(msg.createdAt),
                creator,
              });
              break;
          }

          if (message) {
            await this.insert(message, {
              type: '',
              proof: null,
              group: msg.group,
            });
          }
        }

        await this.db.setHistoryDownloaded(true, user);
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
    zkIdentity?: ZkIdentity,
    groupId?: string;
  }): Promise<Proof> {
    return this.services.pubsub.createProof(opts);
  }
}
