import { ZkIdentity } from '@zk-kit/identity';
import { genExternalNullifier, RLN, RLNFullProof } from '@zk-kit/protocols';
import { sha256 } from './crypto';
import rlnVkey from '../../static/rln_vkey.json';

export const createRLNProof = async (hash: string, zkIdentity: ZkIdentity, merklePath: any) => {
  const identitySecretHash = zkIdentity.getSecretHash();
  const epoch = Date.now().toString();
  const externalNullifier = genExternalNullifier(epoch);
  const signal = hash;
  const rlnIdentifier = await sha256('zkpost');
  // const xShare = RLN.genSignalHash(signal);
  const witness = RLN.genWitness(
    identitySecretHash!,
    merklePath!,
    externalNullifier,
    signal,
    BigInt('0x' + rlnIdentifier)
  );

  const wasmResp = await fetch(`https://api.zkitter.com/circuits/rln/wasm`);
  const wasmbuf = Buffer.from(await wasmResp.arrayBuffer());
  const zkeyResp = await fetch(`https://api.zkitter.com/circuits/rln/zkey`);
  const zkeybuf = Buffer.from(await zkeyResp.arrayBuffer());

  // @ts-ignore
  return RLN.genProof(witness, wasmbuf, zkeybuf);
};

export const verifyRLNProof = async (hash: string, group: string | null, proof: RLNFullProof) => {
  const verified = await RLN.verifyProof(rlnVkey as any, proof);
  const signalHash = RLN.genSignalHash(hash);

  if (!verified) {
    return false;
  }

  if (!group) {
    return false;
  }

  if (signalHash !== BigInt(proof.publicSignals.signalHash)) {
    return false;
  }

  return true;
};
