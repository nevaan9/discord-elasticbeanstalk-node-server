
const AWS = require("aws-sdk");
// discord stuff
const { Client, MessageEmbed } = require('discord.js');
const client = new Client({ partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });
const dayjs = require('dayjs')
const utc = require('dayjs/plugin/utc')
const timezone = require('dayjs/plugin/timezone')
dayjs.extend(utc)
dayjs.extend(timezone)
const BOT_NAME = 'nevaan-event-scheduler'
const COMMAND_PREFIX = '!'
const ARG_PREFIX = '--'
const ALLOWED_DATE_ARG_WORDS = new Set(['today', 'tomorrow', 'day-after'])
const DEFAULT_HOUR = '12'
const DEFAULT_MINUTE = '15'
const DEFAULT_DATE = 'today'
const DEFAULT_MENTION = 'none'
const ALLOWED_MENTION_ARGS = new Set([DEFAULT_MENTION, 'all'])
const DEFAULT_TITLE = 'Who wants pho?'
const DATE_FORMATTER = 'MMMM D, YYYY h:mm A'
const DEFAULT_MIN_PEOPLE = 4
const DEFAULT_TIMEZONE = 'America/New_York'
const HEART_EYES_EMOJI_ID = '%F0%9F%98%8D'
const THINKING_EMOJI_ID = '%F0%9F%A4%94'
const FROWNING2_EMOJI_ID = '%E2%98%B9%EF%B8%8F'

client.once('ready', () => {
  console.log('Ready!');
});

const ENV = process.env.NODE_ENV
let creds = {}
console.log('ENVIRONMENT', ENV)
if (!ENV || ENV === 'development') {
  try {
    creds = require('./credentials.json');
  } catch (e) {
    console.error('Credentials file could not be loaded in dev mode!')
    return
  }
}

const reactionsTableName = process.env.REACTIONS_TABLE_NAME || creds['reactionsTableName'];
const discordCredentials = process.env.DISCORD_BOT_TOKEN || creds['discordBotToken']
const region = process.env.AWS_REGION || creds['awsRegion']

// Set up AWS STUFF
AWS.config.update({ region });
// Store messages in a DynamoDB table
const ddbDocumentClient = new AWS.DynamoDB.DocumentClient();
client.login(discordCredentials);

// accepted args ️(defaults in parens)
// --date (today)
// --time (12:15pm)
// --title (Who wants to Pho?)
// --mention (default 'all', { accepted 'none' })
// --people (default '4', { accepted number })
// timezone (TODO): assuming EST for now

const helpText = `Accepted arguments: \n\n --date=<value> [acceptedValues = today|tomorrow|day-after]: Date for the event \n\n --time=<value> [default=${DEFAULT_HOUR}:${DEFAULT_MINUTE}, format={hh}:{mm}, use 24 hour clock values]: Time of the event \n\n --title=<value> [default=${DEFAULT_TITLE}]: Title of the event \n\n --mention=<value> [default=none, acceptedValues= none|all]: If you'd like to notify all in the channel \n\n --minPeople=<value> [default=4, NOT IMPLEMENTED YET!]: The minumum number of people required to say 'Going' for the google cal link to show up `
const baseDescription = ':heart_eyes: = Going; :frowning2: = Not Going; :thinking: = Maybe'

// Get cracking here
client.on('message', (message) => {
  if (!message.content.startsWith(COMMAND_PREFIX) || message.author.bot) {
    return
  } else {
    const command = message.content.slice(COMMAND_PREFIX.length).trim().split(' ').shift().toLowerCase();
    switch (command) {
      case 'pho':
        const args = message.content.slice(COMMAND_PREFIX.length).trim().split(ARG_PREFIX).splice(1);
        if (args.includes('help')) {
          message.channel.send(helpText)
          return
        }
        const { title, hour, minute, mention, date } = parseArgs(args)
        // if date === today and the time is greater than current time, default to tomorrow
        let { formatted, timezoned } = formatDate({ date, hour, minute })
        const clientTimeZoneOffSet = timezoned.utcOffset()
        const messageCreated = message.createdAt
        const messageCreatedAtConvertedToClientTZ = dayjs.utc(messageCreated).utcOffset(clientTimeZoneOffSet)
        // Now check if the hours are more
        let finalDateFormatted = formatted
        const proposedDateHour = dayjs(formatted).hour()
        const createdDateHour = messageCreatedAtConvertedToClientTZ.hour()
        // mins
        const proposedDateMin = dayjs(formatted).minute()
        const createdDateMin = messageCreatedAtConvertedToClientTZ.minute()
        if ((proposedDateHour < createdDateHour) || (proposedDateHour == createdDateHour && proposedDateMin < createdDateMin)) {
          finalDateFormatted = dayjs(formatted).add(1, 'day').format(DATE_FORMATTER)
        }
        const embed = new MessageEmbed({
          color: 3447003,
          title: `${title}`,
          description: `When: ${finalDateFormatted} \n \n ${baseDescription}`,
          fields: [
            {
              name: 'Going',
              value: '----\n',
              inline: true
            },
            {
              name: 'Declined',
              value: '----\n',
              inline: true
            },
            {
              name: 'Maybe',
              value: '----\n',
              inline: true
            },
          ],
          timestamp: new Date(),
          footer: {
            text: `${message.author.username}`
          }
        })
        // Send a notification to all
        const defaultAttendees = {
          GOING: ['----'],
          DECLINDED: ['----'],
          MAYBE: ['----']
        }
        if (mention === 'all') {
          message.channel.send('@everyone').then(() => {
            message.channel.send(embed).then(async messageInfo => {
              try {
                await putMessage(`${messageInfo.id}`, defaultAttendees.GOING, defaultAttendees.DECLINDED, defaultAttendees.MAYBE)
              } catch (e) {
                console.error(e, 'Error adding info to reactions table')
              }
            })
          })
        } else {
          message.channel.send(embed).then(async messageInfo => {
            try {
              await putMessage(`${messageInfo.id}`, defaultAttendees.GOING, defaultAttendees.DECLINDED, defaultAttendees.MAYBE)
            } catch (e) {
              console.error(e, 'Error adding info to reactions table')
            }
          })
        }
        break;
      default:
        return
    }
  }
});

const addUserToField = (field, username) => {
  const fieldValues = field.value.split('\n')
  const fieldValuesSet = new Set(fieldValues)
  if (!fieldValuesSet.has(username)) {
    fieldValues.push(username)
    field.value = fieldValues.join('\n')
  }
}

client.on('messageReactionRemove', async (reaction, user) => {
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
	  const currentReactionId = reaction.emoji.identifier
	  const rsvpReactions = new Set([THINKING_EMOJI_ID, HEART_EYES_EMOJI_ID, FROWNING2_EMOJI_ID])
	  // Only need to do all this work if the user reacted with an RSVP reaction
	  if (rsvpReactions.has(currentReactionId)) {
      const usernameOfPersonWhoReacted = user.username
      // Remove the user form the field
      let updatedData
      if (currentReactionId === HEART_EYES_EMOJI_ID) {
        updatedData = await updateMessage({ updateType: 'DELETE', values: [`${usernameOfPersonWhoReacted}`], messageId: message.id, setName: 'GOING' })
        if (updatedData) {
          const fieldValues = updatedData.GOING.join('\n')
          const updatedField = [{ name: 'Going', value: fieldValues, inline: true }]
          const embed = reaction.message.embeds[0]
          embed.spliceFields(0, 1, updatedField)
          if (new Set(updatedData.GOING).size <= 1) {
            embed.setFooter(``).setURL('')
          }
          reaction.message.edit(embed)
        }
      } else if (currentReactionId === FROWNING2_EMOJI_ID) {
        updatedData = await updateMessage({ updateType: 'DELETE', values: [`${usernameOfPersonWhoReacted}`], messageId: message.id, setName: 'DECLINED' })
        if (updatedData) {
          const fieldValues = updatedData.DECLINED.join('\n')
          const updatedField = [{ name: 'Declined', value: fieldValues, inline: true }]
          const embed = reaction.message.embeds[0]
          embed.spliceFields(1, 1, updatedField)
          reaction.message.edit(embed)
        }
      } else if (currentReactionId === THINKING_EMOJI_ID) {
        updatedData = await updateMessage({ updateType: 'DELETE', values: [`${usernameOfPersonWhoReacted}`], messageId: message.id, setName: 'MAYBE' })
        if (updatedData) {
          const fieldValues = updatedData.MAYBE.join('\n')
          const updatedField = [{ name: 'Maybe', value: fieldValues, inline: true }]
          const embed = reaction.message.embeds[0]
          embed.spliceFields(2, 1, updatedField)
          reaction.message.edit(embed)
        }
      }
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
	  const currentReactionId = reaction.emoji.identifier
	  const rsvpReactions = new Set([THINKING_EMOJI_ID, HEART_EYES_EMOJI_ID, FROWNING2_EMOJI_ID])
	  // Only need to do all this work if the user reacted with an RSVP reaction
	  if (rsvpReactions.has(currentReactionId)) {
	    let reactionRemoved = false
	    const userId = user.id
	    // Make sure the user cannot react to multiple RSVP reactions
	    const userReactions = message.reactions.cache.filter(reaction => reaction.users.cache.has(userId));
      try {
  	    for (const userReaction of userReactions.values()) {
  	      const userReactionId = userReaction.emoji.identifier
  	      if (rsvpReactions.has(userReactionId) && userReactionId !== currentReactionId) {
  	        await userReaction.users.remove(userId)
  	        reactionRemoved = true
  	      }
  	    }
      } catch (error) {
  	    console.error('Failed to remove reactions.');
      }
      // Send the updated message
      // wait till messageReactionRemove runs
      const waitTime = reactionRemoved ? 500 : 0
      await new Promise(resolve => setTimeout(resolve, waitTime));
      const usernameOfPersonWhoReacted = user.username
      // Remove the user form the field
      let updatedData
      if (currentReactionId === HEART_EYES_EMOJI_ID) {
        updatedData = await updateMessage({ updateType: 'ADD', values: [`${usernameOfPersonWhoReacted}`], messageId: message.id, setName: 'GOING' })
        if (updatedData) {
          const fieldValues = updatedData.GOING.join('\n')
          const updatedField = [{ name: 'Going', value: fieldValues, inline: true }]
          const embed = reaction.message.embeds[0]
          embed.spliceFields(0, 1, updatedField)
          // Should we add a google link?
          if (new Set(updatedData.GOING).size >= DEFAULT_MIN_PEOPLE) {
            embed.setFooter(`${DEFAULT_MIN_PEOPLE} or more people said they are going! Make a calendar invite by clicking the link on top!`).setURL('https://calendar.google.com/calendar/')
          }
          reaction.message.edit(embed)
          // Make sure no dupes a lying around
          if (new Set(updatedData.DECLINED).has(usernameOfPersonWhoReacted)) {
            updateMessage({ updateType: 'DELETE', values: [`${usernameOfPersonWhoReacted}`], messageId: message.id, setName: 'DECLINED' })
          } else if (new Set(updatedData.MAYBE).has(usernameOfPersonWhoReacted)) {
            updateMessage({ updateType: 'DELETE', values: [`${usernameOfPersonWhoReacted}`], messageId: message.id, setName: 'MAYBE' })
          }
        }
      } else if (currentReactionId === FROWNING2_EMOJI_ID) {
        updatedData = await updateMessage({ updateType: 'ADD', values: [`${usernameOfPersonWhoReacted}`], messageId: message.id, setName: 'DECLINED' })
        if (updatedData) {
          const fieldValues = updatedData.DECLINED.join('\n')
          const updatedField = [{ name: 'Declined', value: fieldValues, inline: true }]
          const embed = reaction.message.embeds[0]
          embed.spliceFields(1, 1, updatedField)
          reaction.message.edit(embed)
          // Make sure no dupes a lying around
          if (new Set(updatedData.GOING).has(usernameOfPersonWhoReacted)) {
            const cleanupUpdate = updateMessage({ updateType: 'DELETE', values: [`${usernameOfPersonWhoReacted}`], messageId: message.id, setName: 'GOING' })
            if (cleanupUpdate) {
              if (new Set(updatedData.GOING).size < 1) {
                embed.setFooter(``).setURL('')
              }
            }
          } else if (new Set(updatedData.MAYBE).has(usernameOfPersonWhoReacted)) {
            updateMessage({ updateType: 'DELETE', values: [`${usernameOfPersonWhoReacted}`], messageId: message.id, setName: 'MAYBE' })
          }
        }
      } else if (currentReactionId === THINKING_EMOJI_ID) {
        updatedData = await updateMessage({ updateType: 'ADD', values: [`${usernameOfPersonWhoReacted}`], messageId: message.id, setName: 'MAYBE' })
        if (updatedData) {
          const fieldValues = updatedData.MAYBE.join('\n')
          const updatedField = [{ name: 'Maybe', value: fieldValues, inline: true }]
          const embed = reaction.message.embeds[0]
          embed.spliceFields(2, 1, updatedField)
          reaction.message.edit(embed)
          // Make sure no dupes a lying around
          if (new Set(updatedData.GOING).has(usernameOfPersonWhoReacted)) {
            const cleanupUpdate = updateMessage({ updateType: 'DELETE', values: [`${usernameOfPersonWhoReacted}`], messageId: message.id, setName: 'GOING' })
            if (cleanupUpdate) {
              if (new Set(updatedData.GOING).size <= 1) {
                embed.setFooter(``).setURL('')
              }
            }
          } else if (new Set(updatedData.MAYBE).has(usernameOfPersonWhoReacted)) {
            updateMessage({ updateType: 'DELETE', values: [`${usernameOfPersonWhoReacted}`], messageId: message.id, setName: 'DECLINED' })
          }
        }
      }
	  }
	}
});

// ================== HELPERS ==========================

const formatDate = ({ date = DEFAULT_DATE, hour = DEFAULT_HOUR, minute = DEFAULT_MINUTE }) => {
  const now = dayjs().format('YYYY-MM-DD')
  switch (date) {
    case 'today':
      const today = dayjs(`${now}T${hour}:${minute}`)
      return { formatted: today.format(DATE_FORMATTER), timezoned: dayjs.tz(today, DEFAULT_TIMEZONE) }
    case 'tomorrow':
      const tomorrow = dayjs(`${now}T${hour}:${minute}`).add(1, 'day')
      return { formatted: tomorrow.format(DATE_FORMATTER), timezoned: dayjs.tz(tomorrow, DEFAULT_TIMEZONE) }
    case 'day-after':
      const dayAfter = dayjs(`${now}T${hour}:${minute}`).add(2, 'day')
      return { formatted: dayAfter.format(DATE_FORMATTER), timezoned: dayjs.tz(dayAfter, DEFAULT_TIMEZONE) }
    default:
      const timestamp = Date.parse();
      if (isNaN(timestamp) == false) {
        return new Date(timestamp);
      }
      return dayjs(new Date()).format(DATE_FORMATTER)
  }
}

const isValidDate = () => {
  return false
}

const parseArgs = (args = []) => {
  return args.reduce((acc, curr) => {
    const argsSplit = curr.trim().split('=');
      if (argsSplit.length === 2) {
        const key = argsSplit[0].toLowerCase()
        switch (key) {
          case 'title':
            const titleValue = argsSplit[1].trim()
            if (titleValue) {
              acc['title'] = titleValue
            }
            break;
          case 'mention':
            const mentionValue = argsSplit[1].toLowerCase()
            if (ALLOWED_MENTION_ARGS.has(mentionValue)) {
              acc['mention'] = mentionValue
            }
            break;
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
    return acc
  }, { title: DEFAULT_TITLE, hour: DEFAULT_HOUR, minute: DEFAULT_MINUTE, mention: DEFAULT_MENTION, date: DEFAULT_DATE })
}

// Retrieves the meeting from the table by the meeting title
async function getMessage(messageId) {
  const result = await ddbDocumentClient
    .get({
      TableName: reactionsTableName,
      Key: {
        MessageId: messageId
      },
    })
    .promise();
  return result
}

// Stores the meeting in the table using the meeting title as the key
async function putMessage(messageId, going, declined, maybe) {
  await ddbDocumentClient
    .put({
      TableName: reactionsTableName,
      Item: {
        MessageId: messageId,
        GOING: ddbDocumentClient.createSet(going),
        DECLINED: ddbDocumentClient.createSet(declined),
        MAYBE: ddbDocumentClient.createSet(maybe),
        TTL: `${Math.floor(Date.now() / 1000) + 60 * 60 * 24}`, // clean up meeting record one day from now
      }
    })
    .promise();
}

async function updateMessage({ updateType, values, messageId, setName }) {
  if (updateType === 'DELETE' || updateType === 'ADD') {
    const result = await ddbDocumentClient
    .update({
      TableName: reactionsTableName,
      Key: { MessageId: messageId },
      UpdateExpression: `${updateType} ${setName} :v`,
      ExpressionAttributeValues: {
        ":v": ddbDocumentClient.createSet(values)
      },
      ReturnValues: 'ALL_NEW'
    })
    .promise();
    if (!result.err) {
      return { GOING: result.Attributes.GOING.values, DECLINED: result.Attributes.DECLINED.values, MAYBE: result.Attributes.MAYBE.values }
    }
    return null
  }
}
