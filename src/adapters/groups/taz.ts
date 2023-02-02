import { generateMerkleTree } from '@zk-kit/protocols';
import {GenericGroupAdapter} from "../group";
import {GenericDBAdapterInterface} from "../db";
import {IncrementalMerkleTree} from "@zk-kit/incremental-merkle-tree";

export class TazGroup implements GenericGroupAdapter {
  db: GenericDBAdapterInterface;

  groupId = 'semaphore_taz_members';

  api = 'https://api.zkitter.com/v1/group_members/semaphore_taz_members';

  constructor(opts: { db: GenericDBAdapterInterface }) {
    this.db = opts.db;
  }

  async sync() {
    const resp = await fetch(this.api);
    const json = await resp.json();

    if (!json.error) {
      const tree = await this.tree();
      for (let i = 0; i < json.payload.length; i++) {
        const idCommitment = '0x' + json.payload[i].id_commitment;
        await this.db.insertGroupMember(this.groupId, {
          idCommitment,
          newRoot: tree.root.toString(),
          index: i,
        });
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