import { bytesToUtf8, utf8ToBytes } from '@waku/byte-utils';
import * as proto from '../proto/message';

/**
 * ChatMessage is used by the various show case waku apps that demonstrates
 * waku used as the network layer for chat group applications.
 *
 * This is included to help building PoC and MVPs. Apps that aim to be
 * production ready should use a more appropriate data structure.
 */
export class Message {
  public constructor(public proto: proto.Message) {}

  /**
   * Create Chat Message with a utf-8 string as payload.
   */
  static fromUtf8String(data: string, proof: string, timestamp?: Date): Message {
    const timestampNumber = BigInt(Math.floor((timestamp || new Date()).valueOf() / 1000));
    const dataBuf = utf8ToBytes(data);
    const proofBuf = utf8ToBytes(proof);

    return new Message({
      data: dataBuf,
      proof: proofBuf,
      timestamp: timestampNumber,
    });
  }

  /**
   * Decode a protobuf payload to a ChatMessage.
   * @param bytes The payload to decode.
   */
  static decode(bytes: Uint8Array): Message {
    const protoMsg = proto.Message.decode(bytes);
    return new Message(protoMsg);
  }

  /**
   * Encode this ChatMessage to a byte array, to be used as a protobuf payload.
   * @returns The encoded payload.
   */
  encode(): Uint8Array {
    return proto.Message.encode(this.proto);
  }

  get timestamp(): Date {
    return new Date(Number(BigInt(this.proto.timestamp) * BigInt(1000)));
  }

  get data(): string {
    if (!this.proto.data) {
      return '';
    }

    return bytesToUtf8(this.proto.data);
  }

  get proof(): string {
    if (!this.proto.proof) {
      return '';
    }

    return bytesToUtf8(this.proto.proof);
  }
}
