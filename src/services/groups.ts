import {GenericService} from "../utils/svc";
import {GenericDBAdapterInterface} from "../adapters/db";
import {ConstructorOptions} from "eventemitter2";
import {GenericGroupAdapter, GroupEvents} from "../adapters/group";

export class GroupService extends GenericService {
  db: GenericDBAdapterInterface;

  groups: {
    [groupId: string]: GenericGroupAdapter;
  };

  constructor(props: ConstructorOptions & {
    db: GenericDBAdapterInterface
  }) {
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
      this.emit(GroupEvents.GroupSynced, groupId)
      return;
    }

    for (const group of Object.values(this.groups)) {
      await group.sync();
      this.emit(GroupEvents.GroupSynced, group.groupId)
    }
  }

  async getGroupByRoot(rootHash: string) {
    return this.db.findGroupHash(rootHash);
  }

  async getMerklePath(idCommitment: string, groupId?: string) {
    if (groupId) {
      const tree = await this.groups[groupId].tree();
      const proof = await tree.createProof(tree.indexOf(BigInt(idCommitment)));
      return proof || null;
    }

    for (const id of Object.keys(this.groups)) {
      const tree = await this.groups[id].tree();
      const proof = await tree.createProof(tree.indexOf(BigInt(idCommitment)));
      return proof || null;
    }
  }

  async members(groupId: string) {
    return this.groups[groupId].members();
  }
}