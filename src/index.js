const Snoowrap = require('snoowrap');
const Snoostorm = require('snoostorm');
const { version } = require('../package.json');

const Listener = require('./utils/Listener');
const utils = require('./utils/redditUtils');

class AutoSnoo {
  /**
   *
   * @param {Object} options
   * @param {boolean} options.debug debug toggle
   * @param {String|Array} options.subreddits Subreddits to listen to
   * @param {Object} options.snoowrapOpts Options for snoowrap to connect to Reddit API
   * @param {String} options.snoowrapOpts.clientId
   * @param {String} options.snoowrapOpts.clientSecret
   * @param {String} options.snoowrapOpts.username
   * @param {String} options.snoowrapOpts.password
   * @param {Object} options.listeners See Readme for format
   */
  constructor(options) {
    this.initTime = Date.now();
    this.debug = options.debug || false;
    this.subreddits = options.subreddits;

    if (!options.snoowrapOpts) {
      // eslint-disable-next-line max-len
      throw Error('AutoSnoo requires snoowrapOpts containing clientId, secretId, and the reddit bot\'s username and password');
    }
    this.snoowrapOpts = options.snoowrapOpts;
    this.snoowrapOpts.userAgent = `Auto-snoo/${version} (Node ${process.version})`;
    this.client = new Snoowrap(this.snoowrapOpts);

    this.listeners = Object.entries(options.listeners).map(
      ([name, listenerOpts]) => new Listener({
        name,
        initTime: this.initTime,
        botUsername: this.snoowrapOpts.username,
        debug: this.debug,
        ...listenerOpts,
      }),
    );
  }

  listen() {
    let multireddit;
    if (this.subreddits instanceof Array) {
      multireddit = this.subreddits.join('+');
    } else if (typeof this.subreddits === 'string' || this.subreddits instanceof String) {
      multireddit = this.subreddits;
    } else {
      throw Error('options.subreddits should be String or Array of strings');
    }
    const commentStream = new Snoostorm.CommentStream(this.client, { subreddit: multireddit });

    commentStream.on('item', async (comment) => {
      this.listeners.forEach((listener) => {
        listener.run(comment);
      });
    });
  }

  async getParentComment(comment) {
    return utils.getParentComment(this.client, comment);
  }

  async getCommentChain(comment) {
    return utils.getCommentChain(this.client, comment);
  }
}

let instance;

/**
 *
 * @param {Object} options
 * @param {boolean} options.debug debug toggle
 * @param {String|Array} options.subreddits Subreddits to listen to
 * @param {Object} options.snoowrapOpts Options for snoowrap to connect to Reddit API
 * @param {String} options.snoowrapOpts.clientId
 * @param {String} options.snoowrapOpts.clientSecret
 * @param {String} options.snoowrapOpts.username
 * @param {String} options.snoowrapOpts.password
 * @param {Object} options.listeners See Readme for format
 * @returns {AutoSnoo} instance
 */
const create = (options) => {
  instance = new AutoSnoo(options);
  return instance;
};

const get = () => {
  if (!instance) {
    throw Error('You must first create an instance using AutoSnoo.create({opts})');
  }
  return instance;
};

const getParentComment = async (comment) => {
  const inst = get();
  return inst.getParentComment(comment);
};

const getCommentChain = async (comment) => {
  const inst = get();
  return inst.getCommentChain(comment);
};

module.exports = {
  get,
  create,
  getParentComment,
  getCommentChain,
};
