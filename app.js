const Discord = require('discord.js');
const { Client, MessageEmbed } = require('discord.js');
const client = new Client({ partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });
const creds = require('./credentials.json');
const BOT_NAME = 'nevaan-event-scheduler'
const COMMAND_PREFIX = '!'

client.once('ready', () => {
  console.log('Ready!');
});

client.login(creds['discordBotToken']);

// accepted args ️(defaults in parens)
// --date (12:15pm)
// --title (Who wants to Pho?)
// --mention (default 'all', { accepted 'none' })

const description = 'React with a :heart_eyes: to say you are going. :frowning2: is a no (too bad for you); :thinking: is a maybe'
const parseDate = (date = 'today') => {
  switch (date) {
    case 'today':
      return new Date()
    case 'tomorrow':
      // code
      return new Date()
    case 'day-after':
      // code
      return new Date()
    default:
      const timestamp = Date.parse();
      if (isNaN(timestamp) == false) {
        return new Date(timestamp);
      }
      return new Date();
  }
}
const generateOptions = (args) => {
  const defaultDate = parseDate()
  const defaultOptions = {
    title: 'Who\'s down to pho?',
    mention: 'none'
  }
  return {
    title: `${defaultOptions.title} (${defaultDate})`,
    mention: `${defaultOptions.mention}`
  }
}

// Get cracking here
client.on('message', (message) => {
  if (!message.content.startsWith(COMMAND_PREFIX) || message.author.bot) {
    return
  } else {
    const args = message.content.slice(COMMAND_PREFIX.length).trim().split(' ');
    const command = args.shift().toLowerCase();
    const { title, mention, } = generateOptions(args)
    switch (command) {
      case 'pho':
        const embed = new MessageEmbed({
          color: 3447003,
          title,
          description,
          fields: [
            {
              name: 'Going',
              value: '----',
              inline: true
            },
            {
              name: 'Declined',
              value: '----',
              inline: true
            },
            {
              name: 'Maybe',
              value: '----',
              inline: true
            },
          ],
          timestamp: new Date(),
        })
        // Send a notification to all
        if (mention === 'all') {
          message.channel.send('@everyone').then(() => {
            message.channel.send(embed)
          })
        } else {
          message.channel.send(embed)
        }
        break;
      default:
        return
    }
  }
});

client.on('messageReactionAdd', async (reaction, user) => {
  // When we receive a reaction we check if the reaction is partial or not
	if (reaction.partial) {
		// If the message this reaction belongs to was removed the fetching might result in an API error, which we need to handle
		try {
			await reaction.fetch();
		} catch (error) {
			console.error('Something went wrong when fetching the message: ', error);
			// Return as `reaction.message.author` may be undefined/null
			return;
		}
	}
	const message = reaction.message
	if (message.author && message.author.bot && message.author.username === BOT_NAME) {
	  console.log(`message`, reaction.message);
	// Now the message has been cached and is fully available
	console.log(`${message.author}'s message "${reaction.message.content}" gained a reaction!`);
	// The reaction is now also fully available and the properties will be reflected accurately:
	console.log(`${reaction.count} user(s) have given the same reaction to this message!`);
	}
});
