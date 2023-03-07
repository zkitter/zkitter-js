import { GenericService } from '../utils/svc';
import { GenericDBAdapterInterface } from '../adapters/db';
import { ConstructorOptions } from 'eventemitter2';
import { GenericGroupAdapter, GroupEvents } from '../adapters/group';
import { generateMerkleTree } from '@zk-kit/protocols';

const DEFAULT_WATCH_INTERVAL = 1000 * 60 * 15;

export class GroupService extends GenericService {
  db: GenericDBAdapterInterface;

  timeout: any;

  groups: {
    [groupId: string]: GenericGroupAdapter;
  };

  api = 'https://api.zkitter.com/v1/group_members';

  constructor(
    props: ConstructorOptions & {
      db: GenericDBAdapterInterface;
    }
  ) {
    super(props);
    this.db = props.db;
    this.groups = {};
  }

  status() {
    return Object.values(this.groups);
  }

  addGroup(group: GenericGroupAdapter) {
    this.groups[group.groupId] = group;
    group.onAny((event, ...values) => {
      this.emit(event, ...values);
    });
  }

  async sync(groupId?: string) {
    if (groupId && this.groups[groupId]) {
      await this.groups[groupId].sync();
      this.emit(GroupEvents.GroupSynced, groupId);
      return;
    }

    if (groupId) {
      const [protocol, provider, type] = groupId.split('_');
      const members = await this.members(groupId);
      if (protocol === 'custom') {
        const resp = await fetch(this.api + '/' + groupId + '?offset=' + members.length);
        const json = await resp.json();

        if (!json.error) {
          const tree = generateMerkleTree(15, BigInt(0), members);

          for (let i = 0; i < json.payload.length; i++) {
            const idCommitment = '0x' + json.payload[i].id_commitment;
            if (tree.indexOf(BigInt(idCommitment)) < 0) {
              tree.insert(BigInt(idCommitment));
              const member = {
                idCommitment,
                newRoot: tree.root.toString(),
                index: i,
              };
              await this.db.insertGroupMember(groupId, member);
              this.emit(GroupEvents.NewGroupMemberCreated, member, groupId);
            }
          }
        }

        return;
      }
    }

    for (const group of Object.values(this.groups)) {
      await group.sync();
      this.emit(GroupEvents.GroupSynced, group.groupId);
    }
  }

  watch = async (groupId?: string) => {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    await this.sync(groupId);
    this.timeout = setTimeout(this.watch, DEFAULT_WATCH_INTERVAL);
  };

  async getGroupByRoot(rootHash: string) {
    return this.db.findGroupHash(rootHash);
  }

  async getMerklePath(idCommitment: string, groupId?: string, depth = 15) {
    if (groupId) {
      await this.sync(groupId);

      const [protocol, provider, type] = groupId.split('_');
      let tree;

      if (protocol === 'custom') {
        tree = generateMerkleTree(depth, BigInt(0), await this.members(groupId));
      } else {
        tree = await this.groups[groupId].tree();
      }

      const proof = await tree.createProof(tree.indexOf(BigInt(idCommitment)));
      return proof || null;
    }

    for (const id of Object.keys(this.groups)) {
      const tree = await this.groups[id].tree();
      const proof = await tree.createProof(tree.indexOf(BigInt(idCommitment)));
      return proof || null;
    }
  }

  async members(groupId: string): Promise<string[]> {
    return this.db.getGroupMembers(groupId);
  }
}
