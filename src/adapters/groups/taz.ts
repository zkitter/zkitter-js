import { IncrementalMerkleTree } from '@zk-kit/incremental-merkle-tree';
import { generateMerkleTree } from '@zk-kit/protocols';
import EventEmitter2, { ConstructorOptions } from 'eventemitter2';
import { GenericDBAdapterInterface } from '../db';
import { GenericGroupAdapter, GroupEvents } from '../group';

export class TazGroup extends EventEmitter2 implements GenericGroupAdapter {
  db: GenericDBAdapterInterface;

  groupId = 'semaphore_taz_members';

  api = 'https://api.zkitter.com/v1/group_members/semaphore_taz_members';

  constructor(
    opts: {
      db: GenericDBAdapterInterface;
    } & ConstructorOptions
  ) {
    super(opts);
    this.db = opts.db;
  }

  sync = async () => {
    const members = await this.members();
    const resp = await fetch(this.api + '?offset=' + members.length);
    const json = await resp.json();

    if (!json.error) {
      const tree = await this.tree();
      for (let i = 0; i < json.payload.length; i++) {
        const idCommitment = '0x' + json.payload[i].id_commitment;
        if (tree.indexOf(BigInt(idCommitment)) < 0) {
          tree.insert(BigInt(idCommitment));
          const member = {
            idCommitment,
            index: i + members.length,
            newRoot: tree.root.toString(),
          };
          await this.db.insertGroupMember(this.groupId, member);
          this.emit(GroupEvents.NewGroupMemberCreated, member, this.groupId);
        }
      }
    }
  };

  async tree(depth = 15): Promise<IncrementalMerkleTree> {
    const tree = generateMerkleTree(depth, BigInt(0), await this.members());

    return tree;
  }

  async members(limit?: number, offset?: number | string): Promise<string[]> {
    return this.db.getGroupMembers(this.groupId, limit, offset);
  }

  async verify() {
    return false;
  }
}
