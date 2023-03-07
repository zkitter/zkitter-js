export enum GroupID {
  semaphore_taz_members = 'semaphore_taz_members',
}

export type GroupMember = {
  idCommitment: string;
  index: number;
  newRoot: string;
};
