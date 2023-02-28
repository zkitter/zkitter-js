(async () => {
    const Web3 = require('web3');
    const {Strategy, ZkIdentity} = require('@zk-kit/identity');
    const {Zkitter, generateIdentity, Post} = require('./dist/browser');
    const zkitter = await Zkitter.initialize();
    zkitter.on('Users.ArbitrumSynced', console.log.bind(console));
    zkitter.on('Users.NewUserCreated', console.log.bind(console));
    zkitter.on('Group.GroupSynced', console.log.bind(console));
    zkitter.on('Group.NewGroupMemberCreated', console.log.bind(console));
    zkitter.on('Zkitter.NewMessageCreated', console.log.bind(console));
    await zkitter.watchArbitrum();
    console.log('watch');
    await zkitter.subscribe({});

    console.log('hihihihih')
    const httpProvider = new Web3.providers.HttpProvider('https://arb1.arbitrum.io/rpc');
    //
    const post = new Post({
        type: 'POST',
        subtype: '',
        creator: '',
        payload: {
            content: 'hello anon',
        },
    });

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
            "zksocial_all": true,
            '': true,
        }
    }, 2)).map(p => p.toJSON()))

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
    console.log(await zkitter.getGroupMembers('custom_0x9F081501b14be09271F8A7Eed550e98643b5C5c4'))
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