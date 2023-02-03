import {GenericService} from "../utils/svc";
import Web3 from "web3";
import {provider} from "web3-core";
import {GenericDBAdapterInterface} from "../adapters/db";
import {arbRegistrarABI} from "../utils/abi";
import {Contract} from "web3-eth-contract";
import {User} from "../models/user";
import {UserMeta} from "../models/usermeta";
import {ConstructorOptions} from "eventemitter2";
import mutexify from "../utils/mux";

export const ARBITRUM_REGISTRAR_ADDRESS = '0x6b0a11F9aA5aa275f16e44e1D479A59dd00abE58';

export enum UserServiceEvents {
  ArbitrumSynced = 'Users.ArbitrumSynced',
  NewUserCreated = 'Users.NewUserCreated',
  InvalidEventData = 'Users.InvalidEventData',
}

const DEFAULT_WATCH_INTERVAL = 1000 * 15;

export class UserService extends GenericService {
  web3: Web3;

  registrar: Contract;

  db: GenericDBAdapterInterface;

  timeout: any;

  http?: provider;
  ws?: provider;

  getBlock: (block: string|number) => Promise<any>;

  constructor(
    props: ConstructorOptions & {
      db: GenericDBAdapterInterface,
      arbitrumProvider: string,
    },
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

  async status(): Promise<{
    totalUsers: number;
    lastBlockScanned: number;
    latestBlock: number;
  }> {
    const lastBlock = await this.db.getLastArbitrumBlockScanned();
    const block = await this.getBlock('latest');

    return {
      totalUsers: await this.db.getUserCount(),
      lastBlockScanned: lastBlock,
      latestBlock: block.number,
    };
  }

  async subscribeRegistrar(startingBlock?: number): Promise<void> {
    const lastBlock = startingBlock || await this.db.getLastArbitrumBlockScanned();

    return new Promise((resolve, reject) => {
      let timeout: any;
      this.registrar.events.RecordUpdatedFor({
          fromBlock: lastBlock,
        })
        .on('data', mutexify(async(event: any) => {
          if (timeout) {
            clearTimeout(timeout);
          }
          await this.updateUser(event);
          await this.db.updateLastArbitrumBlockScanned(event.blockNumber + 1);
          timeout = setTimeout(resolve, 5000);
        }))
        .on('connected', () => {
          if (timeout) {
            clearTimeout(timeout);
          }
          timeout = setTimeout(resolve, 5000);
        })
        .on('error', (err: any) => {throw new Error(err)})
    });

  }

  async updateUser(event: {
    transactionHash: string;
    id: string;
    blockNumber: number;
    returnValues: {
      [key: string]: string;
    }
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
      pubkey,
      joinedAt: new Date(Number(block.timestamp) * 1000),
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

    const lastBlock = startingBlock || await this.db.getLastArbitrumBlockScanned();
    const block = await this.getBlock('latest');

    const toBlock = Math.min(block.number, lastBlock + 99999);

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
      toBlock: toBlock,
      latest: block.number,
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
  }

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
  }

  async getUsers(limit?: number, offset?: string|number): Promise<User[]> {
    return this.db.getUsers(limit, offset);
  }

  async getUser(address: string): Promise<User|null> {
    return this.db.getUser(address);
  }

  async getUserMeta(address: string): Promise<UserMeta> {
    return this.db.getUserMeta(address);
  }

  async getMessagesByUser(address: string, limit?: number, offset?: number|string) {
    return this.db.getMessagesByUser(address, limit, offset);
  }
}