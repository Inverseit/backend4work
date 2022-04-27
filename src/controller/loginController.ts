import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import axios from "axios";
// AxiosResponse
// import { AxiosRequestConfig } from "axios";
import { parse, HTMLElement } from "fast-html-parser";
import qs from "qs";
import fetch from "node-fetch";

interface LoginBody {
  username: string;
  password: string;
}

interface LoginProxyBody {
  [key: string]: string | number;
}

const getLoginTokens = async (): Promise<{
  retValue: string;
  tokenKey: string;
  cookie: string;
}> => {
  const res = await axios.get("http://www.tech4work.com/index.php");
  const htmlData: string = res.data;
  const form: HTMLElement | null = parse(htmlData).querySelector("#form-login");
  if (form != null) {
    const retInput = form.childNodes[9].rawAttrs;
    const retValue = retInput.slice(35, retInput.length - 2);
    const tokenKey = form.childNodes[11].rawAttrs.slice(20, 52);
    if (res && res.headers && res.headers["set-cookie"]) {
      const cookie = res.headers["set-cookie"][0];
      return { retValue, tokenKey, cookie: cookie };
    }
    throw new Error("Empty cookies 1 ");
  } else {
    throw new Error("Link is broken");
  }
};

const getLoginProxyBody = async (
  username: string,
  password: string
): Promise<{ body: LoginProxyBody; cookie: string }> => {
  const { retValue, tokenKey, cookie } = await getLoginTokens();

  const body: LoginProxyBody = {
    username: username,
    passwd: password,
    remember: "yes",
    Submit: "login",
    option: "com_user",
    task: "login",
    return: retValue,
  };
  body[tokenKey] = 1;
  const formatted = cookie.slice(0, cookie.length - 8);
  return { body, cookie: formatted };
};

const getLoginCookie = async (
  body: LoginProxyBody,
  cookie: string
): Promise<string> => {
  try {
    const res = await fetch("https://www.tech4work.com/index.php", {
      method: "POST",
      body: qs.stringify(body),
      headers: {
        "accept-language": "en",
        "cache-control": "max-age=0",
        "content-type": "application/x-www-form-urlencoded",
        "upgrade-insecure-requests": "1",
        cookie: cookie,
      },
      redirect: "manual",
    });
    if (res && res.headers && res.headers.raw()) {
      const cookie2 = res.headers.raw()["set-cookie"][0];
      return cookie2.slice(0, cookie2.length - 8);
    }
  } catch (error) {
    console.log(error);
  }
  throw new Error("No cookie found :(");
};

const getId = async (cookie: string): Promise<string> => {
  const res = await axios.get(
    "https://www.tech4work.com/index.php?option=com_content&view=article&id=50&Itemid=74",
    {
      headers: {
        cookie: cookie,
      },
    }
  );

  const iframe: HTMLElement | null = parse(res.data).querySelector("iframe");
  if (iframe) {
    const iframeAttr = iframe.rawAttrs;
    const deletedPrefix = iframeAttr.slice(33);
    return deletedPrefix.slice(0, deletedPrefix.indexOf('"'));
  }
  throw new Error("Iframe not found!");
};

export default async function loginController(fastify: FastifyInstance) {
  // POST /
  fastify.post(
    "/",
    async (
      request: FastifyRequest<{ Body: LoginBody }>,
      reply: FastifyReply
    ) => {
      const { username, password } = request.body;
      const { body, cookie } = await getLoginProxyBody(username, password);
      const sessionCookie = await getLoginCookie(body, cookie);
      const id = await getId(sessionCookie);
      reply.header("set-cookie", sessionCookie).status(200).send({ id });
    }
  );
}
