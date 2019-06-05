const utils = require('./redditUtils');

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
});

const mockRedditClient = {
  getComment: jest.fn(async () => {
    await sleep(100);
    return mockComment('t1_parent', 't1_grandparent', 'Lorem Bacon', 'fathersName');
  }),
};

describe('Reddit Utils', () => {
  describe('getParentComment', () => {
    it('gets parent as expected', async () => {
      const parent = await utils.getParentComment(mockRedditClient, mockComment());
      expect(await parent.id).toEqual('t1_parent');

      // yes, this is the most efficient method. Yes it is horrible.
      expect(await (await parent.author).name).toEqual('fathersName');

      expect(await parent.parent_id).toEqual('t1_grandparent');
      expect(await parent.id).toEqual('t1_parent');
    });

    it('returns undefined when parent is not a comment (ie, the comment is top level)', async () => {
      const parent = await utils.getParentComment(mockRedditClient, mockComment('t1_me', 't3_thethread'));
      expect(parent).toBeUndefined();
    });

    // onlyComments=false is never used currently, but make sure we don't accidentally break it
    it('returns parent even when not comment if onlyComments is false', async () => {
      const parent = await utils.getParentComment(mockRedditClient, mockComment('t1_me', 't3_thethread'), false);
      expect(await parent.id).toEqual('t1_parent');
      expect(await (await parent.author).name).toEqual('fathersName');
      expect(await parent.parent_id).toEqual('t1_grandparent');
      expect(await parent.id).toEqual('t1_parent');
    });
  });
});
