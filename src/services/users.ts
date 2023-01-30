import {GenericService} from "../utils/svc";
import Web3 from "web3";
import logger from "../utils/logger";
import {GenericDBAdapterInterface} from "../adapters/db";
import {arbRegistrarABI} from "../utils/abi";
import {Contract} from "web3-eth-contract";
import {User} from "../models/user";
import {UserMeta} from "../models/usermeta";
import {ConstructorOptions} from "eventemitter2";

export const ARBITRUM_REGISTRAR_ADDRESS = '0x6b0a11F9aA5aa275f16e44e1D479A59dd00abE58';

export enum UserServiceEvents {
  ArbitrumSynced = 'Users.ArbitrumSynced',
}

const DEFAULT_WATCH_INTERVAL = 1000 * 15;

export class UserService extends GenericService {
  web3: Web3;

  registrar: Contract;

  db: GenericDBAdapterInterface;

  timeout: any;

  constructor(
    props: ConstructorOptions & {
      db: GenericDBAdapterInterface,
      arbitrumHttpProvider: string,
    },
  ) {
    super(props);
    const httpProvider = new Web3.providers.HttpProvider(props.arbitrumHttpProvider);
    this.web3 = new Web3(httpProvider);
    this.registrar = new this.web3.eth.Contract(arbRegistrarABI as any, ARBITRUM_REGISTRAR_ADDRESS);
    this.db = props.db;
  }

  async status(): Promise<{
    totalUsers: number;
    lastBlockScanned: number;
    latestBlock: number;
  }> {
    const lastBlock = await this.db.getLastArbitrumBlockScanned();
    const block = await this.web3.eth.getBlock('latest');

    return {
      totalUsers: await this.db.getUserCount(),
      lastBlockScanned: lastBlock,
      latestBlock: block.number,
    };
  }

  async fetchUsersFromArbitrum(startingBlock?: number): Promise<void> {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    const lastBlock = startingBlock || await this.db.getLastArbitrumBlockScanned();
    const block = await this.web3.eth.getBlock('latest');

    const toBlock = Math.min(block.number, lastBlock + 99999);

    const events = await this.registrar.getPastEvents('RecordUpdatedFor', {
      fromBlock: lastBlock,
      toBlock: toBlock,
    });

    for (const event of events) {
      const tx = await this.web3.eth.getTransaction(event.transactionHash);
      const block = await this.web3.eth.getBlock(event.blockNumber);

      const pubkeyBytes = event.returnValues.value;
      const account = event.returnValues.account;
      const pubkey = Web3.utils.hexToUtf8(pubkeyBytes);

      const x = pubkey.split('.')[0];
      const y = pubkey.split('.')[1];

      if (x.length !== 43 || y.length !== 43) {
        logger.error('invalid pubkey', {
          fromBlock: lastBlock,
          toBlock: block.number,
        });
        continue;
      }

      await this.db.updateUser({
        address: account,
        pubkey,
        joinedAt: new Date(Number(block.timestamp) * 1000),
        tx: tx.hash,
        type: 'arbitrum',
      });
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

  watchArbitrum = async (interval = DEFAULT_WATCH_INTERVAL) => {
    try {
      await this.fetchUsersFromArbitrum();
    } finally {
      this.timeout = setTimeout(this.watchArbitrum, interval);
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