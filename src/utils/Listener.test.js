const Listener = require('./Listener');
const utils = require('./redditUtils');

jest.mock('./redditUtils.js', () => ({
  containsTriggerWord: jest.fn(),
}));

const sleep = millis => new Promise(res => setTimeout(res, millis));

const slowGet = async (result) => {
  await sleep(100); // force module to correctly handle an async function
  return result;
};

const mockComment = (id, parentId, body, author) => ({
  get parent_id() {
    return slowGet(parentId || 't1_parent');
  },
  get id() {
    return slowGet(id || 't1_myself');
  },
  get body() {
    return slowGet(body || 'Lorem Ipsum');
  },
  get author() {
    return slowGet({
      get name() {
        return slowGet(author || 'myName');
      },
    });
  },
  get created_utc() {
    return slowGet(Math.floor(Date.now() / 1000));
  },
});


describe('Listener', () => {
  describe('initialises', () => {
    it('all optional arguments correctly', () => {
      const listener = new Listener({
        name: 'listenerName',
        initTime: Date.now(),
        debug: false,
        botUsername: 'mockBot',
        triggerPhrase: 'test',
        corpus: [],
      });
      expect(listener.header).toEqual('');
      expect(listener.footer).toEqual('');
      expect(listener.cooldown).toEqual(10);
      expect(listener.responseType).toEqual('random');
      expect(listener.triggerCaseSensitive).toEqual(false);
      expect(listener.lastCommented).toBeNull();
    });
    it('a sequential Listener', () => {
      const listener = new Listener({
        name: 'listenerName',
        initTime: Date.now(),
        debug: false,
        botUsername: 'mockBot',
        triggerPhrase: 'test',
        corpus: [],
        responseType: 'sequential',
      });
      expect(listener.index).toEqual(0);
    });
    it('a function Listener', () => {
      const func = () => {};
      const listener = new Listener({
        name: 'listenerName',
        initTime: Date.now(),
        debug: false,
        botUsername: 'mockBot',
        triggerPhrase: 'test',
        function: func,
        responseType: 'function',
      });
      expect(listener.function).toEqual(func);
    });
  });

  describe('throws', () => {
    it('when no botUsername provided', () => {
      expect(() => new Listener({
        name: 'listenerName',
        initTime: Date.now(),
        debug: false,
        triggerPhrase: 'test',
        corpus: [],
      })).toThrow(Error('Listener:listenerName - Listeners must know username of bot to prevent replying to itself'));
    });
    it('when no triggerphrase provided', () => {
      expect(() => new Listener({
        name: 'listenerName',
        initTime: Date.now(),
        botUsername: 'mockBot',
        debug: false,
        corpus: [],
        // eslint-disable-next-line max-len
      })).toThrow(Error('Listener:listenerName - Listeners require a provided trigger phrase or array of triggerphrases'));
    });
    it('when no corpus provided (random)', () => {
      expect(() => new Listener({
        name: 'listenerName',
        initTime: Date.now(),
        botUsername: 'mockBot',
        debug: false,
        triggerPhrase: 'test',
      })).toThrow(Error('Listener:listenerName - Random and sequential Listeners require a provided corpus attribute'));
    });
    it('when no corpus provided (sequential)', () => {
      expect(() => new Listener({
        name: 'listenerName',
        initTime: Date.now(),
        botUsername: 'mockBot',
        debug: false,
        triggerPhrase: 'test',
        responseType: 'sequential',
      })).toThrow(Error('Listener:listenerName - Random and sequential Listeners require a provided corpus attribute'));
    });
    it('when no function provided (function)', () => {
      expect(() => new Listener({
        name: 'listenerName',
        initTime: Date.now(),
        botUsername: 'mockBot',
        debug: false,
        triggerPhrase: 'test',
        responseType: 'function',
      })).toThrow(Error('Listener:listenerName - Function Listeners require a provided function attribute'));
    });
    it('when unrecognised responseType', () => {
      expect(() => new Listener({
        name: 'listenerName',
        initTime: Date.now(),
        botUsername: 'mockBot',
        debug: false,
        triggerPhrase: 'test',
        responseType: 'blah',
      })).toThrow(Error('Listener:listenerName - Invalid responseType: options are random, sequential, or function'));
    });
  });

  describe('shouldComment', () => {
    it('returns true when all default predicates met', async () => {
      const listener = new Listener({
        name: 'listenerName',
        initTime: Date.now() - (1000 * 60), // simulate started one minute ago
        debug: true,
        botUsername: 'mockBot',
        triggerPhrase: 'test',
        corpus: [],
      });
      utils.containsTriggerWord.mockImplementationOnce(() => true);
      const result = await listener.shouldComment(mockComment());
      expect(result).toEqual(true);
    });

    it('returns false when has already commented less than cooldown minutes ago', async () => {
      const listener = new Listener({
        name: 'listenerName',
        initTime: Date.now() - (1000 * 60), // simulate started one minute ago
        debug: true,
        cooldown: 2,
        botUsername: 'mockBot',
        triggerPhrase: 'test',
        corpus: [],
      });
      listener.lastCommented = Date.now() - (1000 * 60);
      const result = await listener.shouldComment(mockComment());
      expect(result).toEqual(false);
    });

    it('ignores cooldown if cooldown=0', async () => {
      const listener = new Listener({
        name: 'listenerName',
        initTime: Date.now() - (1000 * 60), // simulate started one minute ago
        debug: true,
        cooldown: 0,
        botUsername: 'mockBot',
        triggerPhrase: 'test',
        corpus: [],
      });
      listener.lastCommented = Date.now();
      utils.containsTriggerWord.mockImplementationOnce(() => true);
      const result = await listener.shouldComment(mockComment());
      expect(result).toEqual(true);
    });

    it('returns false when comment was in the past', async () => {
      const listener = new Listener({
        name: 'listenerName',
        initTime: Date.now() + (1000 * 60),
        debug: true,
        botUsername: 'mockBot',
        triggerPhrase: 'test',
        corpus: [],
      });
      const result = await listener.shouldComment(mockComment());
      expect(result).toEqual(false);
    });

    it('returns false when comment was by the bot', async () => {
      const listener = new Listener({
        name: 'listenerName',
        initTime: Date.now() - (1000 * 60), // simulate started one minute ago
        debug: true,
        botUsername: 'myName',
        triggerPhrase: 'test',
        corpus: [],
      });
      const result = await listener.shouldComment(mockComment());
      expect(result).toEqual(false);
    });

    it('returns false when comment did not contain trigger phrase', async () => {
      const listener = new Listener({
        name: 'listenerName',
        initTime: Date.now() - (1000 * 60), // simulate started one minute ago
        debug: true,
        botUsername: 'mockBot',
        triggerPhrase: 'test',
        corpus: [],
      });
      utils.containsTriggerWord.mockImplementationOnce(() => false);
      const result = await listener.shouldComment(mockComment());
      expect(result).toEqual(false);
    });

    it('returns false when at least one custom predicate fails', async () => {
      const listener = new Listener({
        name: 'listenerName',
        initTime: Date.now() - (1000 * 60), // simulate started one minute ago
        debug: true,
        botUsername: 'mockBot',
        triggerPhrase: 'test',
        corpus: [],
        customPredicates: [
          async () => true,
          async () => false,
        ],
      });
      utils.containsTriggerWord.mockImplementationOnce(() => true);
      const result = await listener.shouldComment(mockComment());
      expect(result).toEqual(false);
    });

    it('returns true when all custom predicates pass', async () => {
      const listener = new Listener({
        name: 'listenerName',
        initTime: Date.now() - (1000 * 60), // simulate started one minute ago
        debug: true,
        botUsername: 'mockBot',
        triggerPhrase: 'test',
        corpus: [],
        customPredicates: [
          async () => true,
          async () => true,
        ],
      });
      utils.containsTriggerWord.mockImplementationOnce(() => true);
      const result = await listener.shouldComment(mockComment());
      expect(result).toEqual(true);
    });

    // Appease the branch coverage gods by repeating all tests with debug off
    it('returns true when all default predicates met', async () => {
      const listener = new Listener({
        name: 'listenerName',
        initTime: Date.now() - (1000 * 60), // simulate started one minute ago
        debug: false,
        botUsername: 'mockBot',
        triggerPhrase: 'test',
        corpus: [],
      });
      utils.containsTriggerWord.mockImplementationOnce(() => true);
      const result = await listener.shouldComment(mockComment());
      expect(result).toEqual(true);
    });

    it('returns false when has already commented less than cooldown minutes ago', async () => {
      const listener = new Listener({
        name: 'listenerName',
        initTime: Date.now() - (1000 * 60), // simulate started one minute ago
        debug: false,
        cooldown: 2,
        botUsername: 'mockBot',
        triggerPhrase: 'test',
        corpus: [],
      });
      listener.lastCommented = Date.now() - (1000 * 60);
      const result = await listener.shouldComment(mockComment());
      expect(result).toEqual(false);
    });

    it('ignores cooldown if cooldown=0', async () => {
      const listener = new Listener({
        name: 'listenerName',
        initTime: Date.now() - (1000 * 60), // simulate started one minute ago
        debug: false,
        cooldown: 0,
        botUsername: 'mockBot',
        triggerPhrase: 'test',
        corpus: [],
      });
      listener.lastCommented = Date.now();
      utils.containsTriggerWord.mockImplementationOnce(() => true);
      const result = await listener.shouldComment(mockComment());
      expect(result).toEqual(true);
    });

    it('returns false when comment was in the past', async () => {
      const listener = new Listener({
        name: 'listenerName',
        initTime: Date.now() + (1000 * 60),
        debug: false,
        botUsername: 'mockBot',
        triggerPhrase: 'test',
        corpus: [],
      });
      const result = await listener.shouldComment(mockComment());
      expect(result).toEqual(false);
    });

    it('returns false when comment was by the bot', async () => {
      const listener = new Listener({
        name: 'listenerName',
        initTime: Date.now() - (1000 * 60), // simulate started one minute ago
        debug: false,
        botUsername: 'myName',
        triggerPhrase: 'test',
        corpus: [],
      });
      const result = await listener.shouldComment(mockComment());
      expect(result).toEqual(false);
    });

    it('returns false when comment did not contain trigger phrase', async () => {
      const listener = new Listener({
        name: 'listenerName',
        initTime: Date.now() - (1000 * 60), // simulate started one minute ago
        debug: false,
        botUsername: 'mockBot',
        triggerPhrase: 'test',
        corpus: [],
      });
      utils.containsTriggerWord.mockImplementationOnce(() => false);
      const result = await listener.shouldComment(mockComment());
      expect(result).toEqual(false);
    });

    it('returns false when at least one custom predicate fails', async () => {
      const listener = new Listener({
        name: 'listenerName',
        initTime: Date.now() - (1000 * 60), // simulate started one minute ago
        debug: false,
        botUsername: 'mockBot',
        triggerPhrase: 'test',
        corpus: [],
        customPredicates: [
          async () => true,
          async () => false,
        ],
      });
      utils.containsTriggerWord.mockImplementationOnce(() => true);
      const result = await listener.shouldComment(mockComment());
      expect(result).toEqual(false);
    });

    it('returns true when all custom predicates pass', async () => {
      const listener = new Listener({
        name: 'listenerName',
        initTime: Date.now() - (1000 * 60), // simulate started one minute ago
        debug: false,
        botUsername: 'mockBot',
        triggerPhrase: 'test',
        corpus: [],
        customPredicates: [
          async () => true,
          async () => true,
        ],
      });
      utils.containsTriggerWord.mockImplementationOnce(() => true);
      const result = await listener.shouldComment(mockComment());
      expect(result).toEqual(true);
    });
  });

  describe('generateReply', () => {
    it('generates a random reply', async () => {
      const listener = new Listener({
        name: 'listenerName',
        initTime: Date.now() - (1000 * 60), // simulate started one minute ago
        debug: false,
        botUsername: 'mockBot',
        header: 'random:',
        triggerPhrase: 'test',
        corpus: ['a', 'b', 'c'],
      });
      jest.spyOn(Math, 'random');
      Math.random.mockImplementationOnce(() => 0.01);
      Math.random.mockImplementationOnce(() => 0.99);
      Math.random.mockImplementationOnce(() => 0.5);
      let reply = await listener.generateReply(mockComment());
      expect(reply).toEqual('random:a');
      reply = await listener.generateReply(mockComment());
      expect(reply).toEqual('random:c');
      reply = await listener.generateReply(mockComment());
      expect(reply).toEqual('random:b');
      expect(Math.random).toHaveBeenCalledTimes(3);
    });
    it('generates a sequential reply', async () => {
      const listener = new Listener({
        name: 'listenerName',
        initTime: Date.now() - (1000 * 60), // simulate started one minute ago
        debug: true,
        botUsername: 'mockBot',
        footer: ':sequential',
        triggerPhrase: 'test',
        corpus: ['a', 'b', 'c'],
        responseType: 'sequential',
      });
      let reply = await listener.generateReply(mockComment());
      expect(reply).toEqual('a:sequential');
      reply = await listener.generateReply(mockComment());
      expect(reply).toEqual('b:sequential');
      reply = await listener.generateReply(mockComment());
      expect(reply).toEqual('c:sequential');
      reply = await listener.generateReply(mockComment());
      expect(reply).toEqual('a:sequential');
      reply = await listener.generateReply(mockComment());
      expect(reply).toEqual('b:sequential');
    });
    it('generates a function reply', async () => {
      const listener = new Listener({
        name: 'listenerName',
        initTime: Date.now() - (1000 * 60), // simulate started one minute ago
        debug: true,
        botUsername: 'mockBot',
        header: 'abc\n\n',
        footer: '\n\nxyz',
        triggerPhrase: 'test',
        function: async comment => `${await comment.id}some extra random text`,
        responseType: 'function',
      });
      const reply = await listener.generateReply(mockComment());
      expect(reply).toEqual('abc\n\nt1_myselfsome extra random text\n\nxyz');
    });
  });
  describe('run', () => {
    it('...runs', async () => {
      const listener = new Listener({
        name: 'listenerName',
        initTime: Date.now() - (1000 * 60), // simulate started one minute ago
        debug: true,
        botUsername: 'mockBot',
        triggerPhrase: 'test',
        corpus: [],
      });
      const comment = {
        reply: jest.fn(),
      };
      listener.shouldComment = async () => true;
      listener.generateReply = async () => 'reply';
      await listener.run(comment);
      expect(comment.reply).toHaveBeenCalledWith('reply');
    });
    it('does nothing on shouldComment=false', async () => {
      const listener = new Listener({
        name: 'listenerName',
        initTime: Date.now() - (1000 * 60), // simulate started one minute ago
        debug: false,
        botUsername: 'mockBot',
        triggerPhrase: 'test',
        corpus: [],
      });
      const comment = {
        reply: jest.fn(),
      };
      listener.shouldComment = async () => false;
      await listener.run(comment);
      expect(comment.reply).not.toHaveBeenCalled();
    });
  });
});
