import {GenericDBAdapterInterface} from "./db";

export interface GenericGroupAdapter {
  groupId: string;
  db: GenericDBAdapterInterface;
  sync: () => Promise<void>;
  tree: () => Promise<any>;
  members: () => Promise<any>;
  verify: () => Promise<boolean>;
}