import Snoowrap, { Comment } from "snoowrap";
import { CommentStream } from "snoostorm";
import {
  AutoSnoo,
  create,
  get,
  getParentComment,
  getCommentChain
} from "./index";
import { Listener } from "./utils/Listener";

jest.mock("snoowrap");
jest.mock("snoostorm");
jest.mock("./utils/Listener.ts");
jest.mock("./utils/redditUtils.ts");

describe("Index", (): void => {
  it("cover as many paths in first pass", async (): Promise<void> => {
    // AutoSnoo instance expectations
    expect((): AutoSnoo => get()).toThrow(
      Error("You must first create an instance using AutoSnoo.create({opts})")
    );
    const instance = create({
      // @ts-ignore
      snoowrapOpts: {
        clientId: "abc",
        clientSecret: "def",
        username: "mockBot",
        password: "hunter2"
      },
      subreddits: ["a", "b"],
      listeners: {
        example: {
          triggerPhrase: "listener",
          corpus: []
        }
      }
    });
    const AutoSnooInstance = get();
    expect(AutoSnooInstance).not.toBeUndefined();

    // Snoowrap expectations
    expect(Snoowrap).toHaveBeenCalledWith({
      clientId: "abc",
      clientSecret: "def",
      username: "mockBot",
      password: "hunter2",
      userAgent: expect.any(String)
    });

    // Listener expectations
    expect(Listener).toHaveBeenCalledTimes(1);
    expect(Listener).toHaveBeenCalledWith({
      initTime: expect.any(Date),
      name: "example",
      botUsername: "mockBot",
      corpus: [],
      triggerPhrase: "listener",
      debug: false
    });

    // CommentStream expectations
    const commentStream = instance.listen();
    expect(CommentStream).toHaveBeenCalledWith(expect.any(Snoowrap), {
      subreddit: "a+b"
    });

    // Default jest mocking mocks out the .on function, so a .emit will not trigger any attached .on functions.
    // However...
    //    ...Observe.
    expect(commentStream.on).toHaveBeenCalled();
    // @ts-ignore
    const dotOnCalledWith = commentStream.on.mock.calls[0];
    expect(dotOnCalledWith).toEqual(["item", expect.any(Function)]);

    const funcCalledOnEmit = dotOnCalledWith[1];
    funcCalledOnEmit({ comment: "object" });

    // Util function expectations
    const getParentCommentSpy = jest.spyOn(
      AutoSnooInstance,
      "getParentComment"
    );
    // @ts-ignore
    getParentComment({ comment: "object" });
    expect(getParentCommentSpy).toHaveBeenCalledWith({ comment: "object" });

    const getCommentChainSpy = jest.spyOn(AutoSnooInstance, "getCommentChain");
    // @ts-ignore
    getCommentChain({ comment: "object" });
    expect(getCommentChainSpy).toHaveBeenCalledWith({ comment: "object" });
  });

  it("works with a single subreddit", async (): Promise<void> => {
    const instance = create({
      snoowrapOpts: {
        clientId: "abc",
        clientSecret: "def",
        username: "mockBot",
        password: "hunter2",
        // @ts-ignore
        mock: "options",
        userAgent: "optional user agent"
      },
      subreddits: "a",
      listeners: {
        example: {
          // @ts-ignore
          additional: "listener",
          options: {
            etc: "etc"
          }
        }
      }
    });

    // Snoowrap expectations
    expect(Snoowrap).toHaveBeenCalledWith({
      clientId: "abc",
      clientSecret: "def",
      username: "mockBot",
      password: "hunter2",
      userAgent: "optional user agent",
      mock: "options"
    });

    instance.listen();

    expect(CommentStream).toHaveBeenCalledWith(expect.any(Snoowrap), {
      subreddit: "a"
    });
  });

  it("fails on no subreddit", async (): Promise<void> => {
    const instance = create({
      snoowrapOpts: {
        clientId: "abc",
        clientSecret: "def",
        username: "mockBot",
        password: "hunter2",
        // @ts-ignore
        mock: "options"
      },
      listeners: {
        example: {
          // @ts-ignore
          additional: "listener",
          options: {
            etc: "etc"
          }
        }
      }
    });

    expect((): CommentStream => instance.listen()).toThrow(
      Error("options.subreddits should be String or Array of strings")
    );
  });

  it("fails when snoowrap opts not supplied or insufficient", (): void => {
    expect(
      (): AutoSnoo =>
        create({
          snoowrapOpts: {
            clientId: "abc",
            clientSecret: "def",
            username: "mockBot",
            //@ts-ignore
            mock: "options"
          }
        })
    ).toThrow(
      Error(
        "AutoSnoo requires snoowrapOpts containing clientId, secretId, and the reddit bot's username and password"
      )
    );
  });
});
