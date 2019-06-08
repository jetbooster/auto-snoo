import Snoowrap, { Comment } from "snoowrap";
import { BasicComment, TriggerPhrase } from "../types/misc";

// @ts-ignore
export const getParentComment = async (
  r: Snoowrap,
  comment: Comment,
  onlyComments = true
): Promise<Comment | undefined> => {
  const parentId = await comment.parent_id;
  if (onlyComments && !parentId.startsWith("t1")) {
    // Only want comments, parent is not a comment
    return undefined;
  }
  // @ts-ignore
  const parentComment = await r.getComment(parentId);
  return parentComment;
};

export const getCommentChain = async (
  r: Snoowrap,
  comment: Comment,
  array: BasicComment[] = []
): Promise<BasicComment[]> => {
  const basicComment = await {
    id: await comment.id,
    // eslint-disable-next-line @typescript-eslint/camelcase
    parent_id: await comment.parent_id,
    // @ts-ignore
    author: await (await comment.author).name,
    body: await comment.body
  };

  array.push(basicComment);

  const parent = await getParentComment(r, comment);
  if (parent) {
    return getCommentChain(r, parent, array);
  }
  return array;
};

/**
 * RegExp does not support modifying flags of existing RegExp objects, so rebuild with ignore case if required
 * @param {RegExp} regex
 */
const recompileRegex = (regex: RegExp, caseSensitive?: boolean): RegExp => {
  if (regex.ignoreCase === !caseSensitive) {
    // regex already matches required caseSensitivity
    return regex;
  }
  if (!caseSensitive) {
    // Add ignore flag and return
    return new RegExp(regex.source, `${regex.flags}i`);
  }
  // Strip ignoreCase flag
  return new RegExp(regex.source, regex.flags.replace("i", ""));
};

export const containsTriggerWord = async (
  comment: Comment,
  trigger: TriggerPhrase,
  caseSensitive?: boolean
): Promise<boolean> => {
  const commentBody = await comment.body;
  let containsAnyTriggers = false;
  if (trigger instanceof Array) {
    // match on any of the trigger phrases in the array
    containsAnyTriggers = trigger.some((value): boolean => {
      if (value instanceof RegExp) {
        const regex = recompileRegex(value, caseSensitive);
        return regex.test(commentBody);
      }
      if (caseSensitive) {
        return commentBody.includes(value);
      }
      return commentBody.toLowerCase().includes(value.toLowerCase());
    });
  } else if (typeof trigger === "string") {
    if (caseSensitive) {
      containsAnyTriggers = commentBody.includes(trigger);
    } else {
      containsAnyTriggers = commentBody
        .toLowerCase()
        .includes(trigger.toLowerCase());
    }
  } else if (trigger instanceof RegExp) {
    const regex = recompileRegex(trigger, caseSensitive);
    containsAnyTriggers = regex.test(commentBody);
  } else {
    throw Error(
      "Trigger Phrase must be string or regex, or an array of the former"
    );
  }
  return containsAnyTriggers;
};

export default {
  getCommentChain,
  getParentComment,
  containsTriggerWord
};
