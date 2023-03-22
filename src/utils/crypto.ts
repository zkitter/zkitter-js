import crypto from 'crypto';
import CryptoJS from 'crypto-js';
import EC from 'elliptic';
import { base64ToArrayBuffer } from './encoding';

export const signWithP256 = (base64PrivateKey: string, data: string) => {
  const buff = base64ToArrayBuffer(base64PrivateKey);
  const hex = Buffer.from(buff).toString('hex');
  const ec = new EC.ec('p256');
  const key = ec.keyFromPrivate(hex);
  const msgHash = Buffer.from(data, 'utf-8').toString('hex');
  const signature = key.sign(msgHash);
  return Buffer.from(signature.toDER()).toString('hex');
};

export function verifySignatureP256(pubkey: string, data: string, signature: string): boolean {
  const [x, y] = pubkey.split('.');
  const ec = new EC.ec('p256');
  const pub = ec.keyFromPublic({
    x: Buffer.from(base64ToArrayBuffer(x)).toString('hex'),
    y: Buffer.from(base64ToArrayBuffer(y)).toString('hex'),
  });
  return pub.verify(
    Buffer.from(data, 'utf-8').toString('hex'),
    Buffer.from(signature, 'hex').toJSON().data
  );
}
export const sha256 = async (data: string | string[]): Promise<string> => {
  let h = crypto.createHash('sha256');

  if (typeof data === 'string') {
    h = h.update(data);
  } else {
    data.forEach(d => {
      h = h.update(d);
    });
  }

  return h.digest('hex');
};

export const deriveSharedSecret = (receiverPubkey: string, senderPrivateKey: string): string => {
  const ec = new EC.ec('curve25519');
  const sendKey = ec.keyFromPrivate(senderPrivateKey, 'hex');
  const receiverKey = ec.keyFromPublic(receiverPubkey, 'hex');
  const shared = sendKey.derive(receiverKey.getPublic());
  return shared.toString(16);
};

export function encrypt(text: string, password: string): string {
  return CryptoJS.AES.encrypt(text, password).toString();
}

export function decrypt(ciphertext: string, password: string): string {
  const bytes = CryptoJS.AES.decrypt(ciphertext, password);
  return bytes.toString(CryptoJS.enc.Utf8);
}

export function randomBytes(size = 16): string {
  return crypto.randomBytes(size).toString('hex');
}
