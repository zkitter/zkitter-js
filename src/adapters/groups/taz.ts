import { generateMerkleTree } from '@zk-kit/protocols';
import {GenericGroupAdapter, GroupEvents} from "../group";
import {GenericDBAdapterInterface} from "../db";
import {IncrementalMerkleTree} from "@zk-kit/incremental-merkle-tree";
import EventEmitter2, {ConstructorOptions} from "eventemitter2";

export class TazGroup extends EventEmitter2 implements GenericGroupAdapter {
  db: GenericDBAdapterInterface;

  groupId = 'semaphore_taz_members';

  api = 'https://api.zkitter.com/v1/group_members/semaphore_taz_members';

  constructor(opts: {
    db: GenericDBAdapterInterface,
  } & ConstructorOptions) {
    super(opts);
    this.db = opts.db;
  }

  async sync() {
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
            newRoot: tree.root.toString(),
            index: i,
          };
          await this.db.insertGroupMember(this.groupId, member);
          this.emit(GroupEvents.NewGroupMemberCreated, member, this.groupId);
        }
      }
    }
  }

  async tree(depth = 15): Promise<IncrementalMerkleTree> {
    const tree = generateMerkleTree(
      depth,
      BigInt(0),
      await this.members(),
    );

    return tree;
  }

  async members(limit?: number, offset?: number|string): Promise<string[]> {
    return this.db.getGroupMembers(this.groupId, limit, offset);
  }

  async verify() {
    return false;
  }
}