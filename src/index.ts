import { DurableObject } from "cloudflare:workers";

/**
 * Welcome to Cloudflare Workers! This is your first Durable Objects application.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your Durable Object in action
 * - Run `npm run deploy` to publish your application
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/durable-objects
 */

/** A Durable Object's behavior is defined in an exported Javascript class */

interface Message {
	content: string;
	expireDate: string;
	burnAfterRead: boolean;
}

export class ZK_server extends DurableObject<Env> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	async get(name: string): Promise<Message> {
		let data: Message | undefined = await this.ctx.storage.get(name);

		if (!data) {
			return {
				content: "",
				expireDate: "",
				burnAfterRead: false
			};
		}

		if (data.burnAfterRead) {
			await this.ctx.storage.delete(name);
		}

		return data;
	}

	async put(info: Message): Promise<string> {
		const param = info
		if (Number.isNaN(new Date(info.expireDate).getTime())) {
			param.expireDate = new Date().toISOString()
		}
		const json = JSON.stringify(param);
		const key = await this.sha1Hex(json);

		await this.ctx.storage.put(key, param);

		return key;
	}

	async cleanupExpired(): Promise<void> {
		for await (const [key, value] of await this.ctx.storage.list()) {
			const msg = value as Message;
			if (msg.expireDate && new Date(msg.expireDate) < new Date()) {
				await this.ctx.storage.delete(key);
			}
		}

	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url)
		switch (request.method) {
			case "OPTIONS":
				return new Response(null, { headers: CORS_HEADERS });

			case "POST": {
				const req = ((await request.json()) as Message)
				const notation = await this.put(req)
				return new Response(notation, { headers: CORS_HEADERS });
			}
			case "GET": {
				const data: Message = await this.get((new URL(request.url)).pathname.slice(1))
				return new Response(JSON.stringify(data), { headers: CORS_HEADERS });
			}
			case "DELETE": {
				await this.cleanupExpired();
				return new Response(null);
			}
			default:
				return new Response(null);
		}
	}

	private async sha1Hex(input: string): Promise<string> {
		const buffer = await crypto.subtle.digest(
			"SHA-256",
			new TextEncoder().encode(input)
		);
		return Array.from(new Uint8Array(buffer))
			.map(b => b.toString(16).padStart(2, "0"))
			.join("");
	}
}

const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

export default {
	/**
	 * This is the standard fetch handler for a Cloudflare Worker
	 *
	 * @param request - The request submitted to the Worker from the client
	 * @param env - The interface to reference bindings declared in wrangler.jsonc
	 * @param ctx - The execution context of the Worker
	 * @returns The response to be sent back to the client
	 */
	async fetch(request, env, ctx): Promise<Response> {
		// Create a stub to open a communication channel with the Durable Object
		// instance named "foo".
		//
		// Requests from all Workers to the Durable Object instance named "foo"
		// will go to a single remote Durable Object instance.

		// Call the `sayHello()` RPC method on the stub to invoke the method on
		// the remote Durable Object instance.

		const id = env.ZK_CRYPTO_MESSAGES.idFromName("global");
		const stub = env.ZK_CRYPTO_MESSAGES.get(id)
		return await stub.fetch(request)

	},

	async scheduled(controller: ScheduledController, env: Env) {
		const id = env.ZK_CRYPTO_MESSAGES.idFromName("global");
		const stub = env.ZK_CRYPTO_MESSAGES.get(id);

		await stub.fetch(new Request("", { method: "DELETE" }));
	}

} satisfies ExportedHandler<Env>;
