import {GenericService} from "../utils/svc";
import {createLightNode} from "@waku/create";
import {LightNode, Protocols} from "@waku/interfaces";
import {createDecoder, createEncoder, waitForRemotePeer} from "@waku/core";
import {
  Message as ZkitterMessage,
  MessageType,
  Moderation,
  ModerationMessageSubType,
  parseMessageId,
  Post,
  PostMessageSubType
} from "../utils/message";
import {Message} from "../models/message";
import {Proof, ProofType} from "../models/proof";
import {UserService} from "./users";
import {signWithP256, verifySignatureP256} from "../utils/crypto";
import {ConstructorOptions} from "eventemitter2";
import {ZkIdentity} from "@zk-kit/identity";
import {GroupService} from "./groups";
import {createRLNProof, verifyRLNProof} from "../utils/zk";

const WakuFormatVersion = '0.0.9';

export class PubsubService extends GenericService {
  waku: LightNode;

  users: UserService;

  groups: GroupService;

  static async initialize(users: UserService, groups: GroupService, lazy?: boolean) {
    const waku = await createLightNode({ defaultBootstrap: true });
    if (!lazy) {
      await waku.start();
      await waitForRemotePeer(waku, [
        Protocols.Store,
        Protocols.Filter,
        Protocols.LightPush,
      ]);
    }
    return new PubsubService({ waku, users, groups });
  }

  constructor(opts: ConstructorOptions & {
    waku: LightNode,
    users: UserService,
    groups: GroupService,
  }) {
    super(opts);
    this.waku = opts.waku;
    this.users = opts.users;
    this.groups = opts.groups;
  }

  async start() {
    await this.waku.start();
    await waitForRemotePeer(this.waku, [
      Protocols.Store,
      Protocols.Filter,
      Protocols.LightPush,
    ]);
  }

  async stop() {
    await this.waku.stop();
  }

  async validateMessage(message: ZkitterMessage, proof: Proof): Promise<boolean> {
    const hash = message.hash();

    switch (message.type) {
      case MessageType.Moderation:
        const msg = message as Moderation;
        const isOP = msg.creator === msg.payload.reference;
        if (!isOP) {
          if ([
            ModerationMessageSubType.ThreadMention,
            ModerationMessageSubType.ThreadBlock,
            ModerationMessageSubType.ThreadFollow,
            ModerationMessageSubType.Global,
          ].includes(msg.subtype)) {
            return false;
          }
        }
    }

    switch (proof.type) {
      case ProofType.signature:
        const user = await this.users.getUser(message.creator);
        return !!user?.pubkey && verifySignatureP256(user.pubkey, hash, proof.signature);
      case ProofType.rln:
        const {proof: fullProof} = proof;
        const group = await this.groups.getGroupByRoot(fullProof.publicSignals.merkleRoot as string);
        return verifyRLNProof(hash, group, fullProof);
    }

    return false;
  }

  async covertMessaegToWakuPayload(message: ZkitterMessage, proof: Proof) {
    return Message
      .fromUtf8String(
        message.toHex(),
        JSON.stringify(proof),
        message.createdAt,
      )
      .encode();
  }

  async moderate(options: {
    creator: string;
    reference: string;
    subtype: ModerationMessageSubType;
    privateKey?: string,
    zkIdentity?: ZkIdentity,
    groupId?: string;
  }) {
    const message = new Moderation({
      type: MessageType.Moderation,
      subtype: options.subtype,
      creator: options.creator,
      payload: {
        reference: options.reference,
      },
    });
    const hash = message.hash();
    if (options.privateKey) {
      const sig = signWithP256(options.privateKey, hash);
      await this.publish(message, {signature: sig, type: ProofType.signature});
    } else if (options.zkIdentity) {
      const zkIdentity = options.zkIdentity;
      const identityCommitment = zkIdentity.genIdentityCommitment();
      const idCommitmentHex = '0x' + identityCommitment.toString(16);
      const merklePath = await this.groups.getMerklePath(idCommitmentHex, options.groupId);
      const proof = await createRLNProof(hash, zkIdentity, merklePath);
      await this.publish(message, {proof, type: ProofType.rln});
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
      type: MessageType.Post,
      subtype: options.reference ? PostMessageSubType.Reply : PostMessageSubType.Default,
      creator: options.creator,
      payload: {
        reference: options.reference,
        content: options.content,
      },
    });
    const hash = message.hash();
    const {messageId} = message.toJSON();

    if (options.privateKey) {
      const sig = signWithP256(options.privateKey, hash);
      await this.publish(message, {signature: sig, type: ProofType.signature});
    } else if (options.zkIdentity) {
      const zkIdentity = options.zkIdentity;
      const identityCommitment = zkIdentity.genIdentityCommitment();
      const idCommitmentHex = '0x' + identityCommitment.toString(16);
      const merklePath = await this.groups.getMerklePath(idCommitmentHex, options.groupId);
      const proof = await createRLNProof(hash, zkIdentity, merklePath);
      await this.publish(message, {proof, type: ProofType.rln});
    } else {
      throw new Error('no private key or zk identity detected.');
    }

    if (options.global) {
      await this.moderate({
        creator: options.creator,
        subtype: ModerationMessageSubType.Global,
        reference: messageId,
        privateKey: options.privateKey,
      });
    }
  }

  async publish(message: ZkitterMessage, proof: Proof) {
    if (await this.validateMessage(message, proof)) {
      const payload = await this.covertMessaegToWakuPayload(message, proof);

      await this.waku.lightPush.push(createEncoder(globalMessageTopic()), {
        timestamp: message.createdAt,
        payload,
      });

      if (proof.type === ProofType.signature) {
        const creator = message.creator;
        const encoder = createEncoder(userMessageTopic(creator));
        await this.waku.lightPush.push(encoder, {
          timestamp: message.createdAt,
          payload,
        });
      } else if (proof.type === ProofType.rln) {
        const groupId = await this.groups.getGroupByRoot(proof.proof.publicSignals.merkleRoot as string);
        const encoder = createEncoder(groupMessageTopic(groupId!));
        await this.waku.lightPush.push(encoder, {
          timestamp: message.createdAt,
          payload,
        });
      }

      if (message.type === MessageType.Post) {
        const post = message as Post;
        if (post.payload.reference) {
          const {hash} = parseMessageId(post.payload.reference);
          await this.waku.lightPush.push(createEncoder(threadTopic(hash)), {
            timestamp: message.createdAt,
            payload,
          });
        }
      }

      return;
    }

    throw new Error('invalid message or proof');
  }

  async queryUser(address: string, cb: (message: ZkitterMessage, proof: Proof) => Promise<void>) {
    const decoder = createDecoder(userMessageTopic(address));

    for await (const messagesPromises of this.waku.store.queryGenerator(
      [decoder],
    )) {
      const wakuMessages = await Promise.all(messagesPromises);

      for (let message of wakuMessages.filter(msg => !!msg)) {
        if (message?.payload) {
          const decoded = Message.decode(message.payload);1
          const msg = ZkitterMessage.fromHex(decoded.data);
          const proof: Proof = JSON.parse(decoded.proof);
          if (msg && await this.validateMessage(msg, proof)) {
            await cb(msg, proof);
          }
        }
      }
    }
  }

  async queryGroup(groupId: string, cb: (message: ZkitterMessage, proof: Proof) => Promise<void>) {
    const decoder = createDecoder(groupMessageTopic(groupId));

    for await (const messagesPromises of this.waku.store.queryGenerator(
      [decoder],
    )) {
      const wakuMessages = await Promise.all(messagesPromises);

      for (let message of wakuMessages.filter(msg => !!msg)) {
        if (message?.payload) {
          const decoded = Message.decode(message.payload);1
          const msg = ZkitterMessage.fromHex(decoded.data);
          const proof: Proof = JSON.parse(decoded.proof);
          if (msg && await this.validateMessage(msg, proof)) {
            await cb(msg, proof);
          }
        }
      }
    }
  }

  async queryAll(cb: (message: ZkitterMessage, proof: Proof) => Promise<void>) {
    const decoder = createDecoder(globalMessageTopic());

    for await (const messagesPromises of this.waku.store.queryGenerator(
      [decoder],
    )) {
      const wakuMessages = await Promise.all(messagesPromises);

      for (let message of wakuMessages.filter(msg => !!msg)) {
        if (message?.payload) {
          const decoded = Message.decode(message.payload);1
          const msg = ZkitterMessage.fromHex(decoded.data);
          const proof: Proof = JSON.parse(decoded.proof);
          if (msg && await this.validateMessage(msg, proof)) {
            await cb(msg, proof);
          }
        }
      }
    }
  }

  async subscribeUser(address: string, cb: (message: ZkitterMessage, proof: Proof) => Promise<void>) {
    const decoder = createDecoder(userMessageTopic(address));
    this.waku.filter.subscribe([decoder], async wakuMessage => {
      const decoded = Message.decode(wakuMessage.payload!);
      const msg = ZkitterMessage.fromHex(decoded.data);
      const proof: Proof = JSON.parse(decoded.proof);
      if (msg && await this.validateMessage(msg, proof)) {
        await cb(msg, proof);
      }
    });
  }

  async subscribeUsers(addresses: string[], cb: (message: ZkitterMessage, proof: Proof) => Promise<void>) {
    this.waku.filter.subscribe(addresses.map(addy => createDecoder(userMessageTopic(addy))), async wakuMessage => {
      const decoded = Message.decode(wakuMessage.payload!);
      const msg = ZkitterMessage.fromHex(decoded.data);
      const proof: Proof = JSON.parse(decoded.proof);
      if (msg && await this.validateMessage(msg, proof)) {
        await cb(msg, proof);
      }
    });
  }

  async subscribeAll(cb: (message: ZkitterMessage, proof: Proof) => Promise<void>) {
    const decoder = createDecoder(globalMessageTopic());
    this.waku.filter.subscribe([decoder], async wakuMessage => {
      const decoded = Message.decode(wakuMessage.payload!);
      const msg = ZkitterMessage.fromHex(decoded.data);
      const proof: Proof = JSON.parse(decoded.proof);
      if (msg && await this.validateMessage(msg, proof)) {
        await cb(msg, proof);
      }
    });
  }

  async subscribeThread(hash: string, cb: (message: ZkitterMessage, proof: Proof) => Promise<void>) {
    const decoder = createDecoder(threadTopic(hash));
    this.waku.filter.subscribe([decoder], async wakuMessage => {
      const decoded = Message.decode(wakuMessage.payload!);
      const msg = ZkitterMessage.fromHex(decoded.data);
      const proof: Proof = JSON.parse(decoded.proof);
      if (msg && await this.validateMessage(msg, proof)) {
        await cb(msg, proof);
      }
    });
  }

  async subscribeThreads(hashes: string[], cb: (message: ZkitterMessage, proof: Proof) => Promise<void>) {
    this.waku.filter.subscribe(hashes.map(hash => createDecoder(threadTopic(hash))), async wakuMessage => {
      const decoded = Message.decode(wakuMessage.payload!);
      const msg = ZkitterMessage.fromHex(decoded.data);
      const proof: Proof = JSON.parse(decoded.proof);
      if (msg && await this.validateMessage(msg, proof)) {
        await cb(msg, proof);
      }
    });
  }
}

function userMessageTopic(address: string): string {
  return [
    process.env.NODE_ENV === 'production' ? 'zkitter' : 'zkitterdev',
    WakuFormatVersion,
    'um_' + address,
    'proto',
  ].join('/')
}

function groupMessageTopic(groupId: string): string {
  return [
    process.env.NODE_ENV === 'production' ? 'zkitter' : 'zkitterdev',
    WakuFormatVersion,
    'gm_' + groupId,
    'proto',
  ].join('/')
}

function threadTopic(hash: string): string {
  return [
    process.env.NODE_ENV === 'production' ? 'zkitter' : 'zkitterdev',
    WakuFormatVersion,
    'thread_' + hash,
    'proto',
  ].join('/')
}

function globalMessageTopic(): string {
  return [
    process.env.NODE_ENV === 'production' ? 'zkitter' : 'zkitterdev',
    WakuFormatVersion,
    'all_messages',
    'proto',
  ].join('/')
}