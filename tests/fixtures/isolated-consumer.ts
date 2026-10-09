import { get_http_client, load } from "sindrejs/general";
import { get_agent_sse } from "sindrejs/utilsagent/sse";
import { to_slug } from "sindrejs/general";

export async function isolatedConsumerSmoke(path: string) {
  const value = await load<Uint8Array>(path, { as: "bytes" });
  const response = get_agent_sse((async function* () {
    yield { type: "text" as const, text: String(value.byteLength) };
  })());
  return { contentType: response.headers.get("content-type"), slug: to_slug(path), client: get_http_client({ baseURL: "/" }) };
}
