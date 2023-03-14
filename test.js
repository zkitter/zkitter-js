(async () => {
    const Web3 = require('web3');
    const {Strategy, ZkIdentity} = require('@zk-kit/identity');
    const {
        Zkitter,
        generateIdentity,
        Chat,
        generateECDHWithP256,
        Crypto,
    } = require('./dist/browser');
    const {deriveSharedSecret, encrypt, decrypt} = Crypto;
    const zkitter = await Zkitter.initialize();
    zkitter.on('Users.ArbitrumSynced', console.log.bind(console));
    zkitter.on('Users.NewUserCreated', console.log.bind(console));
    zkitter.on('Group.GroupSynced', console.log.bind(console));
    zkitter.on('Group.NewGroupMemberCreated', console.log.bind(console));
    zkitter.on('Zkitter.NewMessageCreated', console.log.bind(console));
    await zkitter.watchArbitrum();
    console.log('watch');
    await zkitter.subscribe({});
    // await zkitter.queryHistory();
    await zkitter.queryUser('0xFEBc214765f6201d15F06e4bb882a7400B0FDf63');
    await zkitter.queryUser('0xd44a82dD160217d46D754a03C8f841edF06EBE3c');
    console.log(await zkitter.getFollowings('0xFEBc214765f6201d15F06e4bb882a7400B0FDf63'));
    console.log('hihihihih')
    const httpProvider = new Web3.providers.HttpProvider('https://arb1.arbitrum.io/rpc');
    //
    const posts = await zkitter.getUserPosts('0xFEBc214765f6201d15F06e4bb882a7400B0FDf63', 20);
    const last = posts[posts.length - 1];
    // console.log(posts, last.hash());

    console.log((await zkitter.getHomefeed({
        addresses: {
            "0xd44a82dD160217d46D754a03C8f841edF06EBE3c": true,
            "0xd32c9aaa32730460b673fCf3a4FaD1DF35da819d": true,
        },
        groups: {
            // 'interrep_twitter_bronze',
            // 'interrep_twitter_unrated',
            // 'interrep_twitter_gold': true,
            // 'interrep_twitter_bronze',
            // 'interrep_reddit_unrated': true,
            zksocial_all: true,
            '': true,
        }
    })).map(p => p.toJSON()))

    // const proof = await zkitter.services.pubsub.createProof({
    //     hash: post.hash(),
    //     zkIdentity: zkIdentity,
    //     groupId: `interrep_twitter_bronze`,
    // });
    //
    // await zkitter.services.pubsub.publish(post, proof);
    // const web3 = new Web3(httpProvider);
    // web3.eth.accounts.wallet.add('');
    // const account = web3.eth.accounts.wallet[0].address;
    // const sign = web3.eth.accounts.wallet[0];
    // // console.log(account, web3.eth.personal, sign.sign);
    // const keys = await generateIdentity(0, async data => {
    //     const {signature} = await sign.sign(data);
    //     return signature;
    // });
    console.log(await zkitter.getUser('0xFEBc214765f6201d15F06e4bb882a7400B0FDf63'))
    console.log(await zkitter.getUserMeta('0xFEBc214765f6201d15F06e4bb882a7400B0FDf63'))
    console.log(await zkitter.getUserMeta("0xd44a82dD160217d46D754a03C8f841edF06EBE3c"))
    // console.log(await zkitter.getGroupMembers('custom_0x9F081501b14be09271F8A7Eed550e98643b5C5c4'))



    const pk = "";
    const ecdh = await generateECDHWithP256(pk);
    const receiverECDH = "0x0ab0702a5076ed402496ace184aa16b4ad3a08cdd687dc04b69005d236dd063d";
    const senderECDH = ecdh.pub;

    const sharedKey = deriveSharedSecret(receiverECDH, '0x' + ecdh.priv);

    const ciphertext = encrypt('hello chat', sharedKey);

    console.log(ciphertext, decrypt(ciphertext, sharedKey));
    const chat = new Chat({
        type: 'CHAT',
        subtype: 'DIRECT',
        creator: '0xFEBc214765f6201d15F06e4bb882a7400B0FDf63',
        payload: {
            encryptedContent: ciphertext,
            receiverECDH,
            senderECDH,
        },
    });

    console.log(ecdh);
    console.log(chat)
    console.log(Chat.fromHex(chat.toHex()))
    // console.log(account);
    // console.log(proof);
    // const posts = await zkitter.getPosts(5);
    // console.log(await zkitter.services.groups.members('custom_0x9F081501b14be09271F8A7Eed550e98643b5C5c4'))
    // console.log(await zkitter.services.groups.members('zksocial_all'))

  // const proof = await zkitter.services.pubsub.createProof({
  //     hash: post.hash(),
  //     zkIdentity: zkIdentity,
  //     groupId: `interrep_twitter_bronze`,
  // });
  //
  // await zkitter.services.pubsub.publish(post, proof);
  // const web3 = new Web3(httpProvider);
  // web3.eth.accounts.wallet.add('');
  // const account = web3.eth.accounts.wallet[0].address;
  // const sign = web3.eth.accounts.wallet[0];
  // // console.log(account, web3.eth.personal, sign.sign);
  // const keys = await generateIdentity(0, async data => {
  //     const {signature} = await sign.sign(data);
  //     return signature;
  // });
  console.log(await zkitter.getGroupMembers('custom_0x9F081501b14be09271F8A7Eed550e98643b5C5c4'));
  // console.log(account);
  // console.log(proof);
  // const posts = await zkitter.getPosts(5);
  // console.log(await zkitter.services.groups.members('custom_0x9F081501b14be09271F8A7Eed550e98643b5C5c4'))
  // console.log(await zkitter.services.groups.members('zksocial_all'))

  // await zkitter.services.pubsub.publish(post, proof);
  // console.log(await zkitter.getUserPosts(account));
  // await zkitter.write({
  //     creator: account,
  //     content: 'hello zkitter',
  //     // creator: string;
  //     // content: string;
  //     // reference?: string;
  //     privateKey: keys.priv,
  //     // zkIdentity?: ZkIdentity,
  //     // global?: boolean;
  //     // groupId?: string;
  // })
  // console.log(unsub);

  // await zkitter.syncUsers();
  // await zkitter.syncGroup();
  // await zkitter.queryHistory();
  // console.log(global.window);
  // console.log('hi', Zkitter);
})();
