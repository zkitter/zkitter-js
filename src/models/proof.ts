import { RLNFullProof } from '@zk-kit/protocols';

export enum ProofType {
  signature = 'signature',
  rln = 'rln',
  semaphore = 'semaphore',
}

export type SignatureProof = {
  type: ProofType.signature;
  signature: string;
};

export type RLNProof = {
  type: ProofType.rln;
  proof: RLNFullProof;
  groupId: string;
  ecdh?: string;
};

export type NullProof = {
  type: '';
  proof: null;
  group?: string;
};

export type Proof = SignatureProof | RLNProof | NullProof;
