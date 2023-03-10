import { sha256 } from './crypto';
import { toBigInt } from './encoding';

export const deriveChatId = async (receiverECDH: string, senderECDH: string): Promise<string> => {
  const receiverBn = toBigInt(receiverECDH);
  const senderBn = toBigInt(senderECDH);

  if (receiverBn === senderBn) {
    throw new Error('receiverECDH must not equal senderECDH');
  }

  return receiverBn < senderBn
    ? sha256([receiverECDH, senderECDH])
    : sha256([senderECDH, receiverECDH]);
};
