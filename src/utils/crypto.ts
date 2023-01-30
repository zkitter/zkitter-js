import EC from "elliptic";
import {base64ToArrayBuffer} from "./encoding";
import crypto from "crypto";

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
export const sha256 = async (data: string): Promise<string> => {
  return crypto.createHash('sha256')
    .update(data)
    .digest('hex');
};