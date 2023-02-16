(async () => {
    const Web3 = require('web3');
    const {Zkitter, generateIdentity} = require('./dist/browser');
    const zkitter = await Zkitter.initialize();
    zkitter.on('Users.ArbitrumSynced', console.log.bind(console));
    zkitter.on('Users.NewUserCreated', console.log.bind(console));
    zkitter.on('Group.GroupSynced', console.log.bind(console));
    zkitter.on('Group.NewGroupMemberCreated', console.log.bind(console));
    zkitter.on('Zkitter.NewMessageCreated', console.log.bind(console));
    await zkitter.start();
    await zkitter.subscribe();
    const httpProvider = new Web3.providers.HttpProvider('https://arb1.arbitrum.io/rpc');
    const web3 = new Web3(httpProvider);
    web3.eth.accounts.wallet.add('');
    const account = web3.eth.accounts.wallet[0].address;
    const sign = web3.eth.accounts.wallet[0];
    console.log(account, web3.eth.personal, sign.sign);
    const keys = await generateIdentity(0, async data => {
        const {signature} = await sign.sign(data);
        return signature;
    });
    // console.log(await zkitter.getGroupMembers('semaphore_taz_members'))
    console.log(account, web3, keys);
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