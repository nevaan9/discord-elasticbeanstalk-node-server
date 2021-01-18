const Discord = require('discord.js');
const { Client, MessageEmbed } = require('discord.js');
const client = new Client({ partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });
const dayjs = require('dayjs')
const utc = require('dayjs/plugin/utc')
const timezone = require('dayjs/plugin/timezone')
dayjs.extend(utc)
dayjs.extend(timezone)
const creds = require('./credentials.json');
const BOT_NAME = 'nevaan-event-scheduler'
const COMMAND_PREFIX = '!'
const ARG_PREFIX = '--'
const ALLOWED_DATE_ARG_WORDS = new Set(['today', 'tomorrow', 'day-after'])
const ALLOWED_MENTION_ARGS = new Set(['none', 'all'])
const DEFAULT_HOUR = '12'
const DEFAULT_MINUTE = '15'
const DATE_FORMATTER = 'MMMM D, YYYY h:mm A'
const DEFAULT_TIMEZONE = 'America/New_York'
const HEART_EYES_EMOJI_ID = '%F0%9F%98%8D'
const THINKING_EMOJI_ID = '%F0%9F%A4%94'
const FROWNING2_EMOJI_ID = '%E2%98%B9%EF%B8%8F'

client.once('ready', () => {
  console.log('Ready!');
});

client.login(creds['discordBotToken']);

// accepted args ️(defaults in parens)
// --date (today)
// --time (12:15pm)
// --title (Who wants to Pho?)
// --mention (default 'all', { accepted 'none' })
// timezone (TODO): assuming EST for now

const baseDescription = ':heart_eyes: = Going; :frowning2: = Not Going; :thinking: = Maybe'
const formatDate = ({ date = 'today', hour = DEFAULT_HOUR, minute = DEFAULT_MINUTE }) => {
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
  }, { title: 'Who wants pho?', hour: '12', minute: '15', mention: 'none', date: 'today' })
}

// Get cracking here
client.on('message', (message) => {
  if (!message.content.startsWith(COMMAND_PREFIX) || message.author.bot) {
    return
  } else {
    const command = message.content.slice(COMMAND_PREFIX.length).trim().split(' ').shift().toLowerCase();
    switch (command) {
      case 'pho':
        const args = message.content.slice(COMMAND_PREFIX.length).trim().split(ARG_PREFIX).splice(1);
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

const addUserToField = (field, username) => {
  const fieldValues = field.value.split('\n')
  const fieldValuesSet = new Set(fieldValues)
  if (!fieldValuesSet.has(username)) {
    fieldValues.push(username)
    field.value = fieldValues.join('\n')
  }
}

const removeUserFromFields = (field1, field2, username) => {
  const field1Values = field1.value.split('\n')
  const field2Values = field2.value.split('\n')
  field1.value = field1Values.filter(fv => fv !== username).join('\n')
  field2.value = field2Values.filter(fv => fv !== username).join('\n')
}

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
	    const userId = user.id
	    // Make sure the user cannot react to multiple RSVP reactions
	    const userReactions = message.reactions.cache.filter(reaction => reaction.users.cache.has(userId));
      try {
  	    for (const userReaction of userReactions.values()) {
  	      const userReactionId = userReaction.emoji.identifier
  	      if (rsvpReactions.has(userReactionId) && userReactionId !== currentReactionId) {
  	        // Okay now make sure the user has not use any other RSVP reactions; if so, remove it
  	        await userReaction.users.remove(userId)
  	      }
  	    }
      } catch (error) {
  	    console.error('Failed to remove reactions.');
      }
      // Send the updated message
      // Bets if we keep track of all this with a DATABASE, but since our channel only has few users if wont be an issue
      const currentGoingField = reaction.message.embeds[0].fields[0]
      const currentDeclinedField = reaction.message.embeds[0].fields[1]
      const currentMaybeField = reaction.message.embeds[0].fields[2]
      const usernameOfPersonWhoReacted = user.username
      // Add the user to the field
      if (currentReactionId === HEART_EYES_EMOJI_ID) {
        removeUserFromFields(currentDeclinedField, currentMaybeField, usernameOfPersonWhoReacted)
        addUserToField(currentGoingField, usernameOfPersonWhoReacted)
      } else if (currentReactionId === FROWNING2_EMOJI_ID) {
        removeUserFromFields(currentGoingField, currentMaybeField, usernameOfPersonWhoReacted)
        addUserToField(currentDeclinedField, usernameOfPersonWhoReacted)
      } else if (currentReactionId === THINKING_EMOJI_ID) {
        removeUserFromFields(currentGoingField, currentDeclinedField, usernameOfPersonWhoReacted)
        addUserToField(currentMaybeField, usernameOfPersonWhoReacted)
      }
      const updatedFieldValues = [currentGoingField, currentDeclinedField, currentMaybeField]
      const embed = reaction.message.embeds[0]
      embed.spliceFields(0, 3, updatedFieldValues)
      reaction.message.edit(embed)
	  }
	}
});
