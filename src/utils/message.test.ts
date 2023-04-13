import tape from 'tape';
import {
  Chat, ChatMessageSubType,
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

tape('Zkitter Message Format', async t => {
  t.test('Post', test => {
    const msg = new Post({
      type: MessageType.Post,
      subtype: PostMessageSubType.Default,
      creator: 'userA',
      createdAt: new Date(0),
      payload: {
        content: 'hello world',
        attachment: 'attachment-data',
        topic: 'hello',
        title: 'im a title',
        reference: 'abcde',
      },
    });

    test.deepEqual(msg.toJSON(), Post.fromHex(msg.toHex()).toJSON(), 'it should covert to/from hex correctly');
    test.deepEqual(msg.toHex(), Post.fromJSON(msg.toJSON()).toHex(), 'it should covert to/from json correctly');

    test.assert(msg.type === 'POST', 'it should return correct type');
    test.assert(msg.subtype === '', 'it should return correct subtype');
    test.assert(msg.creator === 'userA', 'it should return correct creator');
    test.deepEqual(msg.payload, {
      content: 'hello world',
      attachment: 'attachment-data',
      topic: 'hello',
      title: 'im a title',
      reference: 'abcde',
    }, 'it should return correct payload');

    test.end();
  });

  t.test('Moderation', test => {
    const msg = new Moderation({
      type: MessageType.Moderation,
      subtype: ModerationMessageSubType.Like,
      creator: 'userA',
      payload: {
        reference: 'abcde',
      },
    });

    test.deepEqual(msg.toJSON(), Moderation.fromHex(msg.toHex()).toJSON(), 'it should covert to/from hex correctly');
    test.deepEqual(msg.toHex(), Moderation.fromJSON(msg.toJSON()).toHex(), 'it should covert to/from json correctly');

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
      type: MessageType.Connection,
      subtype: ConnectionMessageSubType.Follow,
      creator: 'userA',
      payload: {
        name: 'userB',
      },
    });

    test.deepEqual(msg.toJSON(), Connection.fromHex(msg.toHex()).toJSON(), 'it should covert to/from hex correctly');
    test.deepEqual(msg.toHex(), Connection.fromJSON(msg.toJSON()).toHex(), 'it should covert to/from json correctly');

    test.assert(msg.type === 'CONNECTION', 'it should return correct type');
    test.assert(msg.subtype === 'FOLLOW', 'it should return correct subtype');
    test.assert(msg.creator === 'userA', 'it should return correct creator');
    test.deepEqual(msg.payload, {
      name: 'userB',
    }, 'it should return correct payload');
    test.end();
  });

  t.test('Profile', test => {
    const msg = new Profile({
      type: MessageType.Profile,
      subtype: ProfileMessageSubType.ProfileImage,
      creator: 'userA',
      payload: {
        value: 'image.url',
      },
    });

    test.deepEqual(msg.toJSON(), Profile.fromHex(msg.toHex()).toJSON(), 'it should covert to/from hex correctly');
    test.deepEqual(msg.toHex(), Profile.fromJSON(msg.toJSON()).toHex(), 'it should covert to/from json correctly');

    test.assert(msg.type === 'PROFILE', 'it should return correct type');
    test.assert(msg.subtype === 'PROFILE_IMAGE', 'it should return correct subtype');
    test.assert(msg.creator === 'userA', 'it should return correct creator');
    test.deepEqual(msg.payload, {
      key: '',
      value: 'image.url',
    }, 'it should return correct payload');
    test.end();
  });

  t.test('Chat', test => {
    const msg = new Chat({
      type: MessageType.Chat,
      subtype: ChatMessageSubType.Direct,
      creator: 'userA',
      payload: {
        encryptedContent: 'hi',
        senderECDH: '13579',
        receiverECDH: '246810',
        senderSeed: 'seed',
        reference: 'abcde',
      },
    });

    msg.payload.content = 'decrypted';

    const json = msg.toJSON();
    delete json.payload.content;

    test.deepEqual(json, Chat.fromHex(msg.toHex()).toJSON(), 'it should covert to/from hex correctly');
    test.deepEqual(msg.toHex(), Chat.fromJSON(msg.toJSON()).toHex(), 'it should covert to/from json correctly');

    test.assert(msg.type === 'CHAT', 'it should return correct type');
    test.assert(msg.subtype === 'DIRECT', 'it should return correct subtype');
    test.assert(msg.creator === 'userA', 'it should return correct creator');
    test.deepEqual(msg.payload, {
      encryptedContent: 'hi',
      senderECDH: '13579',
      receiverECDH: '246810',
      senderSeed: 'seed',
      reference: 'abcde',
      content: 'decrypted',
    }, 'it should return correct payload');
    test.end();
  });

  t.test('Revert', test => {
    const msg = new Revert({
      type: MessageType.Revert,
      creator: 'userA',
      payload: {
        reference: 'abcde',
      },
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
    test.deepEqual(msg.payload, {
      reference: 'abcde',
    }, 'it should return correct payload');
    test.end();
  });

  t.end();
})