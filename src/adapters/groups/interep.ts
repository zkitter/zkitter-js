import { generateMerkleTree } from '@zk-kit/protocols';
import {GenericGroupAdapter} from "../group";
import {GenericDBAdapterInterface} from "../db";

export class InterepGroup implements GenericGroupAdapter {
  db: GenericDBAdapterInterface;

  groupId: string;

  api = 'https://api.zkitter.com/v1/group_members/';

  constructor(opts: {
    db: GenericDBAdapterInterface,
    groupId: string,
  }) {
    this.db = opts.db;
    this.groupId = opts.groupId;
  }

  async sync() {
    const resp = await fetch(this.api + this.groupId);
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