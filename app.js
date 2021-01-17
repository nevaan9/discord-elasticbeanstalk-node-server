const Discord = require('discord.js');
const client = new Discord.Client();
const creds = require('./credentials.json');

client.once('ready', () => {
  console.log('Ready!');
});

client.login(creds['discordBotToken']);

// Get cracking here
client.on('message', (message) => {
  if (message.content === '!ping') {
    message.channel.send({
      embed: {
        color: 3447003,
        author: {
          name: client.user.username,
          icon_url: client.user.avatarURL(),
        },
        title: 'This is an embed',
        url: 'http://google.com',
        description:
          'This is a test embed to showcase what they look like and what they can do.',
        fields: [
          {
            name: 'Fields',
            value: 'They can have different fields with small headlines.',
          },
          {
            name: 'Masked links',
            value:
              'You can put [masked links](http://google.com) inside of rich embeds.',
          },
          {
            name: 'Markdown',
            value:
              'You can put all the *usual* **__Markdown__** inside of them.',
          },
        ],
        timestamp: new Date(),
        footer: {
          icon_url: client.user.avatarURL(),
          text: '© Example',
        },
      },
    });
  }
});

client.on('messageReactionAdd', (reaction, user) => {
  reaction.message
    .edit({
      embed: {
        color: 3447003,
        author: {
          name: client.user.username,
          icon_url: client.user.avatarURL(),
        },
        title: 'This is an embed. NEW CONTNET@@!!!!!!!!!',
        url: 'http://google.com',
        description:
          'This is a test embed to showcase what they look like and what they can do.',
        fields: [
          {
            name: 'Fields',
            value: 'They can have different fields with small headlines.',
          },
          {
            name: 'Masked links',
            value:
              'You can put [masked links](http://google.com) inside of rich embeds.',
          },
          {
            name: 'Markdown',
            value:
              'You can put all the *usual* **__Markdown__** inside of them.',
          },
        ],
        timestamp: new Date(),
        footer: {
          icon_url: client.user.avatarURL(),
          text: '© Example',
        },
      },
    })
    .then((msg) =>
      console.log(`Updated the content of a message to ${msg.content}`)
    )
    .catch(console.error);
});
