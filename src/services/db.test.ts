import tape from 'tape';
import * as path from 'path';
import * as fs from 'fs';
import {LevelDBAdapter} from '../adapters/leveldb';
import {DBService} from './db';
import {MessageType, Moderation, ModerationMessageSubType, Post, PostMessageSubType} from '../utils/message';
import {ProofType, RLNProof, SignatureProof} from '../models/proof';

tape('LevelDB Adapter', async t => {
  const cwd = process.cwd();
  const dbPath = path.join(cwd, 'zkitter_test');
  const udbPath = path.join(cwd, 'zkitter_test_user');
  const ldb = await LevelDBAdapter.initialize(dbPath, udbPath);
  const db = new DBService({ db: ldb });

  // Initialize DB with posts
  const opA = makePost('hello earth');
  const opB = makePost('hello moon', 'userB');
  const { messageId: messageIdA, hash: hashA } = opA.toJSON();
  const { messageId: messageIdB, hash: hashB } = opB.toJSON();

  await db.insertMessage(opA, mockUserProof('a'));
  await db.insertMessage(opB, mockUserProof('b'));

  await db.insertMessage(makeReply(messageIdA, 'reply to earth 1', 'userC'), mockUserProof());
  await db.insertMessage(makeReply(messageIdA, 'reply to earth 2', 'userB'), mockUserProof());
  await db.insertMessage(makeReply(messageIdB, 'reply to moon 1', 'userA'), mockUserProof());
  await db.insertMessage(makeRepost(messageIdB, 'userB'), mockUserProof());

  // Initialize DB with moderations
  await db.insertMessage(makeModeration(messageIdA, ModerationMessageSubType.Global, 'userB'), mockUserProof());
  await db.insertMessage(makeModeration(messageIdA, ModerationMessageSubType.ThreadFollow, 'userA'), mockUserProof());
  await db.insertMessage(makeModeration(messageIdA, ModerationMessageSubType.ThreadMention, 'userA'), mockUserProof());
  await db.insertMessage(makeModeration(messageIdA, ModerationMessageSubType.ThreadBlock, 'userB'), mockUserProof());
  await db.insertMessage(makeModeration(messageIdA, ModerationMessageSubType.Like, 'userA'), mockUserProof());
  await db.insertMessage(makeModeration(messageIdA, ModerationMessageSubType.Like, 'userB'), mockUserProof());
  await db.insertMessage(makeModeration(messageIdA, ModerationMessageSubType.Like, 'userB'), mockUserProof());
  await db.insertMessage(makeModeration(messageIdA, ModerationMessageSubType.Like, 'userB'), mockUserProof());
  await db.insertMessage(makeModeration(messageIdA, ModerationMessageSubType.Like, 'userC'), mockUserProof());
  await db.insertMessage(makeModeration(messageIdA, ModerationMessageSubType.Like, 'userD'), mockUserProof());
  await db.insertMessage(makeModeration(messageIdA, ModerationMessageSubType.Block, 'userD'), mockUserProof());
  await db.insertMessage(makeModeration(messageIdA, ModerationMessageSubType.Block, 'userD'), mockUserProof());


  t.test('messages and proof', async test => {
    const msgA = await ldb.getMessage(hashA);
    const proofA = await ldb.getProof(hashA);

    test.deepEqual(msgA?.toJSON(), opA.toJSON(), 'it should update message');
    test.deepEqual(proofA, mockUserProof('a'), 'it should update proof');
    test.end();
  })

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
    modTest.equal(postMetaA.moderation, 'THREAD_ONLY_MENTION', 'only creator can update moderation');

    await db.insertMessage(makeModeration(messageIdA, ModerationMessageSubType.Global, 'userA'), mockUserProof());
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
  })

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

function makeModeration(reference: string, subtype = ModerationMessageSubType.Default, creator = 'userA'): Moderation {
  return new Moderation({
    type: MessageType.Moderation,
    subtype: subtype,
    creator,
    payload: {
      reference,
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
