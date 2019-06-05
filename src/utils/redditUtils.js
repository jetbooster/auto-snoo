
/**
 * Obtain a comment's parent
 * @param {Snoowrap} r Snoowrap instance to use for retrieving comments
 * @param {Snoowrap.Comment} comment
 * @param {boolean} [onlyComments=true]
 * @return {Snoowrap.Comment} a snoowrap comment
 */
const getParentComment = async (r, comment, onlyComments = true) => {
  const parentId = await comment.parent_id;
  if (onlyComments && !parentId.startsWith('t1')) {
    // Only want comments, parent is not a comment
    return undefined;
  }
  const parentComment = await r.getComment(parentId);
  return parentComment;
};

/**
 * Take a comment and recursively build a simple object for all it's parents up to the top of the thread
 * @param {Snoowrap} r Snoowrap instance to use for retrieving comments
 * @param {Snoowrap.Comment} comment
 * @param {Array} array comments found so far
 * @return {Array}
 */
const getCommentChain = async (r, comment, array = []) => {
  const basicComment = await {
    id: await comment.id,
    parent_id: await comment.parent_id,
    author: await (await comment.author).name,
    body: await comment.body,
  };

  array.push(basicComment);

  const parent = await getParentComment(r, comment);
  if (parent) {
    return getCommentChain(r, parent, array);
  }
  return array;
};

const containsTriggerWord = async (comment, trigger, caseSensitive) => {
  const commentBody = await comment.body;
  let containsAnyTriggers = false;
  if (trigger instanceof Array) {
    // match on any of the trigger phrases in the array
    containsAnyTriggers = trigger.some((value) => {
      if (caseSensitive) {
        return commentBody.includes(value);
      }
      return commentBody.toLowerCase().includes(value.toLowerCase());
    });
  } else if (typeof trigger === 'string') {
    if (caseSensitive) {
      containsAnyTriggers = commentBody.includes(trigger);
    } else {
      containsAnyTriggers = commentBody.toLowerCase().includes(trigger.toLowerCase());
    }
  } else {
    throw Error('Trigger Phrase must be string or array of strings');
  }
  return containsAnyTriggers;
};

module.exports = {
  getCommentChain,
  getParentComment,
  containsTriggerWord,
};
