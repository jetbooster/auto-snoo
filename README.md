# AutoSnoo

[![Build Status](https://travis-ci.org/jetbooster/auto-snoo.svg?branch=master)](https://travis-ci.org/jetbooster/auto-snoo) [![Coverage Status](https://coveralls.io/repos/github/jetbooster/auto-snoo/badge.svg?branch=master)](https://coveralls.io/github/jetbooster/auto-snoo)

```
Changelog
 - 1.1.0
   * Convert Module to typescript
   * Config change: Function Listener now requires a function named 'func' rather than 'function'
```

>Pull Requests / Issues Welcome! Especially if you think there are any Listener types you think I should add!

AutoSnoo is a generic, customisable reddit bot generator, written in Node.

# Before you begin
Reddit bots can be useful, but they can be very annoying if they are too active, or add little to a conversation. PLEASE read [The bottiquete](https://reddit.com/r/redditdev/comments/98vj9e/please_be_a_good_bot_citizen_of_reddit/) before deploying your bot, especially the sections about creating your own subreddit for testing.

## Quick start
```javascript
const AutoSnoo = require('auto-snoo');
const configObject = {}; // See below
const bot = AutoSnoo.create(configObject)
bot.listen();

```

Main functionality is created with AutoSnoo.create(), with a json object containing configuration.

The bot comes with a few built in predicates to avoid accidental spamming:
  * Only respond to comments posted after the bot has been started
  * Not respond to itself

It also provides a handful of utils for adding functionality to your customisations.

`AutoSnoo.getParentComment(comment)`: Takes in a [Snoowrap.Comment](https://github.com/not-an-aardvark/snoowrap) object and returns the parent of that comment. Useful when you require your bot to have knowledge not only of the comment it is replying to, but also the comment before that.

`AutoSnoo.getCommentChain(comment)`: Returns an array of (simplified) Comment objects from the provided comment up to the thread root.  
NOTE: using this option frequently will very quickly cause your bot to bump up against the ratelimits for the reddit API. Best option is to have any listener using this have more restrictive `customPredicates` or a long `cooldown`

## Config Object
```javascript
{
  snooWrapOpts: {
    clientId: '', // The clientId from reddit.com/prefs/apps
    clientSecret: '', // The clientSecret from reddit.com/prefs/apps
    username: '', // The username the bot will use
    password '', // Password for the above username 
    userAgent '', // (Optional) User-Agent the bot will use. See Reddit API rules for examples: https://github.com/reddit-archive/reddit/wiki/api#rules
  }
  subreddits: '' || [], // string or array of strings representing the subreddits the bot will listen on
  debug: false, // boolean indicating debug mode is on
  listeners: {
    // Object containing any number of listeners for your bot to pick up on
    // The keys will be used as a name in debug logging for indicating which listener triggered.
    example: {
      /* responseType for this listener
       *  random: selects a value at random from the provided corpus
       *  sequential: iterates through all values in the provided corpus in order
       *  function: generates the comment body using a provided function. See #functions
       */
      responseType: 'random' || 'sequential' || 'function',

      /* Array of values to use to generate responses. 
       * REQUIRED for 'random' and 'sequential', ignored for 'function'
       */
      corpus: [], 

      /* The function used to generate the response body. the function will be called with a snoowrap.Comment
       *  object representing the comment that matched the trigger phrase and all custom predicates. Useful
       *  if the bot should use part of the comment it is replying to in it's reponse.
       *  REQUIRED for 'function', ignored for 'random' and 'sequential'
       *  @returns {string} (or a serialisable variable) 
       */
      function: async (comment)=>{} 

      header: '' // String to open comments with. Remeber to add \n\n at the end if you want your generated content on a new line
      footer: '' // String to close comments with. Remeber to add \n\n at the start if you want your generated content seperate from the footer

      /* number of minutes to wait after a successful comment before commenting again.
       * This is configured per listener, so the bot may respond on different triggers within this time
       * HIGHLY RECCOMMENDED: Do not drop this value too low, as this will 
       *   likely annoy the mods of your subreddits and have your bot banned.
       * ALSO HIGHLY RECCOMENDED: Mention the rate limiting in your bot footer, this will reduce the amount
       *   of people attempting to repeatedly trigger the bot, causing spam
       * Defaults to 10 minutes
       */
      cooldown: 10 

      /* phrase or phrases bot is listening for. For array, any matches is considered a match.
       * Accepts a string, regex or array of either
       * HIGHLY RECCOMENDED: Make the value(s) relatively unique. using /u/{botName} is a good option, then
       *   the bot will only appear when summoned. Using something like 'the' is a great way to get your bot 
       *   banned very rapidly.
       */
      triggerPhrase: '' || [] || /^.$/ // 
      triggerCaseSensitive: false // should the capitalisation of the trigger word match? defaults to false

      /* Custom functions that allow for more nuanced tests for when the bot should reply
       * For example, you could have it never reply to a particular user, only between certain hours,
       * or only if the comment matches a particular regex.
       * The comment must pass ALL provided predicates in order to be responded to.
       */
      customPredicates:[
        async (comment)=>{ return true||false }
      ]
    }
  }
}

```


## Customisation Functions
The `customPredicates` Array and the `function` listener type allow user-provided functions to enhance bot capability.
The provided function MUST:
 * Expect the first and only argument to be a [Snoowrap.Comment](https://github.com/not-an-aardvark/snoowrap) object
 * be an async function

### The Snoowrap.Comment object
The comment object has many sub attributes, such as author, body, upvotes, controvertiality. See [Snoowrap](https://github.com/not-an-aardvark/snoowrap) for more details. 

The important point is that snoowrap was designed for chaining function calls, but that isn't really that helpful for a comment responder bot.

Best way to use the comment object is to use `await` whenever you access an attribute of the comment, to prevent gotchas such as:
```javascript
const isUserMe = async (comment) => {
  if (comment.author.name === 'my_username'){
    // always false, as comment.author.name will be Promise<Pending> not yet a value
  }
}

const isUserMe = async (comment) => {
  if ((await comment.author.name) === 'my_username'){
    // should work as expected
  }
}

```

## Example using customisation functions
```javascript
const bot = AutoSnoo.create({
  snoowrapOpts: {
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    username: process.env.REDDIT_USERNAME,
    password: process.env.REDDIT_PASSWORD,
  },
  subreddits: process.env.SUBREDDIT,
  debug: !!process.env.DEBUG,
  listeners: {
    dieRoll: {
      responseType: 'random',
      corpus: [
        '1',
        '2',
        '3',
        '4',
        '5',
        '6'
      ],
      header: '*clatter clatter*\n\n',
      footer: "\n\n^(I'm a simple bot for rolling d6s!)",
      triggerPhrase: '!!d6',
      customPredicates: [
        // increased specificity for what the comment must contain.
        async comment => (await comment.body).startsWith('.'), // not particularly useful, just example of syntax
        async comment => (await comment.body).endsWith('?'),
      ],
      cooldown: 15
    },
    echo: {
      // 
      triggerPhrase: `/u/${process.env.REDDIT_USERNAME}`,
      footer: '\n\nshut up',
      responseType: 'function',
      function: async comment => `> ${(await comment.body)}`,
      customPredicates: [
        // Only reply if the parent to the comment is not the bot
        async (comment) => {
          const commentParent = await AutoSnoo.getParentComment(comment); // use parentComment util
          // Could also call AutoSnoo.getParentComment(commentParent) if more context is needed,
          // or use AutoSnoo.getCommentChain(comment) if whole context is required
          // 
          return (await commentParent.author.name) !== process.env.REDDIT_USERNAME;
        },
      ],
      cooldown: 5 // 'echo' and 'dieRoll' will have independent timers
    },
  },
});

//Start the Bot
bot.listen();
```
