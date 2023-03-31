import { Strategy, ZkIdentity } from '@zk-kit/identity';
import { ConstructorOptions } from 'eventemitter2';
import { createDecoder, createEncoder, waitForRemotePeer } from '@waku/core';
import { createLightNode } from '@waku/create';
import { LightNode, Protocols } from '@waku/interfaces';
import { Message } from '../models/message';
import { Proof, ProofType } from '../models/proof';
import { sha256, signWithP256, verifySignatureP256 } from '../utils/crypto';
import { Filter } from '../utils/filters';
import { generateECDHKeyPairFromZKIdentity, generateZKIdentityWithP256 } from '../utils/identity';
import {
  Chat,
  ChatMessageSubType,
  Message as ZkitterMessage,
  MessageType,
  Moderation,
  ModerationMessageSubType,
  parseMessageId,
  Post,
  PostMessageSubType,
} from '../utils/message';
import {
  chatTopic,
  globalMessageTopic,
  groupMessageTopic,
  threadTopic,
  userMessageTopic,
} from '../utils/pubsub';
import { GenericService } from '../utils/svc';
import { createRLNProof, verifyRLNProof } from '../utils/zk';
import { GroupService } from './groups';
import { UserService } from './users';

export class PubsubService extends GenericService {
  waku: LightNode;

  users: UserService;

  groups: GroupService;

  topicPrefix?: string;

  static async initialize(
    users: UserService,
    groups: GroupService,
    lazy?: boolean,
    topicPrefix?: string
  ) {
    const waku = await createLightNode({ defaultBootstrap: true });
    if (!lazy) {
      await waku.start();
      await waitForRemotePeer(waku, [Protocols.Store, Protocols.Filter, Protocols.LightPush]);
    }
    return new PubsubService({ groups, topicPrefix, users, waku });
  }

  constructor(
    opts: ConstructorOptions & {
      waku: LightNode;
      users: UserService;
      groups: GroupService;
      topicPrefix?: string;
    }
  ) {
    super(opts);
    this.waku = opts.waku;
    this.users = opts.users;
    this.groups = opts.groups;
    this.topicPrefix = opts.topicPrefix;
  }

  async start() {
    await this.waku.start();
    await waitForRemotePeer(this.waku, [Protocols.Store, Protocols.Filter, Protocols.LightPush]);
  }

  async stop() {
    await this.waku.stop();
  }

  async validateMessage(message: ZkitterMessage, proof: Proof): Promise<boolean> {
    const hash = message.hash();

    switch (message.type) {
      case MessageType.Moderation:
        const msg = message as Moderation;
        const { creator } = parseMessageId(msg.payload.reference);
        const isOP = msg.creator === creator;
        if (!isOP) {
          if (
            [
              ModerationMessageSubType.ThreadMention,
              ModerationMessageSubType.ThreadBlock,
              ModerationMessageSubType.ThreadFollow,
              ModerationMessageSubType.Global,
            ].includes(msg.subtype)
          ) {
            return false;
          }
        }
    }

    switch (proof.type) {
      case ProofType.signature:
        const user = await this.users.getUser(message.creator);
        return !!user?.pubkey && verifySignatureP256(user.pubkey, hash, proof.signature);
      case ProofType.rln:
        const { groupId, proof: fullProof } = proof;

        let group = await this.groups
          .getGroupByRoot(fullProof.publicSignals.merkleRoot as string)
          .catch(() => null);

        if (!group && groupId) {
          await this.groups.sync(groupId);
          group = await this.groups
            .getGroupByRoot(fullProof.publicSignals.merkleRoot as string)
            .catch(() => null);
        }

        return verifyRLNProof(hash, group, fullProof);
      default:
        return false;
    }
  }

  async covertMessaegToWakuPayload(message: ZkitterMessage, proof: Proof) {
    return Message.fromUtf8String(
      message.toHex(),
      JSON.stringify(proof),
      message.createdAt
    ).encode();
  }

  async createProof(opts: {
    hash: string;
    address?: string;
    privateKey?: string;
    zkIdentity?: ZkIdentity;
    groupId?: string;
  }): Promise<Proof> {
    const { address, groupId, hash, privateKey, zkIdentity } = opts;
    const identity = zkIdentity;

    if (address && privateKey) {
      const sig = signWithP256(privateKey, hash);
      return {
        signature: sig,
        type: ProofType.signature,
      };
    }

    if (identity) {
      const identityCommitment = identity.genIdentityCommitment();
      const idCommitmentHex = '0x' + identityCommitment.toString(16);
      const merklePath = await this.groups.getMerklePath(idCommitmentHex, groupId);
      const proof = await createRLNProof(hash, identity, merklePath);
      const ecdh = await generateECDHKeyPairFromZKIdentity(identity, hash);

      return {
        ecdh: ecdh.pub,
        groupId: groupId || '',
        proof,
        type: ProofType.rln,
      };
    }

    throw new Error('invalid proof inputs');
  }

  async moderate(options: {
    creator: string;
    reference: string;
    subtype: ModerationMessageSubType;
    privateKey?: string;
    zkIdentity?: ZkIdentity;
    groupId?: string;
  }) {
    const message = new Moderation({
      creator: options.creator,
      payload: {
        reference: options.reference,
      },
      subtype: options.subtype,
      type: MessageType.Moderation,
    });
    const hash = message.hash();
    if (options.privateKey) {
      const sig = signWithP256(options.privateKey, hash);
      await this.publish(message, {
        signature: sig,
        type: ProofType.signature,
      });
    } else if (options.zkIdentity) {
      const zkIdentity = options.zkIdentity;
      const identityCommitment = zkIdentity.genIdentityCommitment();
      const idCommitmentHex = '0x' + identityCommitment.toString(16);
      const merklePath = await this.groups.getMerklePath(idCommitmentHex, options.groupId);
      const proof = await createRLNProof(hash, zkIdentity, merklePath);
      await this.publish(message, {
        groupId: options.groupId || '',
        proof,
        type: ProofType.rln,
      });
    } else {
      throw new Error('no private key or zk identity detected.');
    }
  }

  async write(options: {
    creator: string;
    content: string;
    reference?: string;
    privateKey?: string;
    zkIdentity?: ZkIdentity;
    groupId?: string;
    global?: boolean;
  }) {
    const message = new Post({
      creator: options.creator,
      payload: {
        content: options.content,
        reference: options.reference,
      },
      subtype: options.reference ? PostMessageSubType.Reply : PostMessageSubType.Default,
      type: MessageType.Post,
    });
    const hash = message.hash();
    const { messageId } = message.toJSON();

    if (options.privateKey) {
      const sig = signWithP256(options.privateKey, hash);
      await this.publish(message, {
        signature: sig,
        type: ProofType.signature,
      });
    } else if (options.zkIdentity) {
      const zkIdentity = options.zkIdentity;
      const identityCommitment = zkIdentity.genIdentityCommitment();
      const idCommitmentHex = '0x' + identityCommitment.toString(16);
      const merklePath = await this.groups.getMerklePath(idCommitmentHex, options.groupId);
      const proof = await createRLNProof(hash, zkIdentity, merklePath);
      await this.publish(message, {
        groupId: options.groupId || '',
        proof,
        type: ProofType.rln,
      });
    } else {
      throw new Error('no private key or zk identity detected.');
    }

    if (options.global) {
      await this.moderate({
        creator: options.creator,
        privateKey: options.privateKey,
        reference: messageId,
        subtype: ModerationMessageSubType.Global,
      });
    }
  }

  async publish(message: ZkitterMessage, proof: Proof, force = false) {
    if (force || await this.validateMessage(message, proof)) {
      const payload = await this.covertMessaegToWakuPayload(message, proof);

      if (message.type === MessageType.Chat && message.subtype === ChatMessageSubType.Direct) {
        const { receiverECDH, senderECDH } = (message as Chat).payload;

        await this.waku.lightPush.push(createEncoder(chatTopic(receiverECDH, this.topicPrefix)), {
          payload,
          timestamp: message.createdAt,
        });

        await this.waku.lightPush.push(createEncoder(chatTopic(senderECDH, this.topicPrefix)), {
          payload,
          timestamp: message.createdAt,
        });

        return;
      }

      await this.waku.lightPush.push(createEncoder(globalMessageTopic(this.topicPrefix)), {
        payload,
        timestamp: message.createdAt,
      });

      if (proof.type === ProofType.signature) {
        const creator = message.creator;
        const encoder = createEncoder(userMessageTopic(creator, this.topicPrefix));
        await this.waku.lightPush.push(encoder, {
          payload,
          timestamp: message.createdAt,
        });
      } else if (proof.type === ProofType.rln) {
        const groupId = await this.groups.getGroupByRoot(
          proof.proof.publicSignals.merkleRoot as string
        );
        const encoder = createEncoder(groupMessageTopic(groupId!, this.topicPrefix));
        await this.waku.lightPush.push(encoder, {
          payload,
          timestamp: message.createdAt,
        });
      }

      if (message.type === MessageType.Post) {
        const post = message as Post;
        const hash = post.payload.reference
          ? parseMessageId(post.payload.reference).hash
          : post.hash();
        await this.waku.lightPush.push(createEncoder(threadTopic(hash, this.topicPrefix)), {
          payload,
          timestamp: message.createdAt,
        });
      } else if (message.type === MessageType.Moderation) {
        const mod = message as Moderation;
        if (mod.payload.reference) {
          const { hash } = parseMessageId(mod.payload.reference);
          await this.waku.lightPush.push(createEncoder(threadTopic(hash, this.topicPrefix)), {
            payload,
            timestamp: message.createdAt,
          });
        }
      }

      return;
    }

    throw new Error('invalid message or proof');
  }

  async queryUser(address: string, cb: (message: ZkitterMessage, proof: Proof) => Promise<void>) {
    const decoder = createDecoder(userMessageTopic(address, this.topicPrefix));

    for await (const messagesPromises of this.waku.store.queryGenerator([decoder])) {
      const wakuMessages = await Promise.all(messagesPromises);

      for (const message of wakuMessages.filter(msg => !!msg)) {
        if (message?.payload) {
          const decoded = Message.decode(message.payload);
          const msg = ZkitterMessage.fromHex(decoded.data);
          const proof: Proof = JSON.parse(decoded.proof);
          if (msg && (await this.validateMessage(msg, proof))) {
            await cb(msg, proof);
          }
        }
      }
    }
  }

  async queryThread(hash: string, cb: (message: ZkitterMessage, proof: Proof) => Promise<void>) {
    const decoder = createDecoder(threadTopic(hash, this.topicPrefix));

    for await (const messagesPromises of this.waku.store.queryGenerator([decoder])) {
      const wakuMessages = await Promise.all(messagesPromises);

      for (const message of wakuMessages.filter(msg => !!msg)) {
        if (message?.payload) {
          const decoded = Message.decode(message.payload);
          1;
          const msg = ZkitterMessage.fromHex(decoded.data);
          const proof: Proof = JSON.parse(decoded.proof);
          if (msg && (await this.validateMessage(msg, proof))) {
            await cb(msg, proof);
          }
        }
      }
    }
  }

  async queryGroup(groupId: string, cb: (message: ZkitterMessage, proof: Proof) => Promise<void>) {
    const decoder = createDecoder(groupMessageTopic(groupId, this.topicPrefix));

    for await (const messagesPromises of this.waku.store.queryGenerator([decoder])) {
      const wakuMessages = await Promise.all(messagesPromises);

      for (const message of wakuMessages.filter(msg => !!msg)) {
        if (message?.payload) {
          const decoded = Message.decode(message.payload);
          1;
          const msg = ZkitterMessage.fromHex(decoded.data);
          const proof: Proof = JSON.parse(decoded.proof);
          if (msg && (await this.validateMessage(msg, proof))) {
            await cb(msg, proof);
          }
        }
      }
    }
  }

  async queryAll(cb: (message: ZkitterMessage, proof: Proof) => Promise<void>) {
    const decoder = createDecoder(globalMessageTopic(this.topicPrefix));

    for await (const messagesPromises of this.waku.store.queryGenerator([decoder])) {
      const wakuMessages = await Promise.all(messagesPromises);

      for (const message of wakuMessages.filter(msg => !!msg)) {
        if (message?.payload) {
          const decoded = Message.decode(message.payload);
          1;
          const msg = ZkitterMessage.fromHex(decoded.data);
          const proof: Proof = JSON.parse(decoded.proof);
          if (msg && (await this.validateMessage(msg, proof))) {
            await cb(msg, proof);
          }
        }
      }
    }
  }

  async query(filter: Filter, cb: (message: ZkitterMessage, proof: Proof) => Promise<void>) {
    const topics = filter.topics;
    const decoders = topics.map(createDecoder);

    if (!decoders.length) return;

    for await (const messagesPromises of this.waku.store.queryGenerator(decoders)) {
      const wakuMessages = await Promise.all(messagesPromises);

      for (const message of wakuMessages.filter(msg => !!msg)) {
        if (message?.payload) {
          const decoded = Message.decode(message.payload);
          const msg = ZkitterMessage.fromHex(decoded.data);
          const proof: Proof = JSON.parse(decoded.proof);
          if (msg && (await this.validateMessage(msg, proof))) {
            await cb(msg, proof);
          }
        }
      }
    }
  }

  async subscribe(filter: Filter, cb: (message: ZkitterMessage, proof: Proof) => Promise<void>) {
    const topics = filter.topics;
    const decoders = topics.map(createDecoder);

    return this.waku.filter.subscribe(decoders, async wakuMessage => {
      const decoded = Message.decode(wakuMessage.payload!);
      const msg = ZkitterMessage.fromHex(decoded.data);
      const proof: Proof = JSON.parse(decoded.proof);
      if (msg && (await this.validateMessage(msg, proof))) {
        await cb(msg, proof);
      }
    });
  }
}
