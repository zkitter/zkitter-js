(async () => {
    const {Zkitter} = require('./dist/browser');
    const zkitter = await Zkitter.initialize();
    zkitter.on('Users.ArbitrumSynced', console.log.bind(console));
    zkitter.on('Users.NewUserCreated', console.log.bind(console));
    zkitter.on('Group.GroupSynced', console.log.bind(console));
    zkitter.on('Group.NewGroupMemberCreated', console.log.bind(console));
    zkitter.on('Zkitter.NewMessageCreated', console.log.bind(console));
    const unsub = await zkitter.start({
        users: [
            '0x79063F7730bbc39bd8C09b3aD11CE246a33CAEf8',
        ]
    });
    console.log(zkitter);
    console.log(unsub);


    // await zkitter.syncUsers();
    // await zkitter.syncGroup();
    // await zkitter.queryHistory();
    // console.log(global.window);
    // console.log('hi', Zkitter);
})();