import tape from 'tape';
import * as path from 'path';
import * as fs from 'fs';
import { LevelDBAdapter } from '../adapters/leveldb';
import { DataService } from './db';
import {
  Chat,
  ChatMessageSubType,
  Connection,
  ConnectionMessageSubType,
  MessageType,
  Moderation,
  ModerationMessageSubType,
  Post,
  PostMessageSubType,
  Profile,
  ProfileMessageSubType,
  Revert,
} from '../utils/message';
import { ProofType, RLNProof, SignatureProof } from '../models/proof';

tape('LevelDB Adapter', async t => {
  const cwd = process.cwd();
  const dbPath = path.join(cwd, 'zkitter_test');
  const udbPath = path.join(cwd, 'zkitter_test_user');
  const ldb = await LevelDBAdapter.initialize(dbPath, udbPath);
  const db = new DataService({ db: ldb });

  // Initialize DB with posts
  const opA = makePost('hello earth');
  const opB = makePost('hello moon', 'userB');
  const { messageId: messageIdA, hash: hashA } = opA.toJSON();
  const { messageId: messageIdB, hash: hashB } = opB.toJSON();

  await db.insertMessage(opA, mockUserProof('a'));
  await db.insertMessage(opB, mockUserProof('b'));

  await db.insertMessage(makeReply(messageIdA, 'reply to earth 1', 'userC'), mockUserProof());

  const replyFromUserB = makeReply(messageIdA, 'reply to earth 2', 'userB');
  await db.insertMessage(replyFromUserB, mockUserProof());

  await db.insertMessage(makeReply(messageIdB, 'reply to moon 1', 'userA'), mockUserProof());

  const repostFromUserB = makeRepost(messageIdB, 'userB');
  await db.insertMessage(repostFromUserB, mockUserProof());

  // Initialize DB with moderations
  await db.insertMessage(
    makeModeration(messageIdA, ModerationMessageSubType.Global, 'userB'),
    mockUserProof()
  );
  await db.insertMessage(
    makeModeration(messageIdA, ModerationMessageSubType.ThreadFollow, 'userA'),
    mockUserProof()
  );
  await db.insertMessage(
    makeModeration(messageIdA, ModerationMessageSubType.ThreadMention, 'userA'),
    mockUserProof()
  );
  await db.insertMessage(
    makeModeration(messageIdA, ModerationMessageSubType.ThreadBlock, 'userB'),
    mockUserProof()
  );
  await db.insertMessage(
    makeModeration(messageIdA, ModerationMessageSubType.Like, 'userA'),
    mockUserProof()
  );
  await db.insertMessage(
    makeModeration(messageIdA, ModerationMessageSubType.Like, 'userB'),
    mockUserProof()
  );
  await db.insertMessage(
    makeModeration(messageIdA, ModerationMessageSubType.Like, 'userB'),
    mockUserProof()
  );
  await db.insertMessage(
    makeModeration(messageIdA, ModerationMessageSubType.Like, 'userB'),
    mockUserProof()
  );
  await db.insertMessage(
    makeModeration(messageIdA, ModerationMessageSubType.Like, 'userC'),
    mockUserProof()
  );
  await db.insertMessage(
    makeModeration(messageIdA, ModerationMessageSubType.Like, 'userD'),
    mockUserProof()
  );
  await db.insertMessage(
    makeModeration(messageIdA, ModerationMessageSubType.Block, 'userD'),
    mockUserProof()
  );
  await db.insertMessage(
    makeModeration(messageIdA, ModerationMessageSubType.Block, 'userD'),
    mockUserProof()
  );

  // Initialize DB with connections
  await db.insertMessage(
    makeConnection('userA', ConnectionMessageSubType.Follow, 'userA'),
    mockUserProof()
  );
  await db.insertMessage(
    makeConnection('userA', ConnectionMessageSubType.Follow, 'userA'),
    mockUserProof()
  );
  await db.insertMessage(
    makeConnection('userA', ConnectionMessageSubType.Follow, 'userB'),
    mockUserProof()
  );
  await db.insertMessage(
    makeConnection('userA', ConnectionMessageSubType.Follow, 'userC'),
    mockUserProof()
  );
  await db.insertMessage(
    makeConnection('userA', ConnectionMessageSubType.Follow, 'userD'),
    mockUserProof()
  );
  await db.insertMessage(
    makeConnection('userA', ConnectionMessageSubType.Follow, 'userD'),
    mockUserProof()
  );
  await db.insertMessage(
    makeConnection('userA', ConnectionMessageSubType.Follow, 'userE'),
    mockUserProof()
  );
  await db.insertMessage(
    makeConnection('userA', ConnectionMessageSubType.Block, 'userE'),
    mockUserProof()
  );
  await db.insertMessage(
    makeConnection('userA', ConnectionMessageSubType.Block, 'userE'),
    mockUserProof()
  );
  await db.insertMessage(
    makeConnection('userA', ConnectionMessageSubType.MemberInvite, 'userE'),
    mockUserProof()
  );
  await db.insertMessage(
    makeConnection('userE', ConnectionMessageSubType.MemberAccept, 'userA'),
    mockUserProof()
  );

  // Initialize DB with profile messages
  await db.insertMessage(makeProfile('developer', ProfileMessageSubType.Name), mockUserProof());
  await db.insertMessage(makeProfile('developer2', ProfileMessageSubType.Name), mockUserProof());
  await db.insertMessage(makeProfile('bio', ProfileMessageSubType.Bio), mockUserProof());
  await db.insertMessage(
    makeProfile('profile.image', ProfileMessageSubType.ProfileImage),
    mockUserProof()
  );
  await db.insertMessage(
    makeProfile('cover.image', ProfileMessageSubType.CoverImage),
    mockUserProof()
  );
  await db.insertMessage(
    makeProfile('tv', ProfileMessageSubType.TwitterVerification),
    mockUserProof()
  );
  await db.insertMessage(
    makeProfile('website.url', ProfileMessageSubType.Website),
    mockUserProof()
  );
  const groupMsg = makeProfile('', ProfileMessageSubType.Group);
  await db.insertMessage(groupMsg, mockUserProof());
  await db.insertMessage(
    makeProfile('idcommitment', ProfileMessageSubType.Custom, 'id_commitment'),
    mockUserProof()
  );
  await db.insertMessage(
    makeProfile('0x00', ProfileMessageSubType.Custom, 'ecdh_pubkey', 'userA'),
    mockUserProof()
  );
  await db.insertMessage(
    makeProfile('0x01', ProfileMessageSubType.Custom, 'ecdh_pubkey', 'userA'),
    mockUserProof()
  );
  await db.insertMessage(
    makeProfile('0x03', ProfileMessageSubType.Custom, 'ecdh_pubkey', 'userC'),
    mockUserProof()
  );

  // Initialize DB with Chat messages
  await db.insertMessage(
    makeChat('hi 0x02 from 0x01!', ChatMessageSubType.Direct, '0x01', '0x02', undefined, 'userA'),
    mockUserProof()
  );

  await db.insertMessage(
    makeChat('hi 0x03 from 0x01!', ChatMessageSubType.Direct, '0x01', '0x03', undefined, 'userA'),
    mockUserProof()
  );

  await db.insertMessage(
    makeChat('hi 0x02 from 0x01a!', ChatMessageSubType.Direct, '0x01a', '0x02', undefined, 'userA'),
    mockUserProof()
  );

  await db.insertMessage(
    makeChat('hi 0x01 from 0x02!', ChatMessageSubType.Direct, '0x02', '0x01', undefined, 'userB'),
    mockUserProof()
  );

  await db.insertMessage(
    makeChat('hi 0x03 from 0x02!', ChatMessageSubType.Direct, '0x02', '0x03', undefined, 'userB'),
    mockUserProof()
  );

  t.test('messages and proof', async test => {
    const msgA = await ldb.getMessage(hashA);
    const proofA = await ldb.getProof(hashA);

    test.deepEqual(msgA?.toJSON(), opA.toJSON(), 'it should update message');
    test.deepEqual(proofA, mockUserProof('a'), 'it should update proof');
    test.end();
  });

  t.test('insert posts', async postTest => {
    postTest.test('postlists', async test => {
      const posts = await ldb.getPosts();
      test.assert(posts.length === 3, 'it should insert 3 posts to postlist');
      test.equal(posts[0].subtype, 'REPOST', 'first post should be a repost');
      test.equal(posts[0].payload.reference, messageIdB, 'first post should reference messageId-B');
      test.equal(posts[1].toJSON().messageId, messageIdB, 'second post should be messageId-B');
      test.equal(posts[2].toJSON().messageId, messageIdA, 'second post should be messageId-A');
      test.end();
    });

    postTest.test('userposts', async test => {
      const uaPosts = await ldb.getUserPosts('userA');
      const ubPosts = await ldb.getUserPosts('userB');
      const ucPosts = await ldb.getUserPosts('userC');

      test.equal(uaPosts.length, 1, 'userA should have 1 post');
      test.assert(
        uaPosts.reduce((res, p) => res && p.creator === 'userA', true),
        'creator should be userA'
      );

      test.equal(ubPosts.length, 2, 'userB should have 2 posts');
      test.assert(
        ubPosts.reduce((res, p) => res && p.creator === 'userB', true),
        'creator should be userB'
      );

      test.equal(ucPosts.length, 0, 'userC should have 0 posts');
      test.end();
    });

    postTest.test('threads', async test => {
      const threadA = await ldb.getReplies(hashA);

      test.equal(threadA.length, 2, 'threadA should have 2 replies');
      test.assert(
        threadA.reduce((res, p) => res && p.subtype === 'REPLY', true),
        'subtype should be REPLY'
      );
      test.equal(threadA[0].payload.content, 'reply to earth 2', 'assert content of first reply');
      test.equal(threadA[1].payload.content, 'reply to earth 1', 'assert content of second reply');
      test.end();
    });

    postTest.test('postmeta', async test => {
      const postAMeta = await ldb.getPostMeta(hashA);
      const postBMeta = await ldb.getPostMeta(hashB);

      test.equal(postAMeta.reply, 2, 'post A should have 2 replies');
      test.equal(postBMeta.reply, 1, 'post A should have 1 reply');
      test.equal(postBMeta.repost, 1, 'post A should have 1 repost');
      test.end();
    });

    postTest.end();
  });

  t.test('insert moderation', async modTest => {
    const postMetaA = await ldb.getPostMeta(hashA);

    modTest.equal(postMetaA.block, 1, 'only 1 block per thread per creator');
    modTest.equal(postMetaA.like, 4, 'only 1 like per thread per creator');
    modTest.equal(postMetaA.global, false, 'only creator can update global visibility');
    modTest.equal(
      postMetaA.moderation,
      'THREAD_ONLY_MENTION',
      'only creator can update moderation'
    );

    await db.insertMessage(
      makeModeration(messageIdA, ModerationMessageSubType.Global, 'userA'),
      mockUserProof()
    );
    const adjMetaA = await ldb.getPostMeta(hashA);
    modTest.equal(adjMetaA.global, true, 'only creator can update global visibility');

    const amods = await ldb.getModerations(hashA);
    const bmods = await ldb.getModerations(hashB);

    modTest.equal(amods.length, 10, 'it should have 10 moderations on thread A');
    modTest.equal(bmods.length, 0, 'it should have 0 moderations on thread A');
    modTest.assert(
      amods.reduce((res, m) => res && m.type === 'MODERATION', true),
      'only return moderations'
    );

    modTest.end();
  });

  t.test('insert connection', async test => {
    const userMetaA = await ldb.getUserMeta('userA');
    const userMetaB = await ldb.getUserMeta('userB');
    const userMetaD = await ldb.getUserMeta('userD');
    const userMetaE = await ldb.getUserMeta('userE');

    test.equal(userMetaA.blockers, 1, 'only 1 block per user (include self)');
    test.equal(userMetaA.blocking, 0, 'only 1 block per user (include self)');
    test.equal(userMetaA.followers, 5, 'only 1 follow per user (include self)');
    test.equal(userMetaA.following, 1, 'only 1 follow per user (include self)');

    test.equal(userMetaB.blockers, 0, 'only 1 block per user (include self)');
    test.equal(userMetaB.blocking, 0, 'only 1 block per user (include self)');
    test.equal(userMetaB.followers, 0, 'only 1 follow per user (include self)');
    test.equal(userMetaB.following, 1, 'only 1 follow per user (include self)');

    test.equal(userMetaD.blockers, 0, 'only 1 block per user (include self)');
    test.equal(userMetaD.blocking, 0, 'only 1 block per user (include self)');
    test.equal(userMetaD.followers, 0, 'only 1 follow per user (include self)');
    test.equal(userMetaD.following, 1, 'only 1 follow per user (include self)');

    test.equal(userMetaE.blockers, 0, 'only 1 block per user (include self)');
    test.equal(userMetaE.blocking, 1, 'only 1 block per user (include self)');
    test.equal(userMetaE.followers, 0, 'only 1 follow per user (include self)');
    test.equal(userMetaE.following, 1, 'only 1 follow per user (include self)');

    const aconns = await ldb.getConnections('userA');
    const econns = await ldb.getConnections('userE');

    test.equal(aconns.length, 7, 'userA should have 7 incoming connections');
    test.assert(
      aconns.reduce((res, c) => res && c.type === 'CONNECTION', true),
      'only return connections'
    );

    test.equal(econns.length, 1, 'userE should have 1 incoming connections');
    test.equal(econns[0].subtype, 'MEMBER_ACCEPT', 'userE should have an incoming MEMBER_ACCEPT');
    test.equal(
      econns[0].creator,
      'userA',
      'userE should have an incoming MEMBER_ACCEPT from userA'
    );

    test.end();
  });

  t.test('insert profile', async test => {
    const userMetaA = await ldb.getUserMeta('userA');

    test.equal(await ldb.getUserByECDH('0x01'), 'userA', 'it should index user by ECDH');
    test.deepEqual(
      userMetaA,
      {
        bio: 'bio',
        blockers: 1,
        blocking: 0,
        coverImage: 'cover.image',
        ecdh: '0x01',
        followers: 5,
        following: 1,
        group: groupMsg.hash(),
        idCommitment: 'idcommitment',
        nickname: 'developer2',
        posts: 1,
        profileImage: 'profile.image',
        twitterVerification: 'tv',
        website: 'website.url',
      },
      'it should insert correct userMeta'
    );
    test.end();
  });

  t.test('insert chat', async test => {
    test.deepEqual(
      await ldb.getChatECDHByUser('userA'),
      ['0x01', '0x01a'],
      'userA should have 2 ecdh'
    );
    test.deepEqual(await ldb.getChatECDHByUser('userB'), ['0x02'], 'userB should have 1 ecdh');
    test.deepEqual(await ldb.getChatECDHByUser('userC'), ['0x03'], 'userC should have 1 ecdh');

    test.deepEqual(
      await ldb.getChatByECDH('0x01'),
      [
        {
          chatId: '7748fb43860ff96468d67c38e2aeeea57fb6524f6a08fd7dce060f451ded74fb',
          receiverECDH: '0x03',
          senderECDH: '0x01',
          senderSeed: 'sender_seed',
          type: 'DIRECT',
        },
        {
          chatId: 'f601b31d49b3a7a6ca76a26896912e737532c3cfce522e10919742363cc52ccf',
          receiverECDH: '0x02',
          senderECDH: '0x01',
          senderSeed: 'sender_seed',
          type: 'DIRECT',
        },
      ],
      'it should return 2 chats for 0x01'
    );
    test.deepEqual(
      await ldb.getChatByECDH('0x01a'),
      [
        {
          chatId: '9dc674422a4bc3e9e6661d3b1fa6804031318c3f1ae7d907dd04ce9d77d79876',
          receiverECDH: '0x02',
          senderECDH: '0x01a',
          senderSeed: 'sender_seed',
          type: 'DIRECT',
        },
      ],
      'it should return 1 chat for 0x01s'
    );
    test.deepEqual(
      await ldb.getChatByECDH('0x02'),
      [
        {
          chatId: '9dc674422a4bc3e9e6661d3b1fa6804031318c3f1ae7d907dd04ce9d77d79876',
          receiverECDH: '0x02',
          senderECDH: '0x01a',
          senderSeed: 'sender_seed',
          type: 'DIRECT',
        },
        {
          chatId: 'e5adc7a51ab9a89717889d2268c60d9088c98ff7d966765edcd90a442c6ca035',
          receiverECDH: '0x03',
          senderECDH: '0x02',
          senderSeed: 'sender_seed',
          type: 'DIRECT',
        },
        {
          chatId: 'f601b31d49b3a7a6ca76a26896912e737532c3cfce522e10919742363cc52ccf',
          receiverECDH: '0x02',
          senderECDH: '0x01',
          senderSeed: 'sender_seed',
          type: 'DIRECT',
        },
      ],
      'it should return 3 chats for 0x02'
    );
    test.deepEqual(
      await ldb.getChatByECDH('0x03'),
      [
        {
          chatId: '7748fb43860ff96468d67c38e2aeeea57fb6524f6a08fd7dce060f451ded74fb',
          receiverECDH: '0x03',
          senderECDH: '0x01',
          senderSeed: 'sender_seed',
          type: 'DIRECT',
        },
        {
          chatId: 'e5adc7a51ab9a89717889d2268c60d9088c98ff7d966765edcd90a442c6ca035',
          receiverECDH: '0x03',
          senderECDH: '0x02',
          senderSeed: 'sender_seed',
          type: 'DIRECT',
        },
      ],
      'it should return 2 chats for 0x03'
    );

    const msgs0x020x01 = await ldb.getChatMessages(
      'f601b31d49b3a7a6ca76a26896912e737532c3cfce522e10919742363cc52ccf'
    );
    test.equal(
      msgs0x020x01[0].payload.encryptedContent,
      'hi 0x01 from 0x02!',
      'it should return correct first message'
    );
    test.equal(
      msgs0x020x01[1].payload.encryptedContent,
      'hi 0x02 from 0x01!',
      'it should return correct second message'
    );

    test.assert(
      await ldb.getChatMeta(
        '0x02',
        'f601b31d49b3a7a6ca76a26896912e737532c3cfce522e10919742363cc52ccf'
      )
    );
    test.deepEqual(
      await ldb.getChatMeta(
        '0x02',
        'f601b31d49b3a7a6ca76a26896912e737532c3cfce522e10919742363cc52ccf'
      ),
      await ldb.getChatMeta(
        '0x01',
        'f601b31d49b3a7a6ca76a26896912e737532c3cfce522e10919742363cc52ccf'
      ),
      'it should return correct chat meta for f601b3'
    );

    test.equal(
      (
        await ldb.getChatMessages(
          'e5adc7a51ab9a89717889d2268c60d9088c98ff7d966765edcd90a442c6ca035'
        )
      ).length,
      1,
      'e5adc7 should have 1 messages'
    );
    test.equal(
      (
        await ldb.getChatMessages(
          'e5adc7a51ab9a89717889d2268c60d9088c98ff7d966765edcd90a442c6ca035'
        )
      )[0].payload.encryptedContent,
      'hi 0x03 from 0x02!',
      'e5adc7 should read correct content'
    );

    test.equal(
      (
        await ldb.getChatMessages(
          '9dc674422a4bc3e9e6661d3b1fa6804031318c3f1ae7d907dd04ce9d77d79876'
        )
      ).length,
      1,
      '9dc674 should have 1 messages'
    );
    test.equal(
      (
        await ldb.getChatMessages(
          '9dc674422a4bc3e9e6661d3b1fa6804031318c3f1ae7d907dd04ce9d77d79876'
        )
      )[0].payload.encryptedContent,
      'hi 0x02 from 0x01a!',
      '9dc674 should read correct content'
    );

    test.end();
  });

  t.test('revert message', async test => {
    console.log(await ldb.getPostMeta(hashB));
    console.log(await ldb.getReplies(hashA));
    await db.insertMessage(makeRevert(messageIdA), mockUserProof());
    await db.insertMessage(makeRevert(replyFromUserB.toJSON().messageId, 'userB'), mockUserProof());
    await db.insertMessage(
      makeRevert(repostFromUserB.toJSON().messageId, 'userB'),
      mockUserProof()
    );

    test.equal((await ldb.getUserMeta('userA')).posts, 0, 'it should decrement post counts');
    test.equal((await ldb.getUserPosts('userA')).length, 0, 'it should remove from user posts');
    test.equal((await ldb.getPosts()).length, 1, 'it should remove from postlist');
    test.equal(
      (await ldb.getPosts())[0].payload.content,
      'hello moon',
      'it should remove the correct messages'
    );

    test.equal((await ldb.getPostMeta(hashB)).repost, 0, 'it should decrement repost counts');
    test.equal((await ldb.getReplies(hashA)).length, 1, 'it should remove from thread');
    test.equal(
      (await ldb.getReplies(hashA))[0].payload.content,
      'reply to earth 1',
      'it should remove correct message from thread'
    );
    test.end();
  });

  t.teardown(async () => {
    await fs.promises.rm(dbPath, { recursive: true, force: true });
    await fs.promises.rm(udbPath, { recursive: true, force: true });
  });

  t.end();
});

function makePost(content: string, creator = 'userA'): Post {
  return new Post({
    type: MessageType.Post,
    subtype: PostMessageSubType.Default,
    creator,
    payload: {
      content,
    },
  });
}

function makeReply(reference: string, content: string, creator = 'userA'): Post {
  return new Post({
    type: MessageType.Post,
    subtype: PostMessageSubType.Reply,
    creator,
    payload: {
      content,
      reference,
    },
  });
}

function makeRepost(reference: string, creator = 'userA'): Post {
  return new Post({
    type: MessageType.Post,
    subtype: PostMessageSubType.Repost,
    creator,
    payload: {
      reference,
    },
  });
}

function makeModeration(
  reference: string,
  subtype = ModerationMessageSubType.Default,
  creator = 'userA'
): Moderation {
  return new Moderation({
    type: MessageType.Moderation,
    subtype: subtype,
    creator,
    payload: {
      reference,
    },
  });
}

function makeRevert(reference: string, creator = 'userA'): Revert {
  return new Revert({
    type: MessageType.Revert,
    creator,
    payload: {
      reference,
    },
  });
}

function makeConnection(
  name: string,
  subtype = ConnectionMessageSubType.Default,
  creator = 'userA'
): Connection {
  return new Connection({
    type: MessageType.Connection,
    subtype: subtype,
    creator,
    payload: {
      name,
    },
  });
}

function makeProfile(
  value: string,
  subtype = ProfileMessageSubType.Default,
  key?: string,
  creator = 'userA'
): Profile {
  return new Profile({
    type: MessageType.Profile,
    subtype: subtype,
    creator,
    payload: {
      key,
      value,
    },
  });
}

function makeChat(
  encryptedContent: string,
  subtype = ChatMessageSubType.Direct,
  senderECDH = 'sender_ecdh_a',
  receiverECDH = 'receiver_ecdh_a',
  senderSeed = 'sender_seed',
  creator = 'userA'
): Chat {
  return new Chat({
    type: MessageType.Chat,
    subtype: subtype,
    creator,
    payload: {
      encryptedContent,
      senderECDH,
      receiverECDH,
      senderSeed,
    },
  });
}

function mockUserProof(signature = ''): SignatureProof {
  return {
    type: ProofType.signature,
    signature,
  };
}

function mockGroupProof(groupId = 'testing_dev_group'): RLNProof {
  return {
    type: ProofType.rln,
    groupId: groupId,
    proof: {
      proof: {
        pi_a: [],
        pi_b: [],
        pi_c: [],
        protocol: 'test_protocol',
        curve: 'test_curve',
      },
      publicSignals: {
        yShare: 'yShare',
        merkleRoot: 'merkleRoot',
        internalNullifier: 'internalNullifier',
        signalHash: 'signalHash',
        epoch: 'epoch',
        rlnIdentifier: 'rlnIdentifier',
      },
    },
  };
}
