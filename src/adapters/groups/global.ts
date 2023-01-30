import { generateMerkleTree } from '@zk-kit/protocols';
import {GenericGroupAdapter} from "../group";
import {GenericDBAdapterInterface} from "../db";

export class GlobalGroup implements GenericGroupAdapter {
  db: GenericDBAdapterInterface;

  groupId = 'zksocial_all';

  api = 'https://api.zkitter.com/v1/group_members/zksocial_all';

  constructor(opts: {
    db: GenericDBAdapterInterface,
  }) {
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

  async tree(depth = 15) {
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