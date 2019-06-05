const { containsTriggerWord } = require('./redditUtils');

class Listener {
  constructor(options) {
    this.name = options.name;
    this.initTime = options.initTime;
    this.debug = options.debug;
    this.header = options.header || '';
    this.footer = options.footer || '';
    // 0 is falsy, 'options.cooldown || 10' would prevent setting a timout of zero
    this.cooldown = options.cooldown || typeof options.cooldown === 'number' ? options.cooldown : 10;
    this.customPredicates = options.customPredicates;
    this.responseType = options.responseType || 'random';

    // eslint-disable-next-line max-len
    if (!options.botUsername) throw Error(`Listener:${this.name} - Listener must know username of bot to prevent replying to itself`);
    this.botUsername = options.botUsername;

    this.lastCommented = null;

    // eslint-disable-next-line max-len
    if (!options.triggerPhrase) throw Error(`Listener:${this.name} - Listeners require a provided trigger phrase or array of triggerphrases`);
    this.triggerPhrase = options.triggerPhrase;
    this.triggerCaseSensitive = options.triggerCaseSensitive || false;

    switch (this.responseType) {
      case 'sequential':
        // eslint-disable-next-line max-len
        if (!options.corpus) throw Error(`Listener:${this.name} - Random and sequential Listeners require a provided corpus attribute`);
        this.corpus = options.corpus;
        this.index = 0;
        break;
      case 'random':
        // eslint-disable-next-line max-len
        if (!options.corpus) throw Error(`Listener:${this.name} - Random and sequential Listeners require a provided corpus attribute`);
        this.corpus = options.corpus;
        break;
      case 'function':
        // eslint-disable-next-line max-len
        if (!options.function) throw Error(`Listener:${this.name} - Function Listeners require a provided function attribute`);
        this.function = options.function;
        break;
      default:
        throw Error(`Listener:${this.name} - Invalid responseType: options are random, sequential, or function`);
    }
  }

  /**
   *
   * @param {Snoowrap.Comment} comment
   */
  async shouldComment(comment) {
    if (this.lastCommented && !(Date.now() >= (this.lastCommented + (1000 * 60 * this.cooldown)))) {
      // cooldown not over
      // perform cooldown check first as it requires no querying of the comment content
      if (this.debug) {
        // eslint-disable-next-line max-len
        console.log(`Listener:${this.name} - Not commenting because still on cooldown. Now: ${Date.now()}, lastCommented+cooldown: ${this.lastCommented + 1000 * 60 * this.cooldown}`);
      }
      return false;
    }
    if ((await comment.created_utc) * 1000 < this.initTime) {
      // comment was made before this instance of bot came online. Ignore to avoid double replying older messages
      if (this.debug) {
        console.log(`Listener:${this.name} - Not commenting because Comment was in the past`);
      }
      return false;
    }

    const authorName = await (await comment.author).name;
    if (authorName === this.botUsername) {
      // Do not reply to comments made by the bot, to avoid potential for infinite loops
      if (this.debug) {
        console.log(`Listener:${this.name} - Not commenting because would be reply to self`);
      }
      return false;
    }
    const triggerHit = await containsTriggerWord(comment, this.triggerPhrase, this.triggerCaseSensitive);
    if (!triggerHit) {
      if (this.debug) {
        console.log(`Listener:${this.name} - Not commenting because no trigger word`);
      }
      return false;
    }

    if (this.customPredicates) {
      // If custom predicates have been provided, make sure all of them pass
      const results = await Promise.all(this.customPredicates.map(predicate => predicate(comment)));
      if (this.debug) {
        // TODO add some sort of logger
        console.log(`Listener:${this.name} - Reached custom predicates. Result: ${JSON.stringify(results)}`);
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
      console.log(`Listener:${this.name} - Generated reply comment: body: ${commentBody}`);
    }
    return fullComment;
  }

  async run(comment) {
    if (this.debug) {
      console.log(`Listener:${this.name} - Running listener`);
    }
    if (await this.shouldComment(comment)) {
      console.log(`Listener:${this.name} - Sucessfully triggered, responding`);
      comment.reply(await this.generateReply(comment));
      this.lastCommented = Date.now();
    }
  }
}

module.exports = Listener;
