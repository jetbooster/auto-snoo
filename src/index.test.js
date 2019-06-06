const Snoowrap = require('snoowrap');
const Snoostorm = require('snoostorm');
const index = require('./index');
const Listener = require('./utils/Listener');


jest.mock('snoowrap');
jest.mock('snoostorm');
jest.mock('./utils/Listener.js');
jest.mock('./utils/redditUtils.js');

describe('Index', () => {
  it('cover as many paths in first pass', async () => {
    // AutoSnoo instance expectations
    expect(() => index.get()).toThrow(Error('You must first create an instance using AutoSnoo.create({opts})'));
    const instance = index.create({
      snoowrapOpts: {
        clientId: 'abc',
        clientSecret: 'def',
        username: 'mockBot',
        password: 'hunter2',
        mock: 'options',
      },
      subreddits: ['a', 'b'],
      listeners: {
        example: {
          additional: 'listener',
          options: {
            etc: 'etc',
          },
        },
      },
    });
    const AutoSnooInstance = index.get();
    expect(AutoSnooInstance).not.toBeUndefined();

    // Snoowrap expectations
    expect(Snoowrap).toHaveBeenCalledWith({
      clientId: 'abc',
      clientSecret: 'def',
      username: 'mockBot',
      password: 'hunter2',
      userAgent: expect.any(String),
      mock: 'options',
    });

    // Listener expectations
    expect(Listener).toHaveBeenCalledTimes(1);
    expect(Listener).toHaveBeenCalledWith({
      initTime: expect.any(Number),
      name: 'example',
      botUsername: 'mockBot',
      additional: 'listener',
      debug: false,
      options: {
        etc: 'etc',
      },
    });

    // CommentStream expectations
    const commentStream = instance.listen();
    expect(Snoostorm.CommentStream).toHaveBeenCalledWith(expect.any(Snoowrap), { subreddit: 'a+b' });

    // Default jest mocking mocks out the .on function, so a .emit will not trigger any attached .on functions.
    // However...
    //    ...Observe.
    expect(commentStream.on).toHaveBeenCalled();
    const dotOnCalledWith = commentStream.on.mock.calls[0];
    expect(dotOnCalledWith).toEqual(['item', expect.any(Function)]);

    const funcCalledOnEmit = dotOnCalledWith[1];
    funcCalledOnEmit({ comment: 'object' });
    expect(Listener.mock.instances[0].run).toHaveBeenCalledWith({ comment: 'object' });

    // Util function expectations
    const getParentCommentSpy = jest.spyOn(AutoSnooInstance, 'getParentComment');
    index.getParentComment({ comment: 'object' });
    expect(getParentCommentSpy).toHaveBeenCalledWith({ comment: 'object' });

    const getCommentChainSpy = jest.spyOn(AutoSnooInstance, 'getCommentChain');
    index.getCommentChain({ comment: 'object' });
    expect(getCommentChainSpy).toHaveBeenCalledWith({ comment: 'object' });
  });

  it('Catches listener Errors', () => {
    const instance = index.create({
      snoowrapOpts: {
        clientId: 'abc',
        clientSecret: 'def',
        username: 'mockBot',
        password: 'hunter2',
        mock: 'options',
      },
      subreddits: ['a', 'b'],
      listeners: {
        example: {
          additional: 'listener',
          options: {
            etc: 'etc',
          },
        },
      },
    });

    // CommentStream expectations
    const commentStream = instance.listen();
    expect(Snoostorm.CommentStream).toHaveBeenCalledWith(expect.any(Snoowrap), { subreddit: 'a+b' });

    expect(commentStream.on).toHaveBeenCalled();
    const dotOnCalledWith = commentStream.on.mock.calls[0];
    expect(dotOnCalledWith).toEqual(['item', expect.any(Function)]);

    const funcCalledOnEmit = dotOnCalledWith[1];
    const listenerRunFn = Listener.mock.instances[0].run;
    listenerRunFn.mockImplementationOnce(() => { throw Error('Bang!'); });
    jest.spyOn(console, 'log');
    funcCalledOnEmit({ comment: 'object' });
    expect(listenerRunFn).toHaveBeenCalledWith({ comment: 'object' });
    expect(console.log).toHaveBeenCalledWith('Error occurred with listener: Bang!');
  });

  it('works with a single subreddit', async () => {
    const instance = index.create({
      snoowrapOpts: {
        clientId: 'abc',
        clientSecret: 'def',
        username: 'mockBot',
        password: 'hunter2',
        mock: 'options',
        userAgent: 'optional user agent',
      },
      subreddits: 'a',
      listeners: {
        example: {
          additional: 'listener',
          options: {
            etc: 'etc',
          },
        },
      },
    });

    // Snoowrap expectations
    expect(Snoowrap).toHaveBeenCalledWith({
      clientId: 'abc',
      clientSecret: 'def',
      username: 'mockBot',
      password: 'hunter2',
      userAgent: 'optional user agent',
      mock: 'options',
    });

    instance.listen();

    expect(Snoostorm.CommentStream).toHaveBeenCalledWith(expect.any(Snoowrap), { subreddit: 'a' });
  });

  it('fails on no subreddit', async () => {
    const instance = index.create({
      snoowrapOpts: {
        clientId: 'abc',
        clientSecret: 'def',
        username: 'mockBot',
        password: 'hunter2',
        mock: 'options',
      },
      listeners: {
        example: {
          additional: 'listener',
          options: {
            etc: 'etc',
          },
        },
      },
    });

    expect(() => instance.listen()).toThrow(Error('options.subreddits should be String or Array of strings'));
  });

  it('fails when snoowrap opts not supplied or insufficient', () => {
    expect(() => index.create({
      snoowrapOpts: {
        clientId: 'abc',
        clientSecret: 'def',
        username: 'mockBot',
        mock: 'options',
      },
    })).toThrow(
      // eslint-disable-next-line max-len, it's 122 characters damnit
      Error('AutoSnoo requires snoowrapOpts containing clientId, secretId, and the reddit bot\'s username and password'),
    );
  });
});
