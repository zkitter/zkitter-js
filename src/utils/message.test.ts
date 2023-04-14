import tape from 'tape';
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
} from './message';

tape('Zkitter Message Format', t => {
  t.test('Post', test => {
    const msg = new Post({
      createdAt: new Date(0),
      creator: 'userA',
      payload: {
        attachment: 'attachment-data',
        content: 'hello world',
        reference: 'abcde',
        title: 'im a title',
        topic: 'hello',
      },
      subtype: PostMessageSubType.Default,
      type: MessageType.Post,
    });

    test.deepEqual(
      msg.toJSON(),
      Post.fromHex(msg.toHex()).toJSON(),
      'it should covert to/from hex correctly'
    );
    test.deepEqual(
      msg.toHex(),
      Post.fromJSON(msg.toJSON()).toHex(),
      'it should covert to/from json correctly'
    );

    test.assert(msg.type === 'POST', 'it should return correct type');
    test.assert(msg.subtype === '', 'it should return correct subtype');
    test.assert(msg.creator === 'userA', 'it should return correct creator');
    test.deepEqual(
      msg.payload,
      {
        attachment: 'attachment-data',
        content: 'hello world',
        reference: 'abcde',
        title: 'im a title',
        topic: 'hello',
      },
      'it should return correct payload'
    );

    test.end();
  });

  t.test('Moderation', test => {
    const msg = new Moderation({
      creator: 'userA',
      payload: {
        reference: 'abcde',
      },
      subtype: ModerationMessageSubType.Like,
      type: MessageType.Moderation,
    });

    test.deepEqual(
      msg.toJSON(),
      Moderation.fromHex(msg.toHex()).toJSON(),
      'it should covert to/from hex correctly'
    );
    test.deepEqual(
      msg.toHex(),
      Moderation.fromJSON(msg.toJSON()).toHex(),
      'it should covert to/from json correctly'
    );

    test.assert(msg.type === 'MODERATION', 'it should return correct type');
    test.assert(msg.subtype === 'LIKE', 'it should return correct subtype');
    test.assert(msg.creator === 'userA', 'it should return correct creator');
    test.deepEqual(
      msg.payload,
      {
        reference: 'abcde',
      },
      'it should return correct payload'
    );

    test.end();
  });

  t.test('Connection', test => {
    const msg = new Connection({
      creator: 'userA',
      payload: {
        name: 'userB',
      },
      subtype: ConnectionMessageSubType.Follow,
      type: MessageType.Connection,
    });

    test.deepEqual(
      msg.toJSON(),
      Connection.fromHex(msg.toHex()).toJSON(),
      'it should covert to/from hex correctly'
    );
    test.deepEqual(
      msg.toHex(),
      Connection.fromJSON(msg.toJSON()).toHex(),
      'it should covert to/from json correctly'
    );

    test.assert(msg.type === 'CONNECTION', 'it should return correct type');
    test.assert(msg.subtype === 'FOLLOW', 'it should return correct subtype');
    test.assert(msg.creator === 'userA', 'it should return correct creator');
    test.deepEqual(
      msg.payload,
      {
        name: 'userB',
      },
      'it should return correct payload'
    );
    test.end();
  });

  t.test('Profile', test => {
    const msg = new Profile({
      creator: 'userA',
      payload: {
        value: 'image.url',
      },
      subtype: ProfileMessageSubType.ProfileImage,
      type: MessageType.Profile,
    });

    test.deepEqual(
      msg.toJSON(),
      Profile.fromHex(msg.toHex()).toJSON(),
      'it should covert to/from hex correctly'
    );
    test.deepEqual(
      msg.toHex(),
      Profile.fromJSON(msg.toJSON()).toHex(),
      'it should covert to/from json correctly'
    );

    test.assert(msg.type === 'PROFILE', 'it should return correct type');
    test.assert(msg.subtype === 'PROFILE_IMAGE', 'it should return correct subtype');
    test.assert(msg.creator === 'userA', 'it should return correct creator');
    test.deepEqual(
      msg.payload,
      {
        key: '',
        value: 'image.url',
      },
      'it should return correct payload'
    );
    test.end();
  });

  t.test('Chat', test => {
    const msg = new Chat({
      creator: 'userA',
      payload: {
        encryptedContent: 'hi',
        receiverECDH: '246810',
        reference: 'abcde',
        senderECDH: '13579',
        senderSeed: 'seed',
      },
      subtype: ChatMessageSubType.Direct,
      type: MessageType.Chat,
    });

    msg.payload.content = 'decrypted';

    const json = msg.toJSON();
    delete json.payload.content;

    test.deepEqual(
      json,
      Chat.fromHex(msg.toHex()).toJSON(),
      'it should covert to/from hex correctly'
    );
    test.deepEqual(
      msg.toHex(),
      Chat.fromJSON(msg.toJSON()).toHex(),
      'it should covert to/from json correctly'
    );

    test.assert(msg.type === 'CHAT', 'it should return correct type');
    test.assert(msg.subtype === 'DIRECT', 'it should return correct subtype');
    test.assert(msg.creator === 'userA', 'it should return correct creator');
    test.deepEqual(
      msg.payload,
      {
        content: 'decrypted',
        encryptedContent: 'hi',
        receiverECDH: '246810',
        reference: 'abcde',
        senderECDH: '13579',
        senderSeed: 'seed',
      },
      'it should return correct payload'
    );
    test.end();
  });

  t.test('Revert', test => {
    const msg = new Revert({
      creator: 'userA',
      payload: {
        reference: 'abcde',
      },
      type: MessageType.Revert,
    });

    test.deepEqual(
      msg.toJSON(),
      Revert.fromHex(msg.toHex()).toJSON(),
      'it should covert to/from hex correctly'
    );
    test.deepEqual(
      msg.toHex(),
      Revert.fromJSON(msg.toJSON()).toHex(),
      'it should covert to/from json correctly'
    );

    test.assert(msg.type === 'REVERT', 'it should return correct type');
    test.assert(msg.subtype === '', 'it should return correct subtype');
    test.assert(msg.creator === 'userA', 'it should return correct creator');
    test.deepEqual(
      msg.payload,
      {
        reference: 'abcde',
      },
      'it should return correct payload'
    );
    test.end();
  });

  t.end();
});
