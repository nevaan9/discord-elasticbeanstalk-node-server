const Discord = require('discord.js');
const { Client, MessageEmbed } = require('discord.js');
const client = new Client({ partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });
const dayjs = require('dayjs')
const creds = require('./credentials.json');
const BOT_NAME = 'nevaan-event-scheduler'
const COMMAND_PREFIX = '!'
const ARG_PREFIX = '--'
const ALLOWED_DATE_ARG_WORDS = new Set(['today', 'tomorrow', 'day-after'])
const DEFAULT_HOUR = '12'
const DEFAULT_MINUTE = '15'

client.once('ready', () => {
  console.log('Ready!');
});

client.login(creds['discordBotToken']);

// accepted args ️(defaults in parens)
// --date (today)
// --time (12:15pm)
// --title (Who wants to Pho?)
// --mention (default 'all', { accepted 'none' })

const description = 'React with a :heart_eyes: to say you are going. :frowning2: is a no (too bad for you); :thinking: is a maybe'
const parseDate = ({ date = 'today', hour = DEFAULT_HOUR, minute = DEFAULT_MINUTE }) => {
  const now = dayjs().format('YYYY-MM-DD')
  switch (date) {
    case 'today':
      return dayjs(`${now}T${hour}:${minute}Z`).format('MM-DD-YYYY HH:mm A')
    case 'tomorrow':
      // code
      return dayjs(`${now}T${hour}:${minute}Z`).add(1, 'day').format('MM-DD-YYYY HH:mm A')
    case 'day-after':
      // code
      return dayjs(`${now}T${hour}:${minute}Z`).add(2, 'day').format('MM-DD-YYYY HH:mm A')
    default:
      const timestamp = Date.parse();
      if (isNaN(timestamp) == false) {
        return new Date(timestamp);
      }
      return dayjs(new Date()).format('MM-DD-YYYY')
  }
}

const isValidDate = () => {
  return false
}

const parseArgs = (args = []) => {
  return args.reduce((acc, curr) => {
    if (curr.startsWith(ARG_PREFIX)) {
      const argsSplit = curr.slice(ARG_PREFIX.length).trim().split('=');
      if (argsSplit.length === 2) {
        const key = argsSplit[0].toLowerCase()
        switch (key) {
          case 'date':
            const dateValue = argsSplit[1].toLowerCase()
            if (ALLOWED_DATE_ARG_WORDS.has(dateValue)) {
              acc['date'] = dateValue
            } else {
              if (isValidDate(dateValue)) {
                acc['date'] = dateValue
              }
            }
            break;
          case 'time':
            let validHourProvided = false
            const timeValue = argsSplit[1].toLowerCase()
            const timesSplit = timeValue.split(':')
            // parse the hour
            const hourParsed = parseInt(timesSplit[0] || '0')
            if ((hourParsed !== undefined || hourParsed !== null) && !isNaN(hourParsed) && hourParsed > -1 && hourParsed < 24) {
              acc['hour'] = `${hourParsed < 10 ? '0' + hourParsed : hourParsed}`
              validHourProvided = true
            } else {
              acc['hour'] = DEFAULT_HOUR
            }
            // parse the minute
            if (validHourProvided) {
              const minuteParsed = parseInt(timesSplit[1] || '0')
              if ((minuteParsed !== undefined || minuteParsed !== null) && !isNaN(minuteParsed) && minuteParsed > -1 && minuteParsed < 60) {
                acc['minute'] = `${minuteParsed < 10 ? '0' + minuteParsed : minuteParsed}`
              } else {
                acc['minute'] = DEFAULT_MINUTE
              }
            }
            break;
          default:
            return acc
        }
      }
    }
    return acc
  }, {})
}

const generateOptions = (argsParsed) => {
  const date = parseDate({ date: 'today', ...argsParsed })
  const options = { title: 'Who\'s down to pho?', mention: 'none', ...argsParsed }
  return {
    title: `${options.title} (${date})`,
    mention: `${options.mention}`
  }
}

// Get cracking here
client.on('message', (message) => {
  if (!message.content.startsWith(COMMAND_PREFIX) || message.author.bot) {
    return
  } else {
    const args = message.content.slice(COMMAND_PREFIX.length).trim().split(' ');
    const command = args.shift().toLowerCase();
    const argsParsed = parseArgs(args)
    console.log('ARGS PARSED', argsParsed)
    const { title, mention, } = generateOptions(argsParsed)
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
