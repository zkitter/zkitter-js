import { Strategy, ZkIdentity } from '@zk-kit/identity';
import EC from 'elliptic';
import { sha256, signWithP256 } from './crypto';
import { arrayBufToBase64UrlEncode, hexToArrayBuf } from './encoding';

export const generateIdentity = async (
  nonce = 0,
  signFn: (dataToSign: string) => Promise<string>
): Promise<{ pub: string; priv: string }> => {
  const signedMessage = await signFn(
    `Sign this message to generate a GUN key pair with key nonce: ${nonce}`
  );
  return _generateGunKeyPair(signedMessage);
};

const _generateGunKeyPair = async (seed: string): Promise<{ pub: string; priv: string }> => {
  const hashBuffer = Buffer.from(await sha256(seed), 'hex');
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return await generateGunKeyPairFromHex(hashHex);
};

const generateGunKeyPairFromHex = async (
  hashHex: string
): Promise<{ pub: string; priv: string }> => {
  const ec = new EC.ec('p256');
  const key = ec.keyFromPrivate(hashHex);
  const pubPoint = key.getPublic();
  const pubHex = pubPoint.encode('hex', false);
  const pubX = arrayBufToBase64UrlEncode(hexToArrayBuf(pubHex).slice(1, 33));
  const pubY = arrayBufToBase64UrlEncode(hexToArrayBuf(pubHex).slice(33, 66));
  return {
    priv: arrayBufToBase64UrlEncode(Buffer.from(hashHex, 'hex')),
    pub: `${pubX}.${pubY}`,
  };
};

export const generateZkIdentityFromHex = async (hashHex: string): Promise<ZkIdentity> => {
  return new ZkIdentity(Strategy.MESSAGE, hashHex);
};

export const generateZKIdentityWithP256 = async (
  base64PrivateKey: string,
  nonce = 0
): Promise<ZkIdentity> => {
  const zkseed = await signWithP256(base64PrivateKey, `signing for zk identity - ${nonce}`);
  const zkHex = await sha256(zkseed);
  return generateZkIdentityFromHex(zkHex);
};

export const generateECDHWithP256 = async (
  base64PrivateKey: string,
  nonce = 0
): Promise<{ pub: string; priv: string }> => {
  const ecdhseed = await signWithP256(base64PrivateKey, `signing for ecdh - ${nonce}`);
  const ecdhHex = await sha256(ecdhseed);
  return generateECDHKeyPairFromhex(ecdhHex);
};

export const generateECDHKeyPairFromhex = async (
  hashHex: string
): Promise<{ pub: string; priv: string }> => {
  const ec = new EC.ec('curve25519');
  const key = ec.keyFromPrivate(hashHex);
  const pubhex = key.getPublic().encodeCompressed('hex');
  const privhex = key.getPrivate().toString('hex');

  return {
    priv: '0x' + privhex,
    pub: '0x' + pubhex,
  };
};
