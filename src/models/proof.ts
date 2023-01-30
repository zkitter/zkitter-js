import {RLNFullProof} from "@zk-kit/protocols";

export enum ProofType {
  signature = 'signature',
  rln = 'rln',
  semaphore = 'semaphore',
}

export type SignatureProof = {
  type: ProofType.signature;
  signature: string;
}

export type RLNProof = {
  type: ProofType.rln;
  proof: RLNFullProof;
}

export type Proof = SignatureProof | RLNProof;