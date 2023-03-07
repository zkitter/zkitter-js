/* eslint-disable import/export */
/* eslint-disable @typescript-eslint/no-namespace */

import { decodeMessage, encodeMessage, message } from 'protons-runtime';
import type { Codec } from 'protons-runtime';
import type { Uint8ArrayList } from 'uint8arraylist';

export interface Message {
  timestamp: bigint;
  data: Uint8Array;
  proof: Uint8Array;
}

export namespace Message {
  let _codec: Codec<Message>;

  export const codec = (): Codec<Message> => {
    if (_codec == null) {
      _codec = message<Message>(
        (obj, writer, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            writer.fork();
          }

          if (obj.timestamp != null) {
            writer.uint32(8);
            writer.uint64(obj.timestamp);
          } else {
            throw new Error('Protocol error: required field "timestamp" was not found in object');
          }

          if (obj.data != null) {
            writer.uint32(18);
            writer.bytes(obj.data);
          } else {
            throw new Error('Protocol error: required field "data" was not found in object');
          }

          if (obj.proof != null) {
            writer.uint32(26);
            writer.bytes(obj.proof);
          } else {
            throw new Error('Protocol error: required field "payload" was not found in object');
          }

          if (opts.lengthDelimited !== false) {
            writer.ldelim();
          }
        },
        (reader, length) => {
          const obj: any = {
            data: new Uint8Array(0),
            proof: new Uint8Array(0),
            timestamp: BigInt(0),
          };

          const end = length == null ? reader.len : reader.pos + length;

          while (reader.pos < end) {
            const tag = reader.uint32();

            switch (tag >>> 3) {
              case 1:
                obj.timestamp = reader.uint64();
                break;
              case 2:
                obj.data = reader.bytes();
                break;
              case 3:
                obj.proof = reader.bytes();
                break;
              default:
                reader.skipType(tag & 7);
                break;
            }
          }

          if (obj.timestamp == null) {
            throw new Error(
              'Protocol error: value for required field "timestamp" was not found in protobuf'
            );
          }

          if (obj.data == null) {
            throw new Error(
              'Protocol error: value for required field "payload" was not found in protobuf'
            );
          }

          if (obj.proof == null) {
            throw new Error(
              'Protocol error: value for required field "proof" was not found in protobuf'
            );
          }

          return obj;
        }
      );
    }

    return _codec;
  };

  export const encode = (obj: Message): Uint8Array => {
    return encodeMessage(obj, Message.codec());
  };

  export const decode = (buf: Uint8Array | Uint8ArrayList): Message => {
    return decodeMessage(buf, Message.codec());
  };
}
