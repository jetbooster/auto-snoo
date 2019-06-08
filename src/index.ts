import { AutoSnooOptions } from "./types/configObjects";
import Snoowrap, { SnoowrapOptions, Comment } from "snoowrap";
import Listener, {
  BaseListener,
  RandomListener,
  FunctionListener
} from "./utils/Listener";
import utils from "./utils/redditUtils";
import { CommentStream } from "snoostorm";
import { SequentialListener } from "./types/listeners";
import { BasicComment } from "./types/misc";

// eslint-disable-next-line
const { version } = require("../package.json");

export class AutoSnoo {
  public initTime: Date;
  public debug: boolean;
  public subreddits: string | string[];
  public snoowrapOpts: SnoowrapOptions;
  public client: Snoowrap;
  public listeners: BaseListener[];
  public constructor(options: AutoSnooOptions) {
    this.initTime = new Date();
    this.debug = options.debug || false;
    this.subreddits = options.subreddits;

    if (
      !options.snoowrapOpts ||
      !options.snoowrapOpts.clientId ||
      !options.snoowrapOpts.clientSecret ||
      !options.snoowrapOpts.username ||
      !options.snoowrapOpts.password
    ) {
      throw Error(
        "AutoSnoo requires snoowrapOpts containing clientId, secretId, and the reddit bot's username and password"
      );
    }
    this.snoowrapOpts = options.snoowrapOpts;
    this.snoowrapOpts.userAgent =
      options.snoowrapOpts.userAgent ||
      `Auto-snoo/${version} (Node ${process.version})`;
    this.client = new Snoowrap(this.snoowrapOpts);

    // @ts-ignore
    this.listeners = Object.entries(options.listeners).map(
      ([name, listenerOpts]):
        | RandomListener
        | SequentialListener
        | FunctionListener =>
        // @ts-ignore
        Listener({
          name,
          initTime: this.initTime,
          botUsername: this.snoowrapOpts.username,
          debug: this.debug,
          ...listenerOpts
        })
    );
  }

  public listen(): CommentStream {
    let multireddit;
    if (this.subreddits instanceof Array) {
      multireddit = this.subreddits.join("+");
    } else if (typeof this.subreddits === "string") {
      multireddit = this.subreddits;
    } else {
      throw Error("options.subreddits should be String or Array of strings");
    }
    const commentStream = new CommentStream(this.client, {
      subreddit: multireddit
    });

    commentStream.on(
      "item",
      async (comment: Comment): Promise<void> => {
        this.listeners.forEach((listener): void => {
          try {
            listener.run(comment);
          } catch (e) {
            // TODO: add granular error handling - specifically for eating snoowrap timeout errors
            console.log(`Error occurred with listener: ${e.message}`);
          }
        });
      }
    );

    return commentStream;
  }

  // @ts-ignore
  public async getParentComment(
    comment: Comment
  ): Promise<Comment | undefined> {
    return utils.getParentComment(this.client, comment);
  }

  public async getCommentChain(comment: Comment): Promise<BasicComment[]> {
    return utils.getCommentChain(this.client, comment);
  }
}

let instance: AutoSnoo;

export const create = (options: AutoSnooOptions): AutoSnoo => {
  instance = new AutoSnoo(options);
  return instance;
};

export default create;

export const get = (): AutoSnoo => {
  if (!instance) {
    throw Error(
      "You must first create an instance using AutoSnoo.create({opts})"
    );
  }
  return instance;
};

// @ts-ignore
export const getParentComment = async (
  comment: Comment
): Promise<Comment | undefined> => {
  const inst = get();
  return inst.getParentComment(comment);
};

export const getCommentChain = async (
  comment: Comment
): Promise<BasicComment[]> => {
  const inst = get();
  return inst.getCommentChain(comment);
};
