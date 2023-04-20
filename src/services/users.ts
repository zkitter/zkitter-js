import { ConstructorOptions } from 'eventemitter2';
import Web3 from 'web3';
import { provider } from 'web3-core';
import { Contract } from 'web3-eth-contract';
import { GenericDBAdapterInterface } from '../adapters/db';
import { User } from '../models/user';
import { UserMeta } from '../models/usermeta';
import { arbRegistrarABI } from '../utils/abi';
import mutexify from '../utils/mux';
import { GenericService } from '../utils/svc';

export const ARBITRUM_REGISTRAR_ADDRESS = '0x6b0a11F9aA5aa275f16e44e1D479A59dd00abE58';

export enum UserServiceEvents {
  ArbitrumSynced = 'Users.ArbitrumSynced',
  NewUserCreated = 'Users.NewUserCreated',
  InvalidEventData = 'Users.InvalidEventData',
}

const DEFAULT_WATCH_INTERVAL = 1000 * 60;

export class UserService extends GenericService {
  web3: Web3;

  registrar: Contract;

  db: GenericDBAdapterInterface;

  timeout: any;

  http?: provider;
  ws?: provider;

  getBlock: (block: string | number) => Promise<any>;

  constructor(
    props: ConstructorOptions & {
      db: GenericDBAdapterInterface;
      arbitrumProvider: string;
    }
  ) {
    super(props);
    const url = new URL(props.arbitrumProvider);

    if (url.protocol === 'https:') {
      this.http = new Web3.providers.HttpProvider(props.arbitrumProvider);
      this.web3 = new Web3(this.http);
    } else if (url.protocol === 'wss:') {
      this.ws = new Web3.providers.WebsocketProvider(props.arbitrumProvider);
      this.web3 = new Web3(this.ws);
    }

    this.getBlock = mutexify(this.web3.eth.getBlock);
    this.registrar = new this.web3.eth.Contract(arbRegistrarABI as any, ARBITRUM_REGISTRAR_ADDRESS);
    this.db = props.db;
  }

  async start() {
    await this.watchArbitrum();
  }

  async status(): Promise<{
    totalUsers: number;
    lastBlockScanned: number;
    latestBlock: number;
  }> {
    const lastBlock = await this.db.getLastArbitrumBlockScanned();
    const block = await this.getBlock('latest');

    return {
      lastBlockScanned: lastBlock,
      latestBlock: block.number,
      totalUsers: await this.db.getUserCount(),
    };
  }

  async subscribeRegistrar(startingBlock?: number): Promise<void> {
    const lastBlock = startingBlock || (await this.db.getLastArbitrumBlockScanned());
    const block = await this.getBlock('latest');

    return new Promise((resolve, reject) => {
      let timeout: any;
      this.registrar.events
        .RecordUpdatedFor({
          fromBlock: lastBlock,
        })
        .on(
          'data',
          mutexify(async (event: any) => {
            if (timeout) {
              clearTimeout(timeout);
            }
            await this.updateUser(event);
            await this.db.updateLastArbitrumBlockScanned(event.blockNumber + 1);
            this.emit(UserServiceEvents.ArbitrumSynced, {
              toBlock: event.blockNumber,
            });
            timeout = setTimeout(resolve, 5000);
          })
        )
        .on('connected', () => {
          if (timeout) {
            clearTimeout(timeout);
          }
          timeout = setTimeout(resolve, 5000);
        })
        .on('error', (err: any) => {
          throw new Error(err);
        });
    }).then(async () => {
      this.emit(UserServiceEvents.ArbitrumSynced, {
        toBlock: block.number,
      });
    });
  }

  async updateUser(event: {
    transactionHash: string;
    id: string;
    blockNumber: number;
    returnValues: {
      [key: string]: string;
    };
  }): Promise<void> {
    const block = await this.getBlock(event.blockNumber);
    const pubkeyBytes = event.returnValues.value;
    const account = event.returnValues.account;
    const pubkey = Web3.utils.hexToUtf8(pubkeyBytes);

    const x = pubkey.split('.')[0];
    const y = pubkey.split('.')[1];

    if (x.length !== 43 || y.length !== 43) {
      this.emit(UserServiceEvents.InvalidEventData, event);
      return;
    }

    const user: User = {
      address: account,
      joinedAt: new Date(Number(block.timestamp) * 1000),
      pubkey,
      tx: event.transactionHash,
      type: 'arbitrum',
    };

    await this.db.updateUser(user);
    this.emit(UserServiceEvents.NewUserCreated, user);
  }

  async fetchUsersFromArbitrum(startingBlock?: number): Promise<void> {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    const lastBlock = startingBlock || (await this.db.getLastArbitrumBlockScanned());
    const block = await this.getBlock('latest');

    const toBlock = Math.min(block.number, lastBlock + 999999);

    const events = await this.registrar.getPastEvents('RecordUpdatedFor', {
      fromBlock: lastBlock,
      toBlock: toBlock,
    });

    for (const event of events) {
      await this.updateUser(event as any);
    }

    await this.db.updateLastArbitrumBlockScanned(toBlock);

    this.emit(UserServiceEvents.ArbitrumSynced, {
      fromBlock: lastBlock,
      latest: block.number,
      toBlock: toBlock,
    });

    if (block.number > toBlock) {
      return this.fetchUsersFromArbitrum(toBlock);
    }
  }

  syncUsers = async () => {
    if (this.http) {
      await this.fetchUsersFromArbitrum();
    } else if (this.ws) {
      await this.subscribeRegistrar();
    }
  };

  watchArbitrum = async (interval = DEFAULT_WATCH_INTERVAL) => {
    if (this.http) {
      try {
        await this.fetchUsersFromArbitrum();
      } finally {
        this.timeout = setTimeout(this.watchArbitrum, interval);
      }
    } else if (this.ws) {
      await this.subscribeRegistrar();
    }
  };

  async getUsers(limit?: number, offset?: string | number): Promise<User[]> {
    return this.db.getUsers(limit, offset);
  }

  async getUser(address: string): Promise<User | null> {
    return this.db.getUser(address);
  }

  async getUserMeta(address: string): Promise<UserMeta> {
    return this.db.getUserMeta(address);
  }

  async getFollowings(address: string): Promise<string[]> {
    return this.db.getFollowings(address);
  }

  async getMessagesByUser(address: string, limit?: number, offset?: number | string) {
    return this.db.getMessagesByUser(address, limit, offset);
  }
}
