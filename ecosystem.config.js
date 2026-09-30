module.exports = {
  apps: [{
    name: 'kafka-cdl-consumer',
    script: 'ts-node',
    args: './src/index.ts',
    watch: ['src'],
    env: {
      //NODE_OPTIONS: '--inspect=[::]:9229'
    }
  }]
};
