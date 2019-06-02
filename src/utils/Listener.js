const { containsTriggerWord } = require('./redditUtils');

class Listener {
  constructor(options) {
    this.name = options.name;
    this.initTime = options.initTime;
    this.debug = options.debug;
    this.header = options.header || '';
    this.footer = options.footer || '';
    this.cooldown = options.cooldown || 10; // 10 min default cooldown
    this.customPredicates = options.customPredicates;
    this.responseType = options.responseType || 'random';

    if (!options.botUsername) throw Error('Listener must know username of bot to prevent replying to itself');
    this.botUsername = options.botUsername;

    this.lastCommented = null;

    if (!options.triggerPhrase) throw Error('Listeners require a provided trigger phrase or array of triggerphrases');
    this.triggerPhrase = options.triggerPhrase;
    this.triggerCaseSensitive = options.triggerCaseSensitive || false;

    switch (this.responseType) {
      case 'sequential':
        if (!options.corpus) throw Error('Random and sequential Listeners require a provided corpus attribute');
        this.corpus = options.corpus;
        this.index = 0;
        break;
      case 'random':
        if (!options.corpus) throw Error('Random and sequential Listeners require a provided corpus attribute');
        this.corpus = options.corpus;
        break;
      case 'function':
        if (!options.function) throw Error('Function Listeners require a provided function attribute');
        this.function = options.function;
        break;
      default:
        throw Error('Invalid responseType: options are random, sequential, or function');
    }
  }

  /**
   *
   * @param {Snoowrap.Comment} comment
   */
  async shouldComment(comment) {
    if (this.lastCommented && !(Date.now() > this.lastCommented + 1000 * 60 * this.cooldown)) {
      // cooldown not over
      // perform cooldown check first as it requires no querying of the comment content
      if (this.debug) {
        // eslint-disable-next-line max-len
        console.log(`Not commenting because still on cooldown. Now: ${Date.now()}, lastCommented+cooldown: ${this.lastCommented + 1000 * 60 * this.cooldown}`);
      }
      return false;
    }
    if ((await comment.created_utc) * 1000 < this.initTime) {
      // comment was made before this instance of bot came online. Ignore to avoid double replying older messages
      if (this.debug) {
        console.log('Not commenting because Comment was in the past');
      }
      return false;
    }
    const authorName = await comment.author.name;
    if (authorName === this.botUsername) {
      // Do not reply to comments made by the bot, to avoid potential for infinite loops
      if (this.debug) {
        console.log('Not commenting because would be reply to self');
      }
      return false;
    }
    const triggerHit = await containsTriggerWord(comment, this.triggerPhrase, this.triggerCaseSensitive);
    if (!triggerHit) {
      if (this.debug) {
        console.log('Not commenting because no trigger word');
      }
      return false;
    }

    if (this.customPredicates) {
      // If custom predicates have been provided, make sure all of them pass
      const results = await Promise.all(this.customPredicates.map(predicate => predicate(comment)));
      if (this.debug) {
        // TODO add some sort of logger
        console.log(`Reached custom predicates. Result: ${JSON.stringify(results)}`);
      }
      return results.every(result => result);
    }
    return true;
  }

  async generateReply(comment) {
    let commentBody;
    switch (this.responseType) {
      default:
      case 'random': {
        const index = Math.floor(this.corpus.length * Math.random());
        commentBody = this.corpus[index];
        break;
      }
      case 'sequential': {
        if (this.index > this.corpus.length - 1) {
          this.index %= this.corpus.length;
        }
        commentBody = this.corpus[this.index];
        this.index += 1;
        break;
      }
      case 'function': {
        commentBody = await this.function(comment);
      }
    }
    const fullComment = `${this.header}${commentBody}${this.footer}`;
    if (this.debug) {
      console.log(`Generated reply comment: body: ${commentBody}`);
    }
    return fullComment;
  }

  async run(comment) {
    if (this.debug) {
      console.log(`Running listener: ${this.name}`);
    }
    if (await this.shouldComment(comment)) {
      try {
        console.log(`Attempting to respond to a trigger for Listener:${this.name}`);
        comment.reply(await this.generateReply(comment));
        this.lastCommented = Date.now();
      } catch (e) {
        // Useless catch so that this.lastCommented only updates on success
        throw e;
      }
    }
  }
}

module.exports = Listener;
