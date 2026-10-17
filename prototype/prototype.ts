import readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

rl.question('script test ', (result) => {
    console.log('done');

    rl.close();
})