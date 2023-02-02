import {GenericDBAdapterInterface} from "./db";
import {IncrementalMerkleTree} from "@zk-kit/incremental-merkle-tree";

export interface GenericGroupAdapter {
  groupId: string;
  db: GenericDBAdapterInterface;
  sync: () => Promise<void>;
  tree: () => Promise<IncrementalMerkleTree>;
  members: () => Promise<any>;
  verify: () => Promise<boolean>;
}