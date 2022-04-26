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
  return { body, cookie };
};

const getLoginCookie = async (
  body: LoginProxyBody,
  cookie: string
): Promise<string> => {
  console.log("getLoginCookie");
  // const options: AxiosRequestConfig = {
  //   headers: {
  //     "accept-language": "en",
  //     "cache-control": "max-age=0",
  //     "content-type": "application/x-www-form-urlencoded",
  //     "upgrade-insecure-requests": "1",
  //     cookie: cookie,
  //   },
  //   method: "POST",
  //   maxRedirects: 0,
  // };
  // console.log("sending request", options);
  try {
    // const res: AxiosResponse = await axios.post(
    //   "https://www.tech4work.com/index.php",
    //   qs.stringify(body),
    //   options
    // );
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
      redirect: 'manual', 
    });
    console.log(res.bodyUsed, res.bodyUsed, res.status);
    if (res && res.headers && res.headers.raw()) {
      const cookie2 = res.headers.raw()["set-cookie"][0];
      return cookie2;
    }
  } catch (error) {
    console.log(error);
  }
  throw new Error("No cookie found :(");
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
      const formatted = cookie.slice(0, cookie.length - 8);
      const newcookieRaw = await getLoginCookie(body, formatted);
      const newcookie = newcookieRaw.slice(0, cookie.length - 8)
      // reply.send(newcookie);

      console.log("llooool");

      const res = await axios.get("https://www.tech4work.com/studentemp/index.asp?uid=7371", {
        headers: {
          cookie: newcookie
        }
      })
      // console.log(res.data);
      reply.type('text/html').send(res.data);
    }
  );
}