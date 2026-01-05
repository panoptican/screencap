import {
	createHash,
	createPrivateKey,
	createPublicKey,
	generateKeyPairSync,
	sign,
	verify,
} from "node:crypto";
import { describe, expect, it } from "vitest";

function sha256Hex(bytes: Uint8Array): string {
	return createHash("sha256").update(bytes).digest("hex");
}

function clientCanonicalString(params: {
	method: string;
	path: string;
	ts: string;
	bodyHashHex: string;
}): string {
	return `${params.method.toUpperCase()}\n${params.path}\n${params.ts}\n${params.bodyHashHex}`;
}

function serverCanonicalString(params: {
	method: string;
	path: string;
	ts: string;
	bodyHashHex: string;
}): string {
	return `${params.method.toUpperCase()}\n${params.path}\n${params.ts}\n${params.bodyHashHex}`;
}

function createTestIdentity() {
	const signKeys = generateKeyPairSync("ed25519");
	return {
		signPubKeySpkiDerB64: Buffer.from(
			signKeys.publicKey.export({ type: "spki", format: "der" }) as Buffer,
		).toString("base64"),
		signPrivKeyPkcs8DerB64: Buffer.from(
			signKeys.privateKey.export({ type: "pkcs8", format: "der" }) as Buffer,
		).toString("base64"),
	};
}

function clientSign(params: {
	method: string;
	path: string;
	body: string | null;
	signPrivKeyPkcs8DerB64: string;
}): { signature: string; ts: string } {
	const ts = String(Date.now());
	const bodyBytes = params.body
		? Buffer.from(params.body, "utf8")
		: new Uint8Array();
	const bodyHashHex = sha256Hex(bodyBytes);
	const normalizedPath = params.path.startsWith("/")
		? params.path
		: `/${params.path}`;

	const canonical = clientCanonicalString({
		method: params.method,
		path: normalizedPath,
		ts,
		bodyHashHex,
	});

	const privKey = createPrivateKey({
		key: Buffer.from(params.signPrivKeyPkcs8DerB64, "base64"),
		format: "der",
		type: "pkcs8",
	});

	const signature = sign(
		null,
		Buffer.from(canonical, "utf8"),
		privKey,
	).toString("base64");

	return { signature, ts };
}

function serverVerify(params: {
	method: string;
	pathname: string;
	search: string;
	body: string | null;
	ts: string;
	signature: string;
	signPubKeySpkiDerB64: string;
}): boolean {
	const bodyBytes = params.body
		? Buffer.from(params.body, "utf8")
		: new Uint8Array();
	const bodyHashHex = sha256Hex(bodyBytes);

	const pathWithQuery = params.pathname + params.search;
	const pathNoQuery = params.pathname;

	const publicKey = createPublicKey({
		key: Buffer.from(params.signPubKeySpkiDerB64, "base64"),
		format: "der",
		type: "spki",
	});

	const signatureBuffer = Buffer.from(params.signature, "base64");

	const canonicalWithQuery = serverCanonicalString({
		method: params.method,
		path: pathWithQuery,
		ts: params.ts,
		bodyHashHex,
	});
	const canonicalNoQuery = serverCanonicalString({
		method: params.method,
		path: pathNoQuery,
		ts: params.ts,
		bodyHashHex,
	});

	return (
		verify(
			null,
			Buffer.from(canonicalWithQuery, "utf8"),
			publicKey,
			signatureBuffer,
		) ||
		verify(
			null,
			Buffer.from(canonicalNoQuery, "utf8"),
			publicKey,
			signatureBuffer,
		)
	);
}

describe("Signature Verification Integration", () => {
	describe("sharing flow signatures", () => {
		it("verifies POST request without query params (room create)", () => {
			const identity = createTestIdentity();
			const body = JSON.stringify({ name: "My Room" });

			const { signature, ts } = clientSign({
				method: "POST",
				path: "/api/rooms",
				body,
				signPrivKeyPkcs8DerB64: identity.signPrivKeyPkcs8DerB64,
			});

			const verified = serverVerify({
				method: "POST",
				pathname: "/api/rooms",
				search: "",
				body,
				ts,
				signature,
				signPubKeySpkiDerB64: identity.signPubKeySpkiDerB64,
			});

			expect(verified).toBe(true);
		});

		it("verifies POST request to nested path (room invite)", () => {
			const identity = createTestIdentity();
			const body = JSON.stringify({ userId: "friend-123" });

			const { signature, ts } = clientSign({
				method: "POST",
				path: "/api/rooms/room-abc/invites",
				body,
				signPrivKeyPkcs8DerB64: identity.signPrivKeyPkcs8DerB64,
			});

			const verified = serverVerify({
				method: "POST",
				pathname: "/api/rooms/room-abc/invites",
				search: "",
				body,
				ts,
				signature,
				signPubKeySpkiDerB64: identity.signPubKeySpkiDerB64,
			});

			expect(verified).toBe(true);
		});

		it("verifies GET request with query params (fetchRoomEvents)", () => {
			const identity = createTestIdentity();

			const { signature, ts } = clientSign({
				method: "GET",
				path: "/api/rooms/room-abc/events?since=1704067200000",
				body: null,
				signPrivKeyPkcs8DerB64: identity.signPrivKeyPkcs8DerB64,
			});

			const verified = serverVerify({
				method: "GET",
				pathname: "/api/rooms/room-abc/events",
				search: "?since=1704067200000",
				body: null,
				ts,
				signature,
				signPubKeySpkiDerB64: identity.signPubKeySpkiDerB64,
			});

			expect(verified).toBe(true);
		});

		it("verifies GET request with multiple query params", () => {
			const identity = createTestIdentity();

			const { signature, ts } = clientSign({
				method: "GET",
				path: "/api/rooms/room-abc/events?since=1704067200000&limit=50",
				body: null,
				signPrivKeyPkcs8DerB64: identity.signPrivKeyPkcs8DerB64,
			});

			const verified = serverVerify({
				method: "GET",
				pathname: "/api/rooms/room-abc/events",
				search: "?since=1704067200000&limit=50",
				body: null,
				ts,
				signature,
				signPubKeySpkiDerB64: identity.signPubKeySpkiDerB64,
			});

			expect(verified).toBe(true);
		});

		it("verifies GET request without query params (list rooms)", () => {
			const identity = createTestIdentity();

			const { signature, ts } = clientSign({
				method: "GET",
				path: "/api/rooms",
				body: null,
				signPrivKeyPkcs8DerB64: identity.signPrivKeyPkcs8DerB64,
			});

			const verified = serverVerify({
				method: "GET",
				pathname: "/api/rooms",
				search: "",
				body: null,
				ts,
				signature,
				signPubKeySpkiDerB64: identity.signPubKeySpkiDerB64,
			});

			expect(verified).toBe(true);
		});

		it("fails verification with wrong signature", () => {
			const identity = createTestIdentity();
			const wrongIdentity = createTestIdentity();

			const { signature, ts } = clientSign({
				method: "GET",
				path: "/api/rooms/room-abc/events",
				body: null,
				signPrivKeyPkcs8DerB64: identity.signPrivKeyPkcs8DerB64,
			});

			const verified = serverVerify({
				method: "GET",
				pathname: "/api/rooms/room-abc/events",
				search: "",
				body: null,
				ts,
				signature,
				signPubKeySpkiDerB64: wrongIdentity.signPubKeySpkiDerB64,
			});

			expect(verified).toBe(false);
		});

		it("fails verification when body is tampered", () => {
			const identity = createTestIdentity();
			const originalBody = JSON.stringify({ name: "Original" });
			const tamperedBody = JSON.stringify({ name: "Tampered" });

			const { signature, ts } = clientSign({
				method: "POST",
				path: "/api/rooms",
				body: originalBody,
				signPrivKeyPkcs8DerB64: identity.signPrivKeyPkcs8DerB64,
			});

			const verified = serverVerify({
				method: "POST",
				pathname: "/api/rooms",
				search: "",
				body: tamperedBody,
				ts,
				signature,
				signPubKeySpkiDerB64: identity.signPubKeySpkiDerB64,
			});

			expect(verified).toBe(false);
		});

		it("fails verification when query params are modified", () => {
			const identity = createTestIdentity();

			const { signature, ts } = clientSign({
				method: "GET",
				path: "/api/rooms/room-abc/events?since=1704067200000",
				body: null,
				signPrivKeyPkcs8DerB64: identity.signPrivKeyPkcs8DerB64,
			});

			const verified = serverVerify({
				method: "GET",
				pathname: "/api/rooms/room-abc/events",
				search: "?since=9999999999999",
				body: null,
				ts,
				signature,
				signPubKeySpkiDerB64: identity.signPubKeySpkiDerB64,
			});

			expect(verified).toBe(false);
		});
	});

	describe("canonical string format", () => {
		it("produces consistent canonical string", () => {
			const ts = "1704067200000";
			const bodyHashHex = sha256Hex(Buffer.from("test", "utf8"));

			const canonical = clientCanonicalString({
				method: "POST",
				path: "/api/rooms",
				ts,
				bodyHashHex,
			});

			expect(canonical).toBe(`POST\n/api/rooms\n${ts}\n${bodyHashHex}`);
		});

		it("includes query string in path for canonical string", () => {
			const ts = "1704067200000";
			const bodyHashHex = sha256Hex(new Uint8Array());

			const canonical = clientCanonicalString({
				method: "GET",
				path: "/api/rooms/abc/events?since=123",
				ts,
				bodyHashHex,
			});

			expect(canonical).toContain("?since=123");
		});

		it("uppercases method in canonical string", () => {
			const ts = "1704067200000";
			const bodyHashHex = sha256Hex(new Uint8Array());

			const canonical = clientCanonicalString({
				method: "get",
				path: "/api/rooms",
				ts,
				bodyHashHex,
			});

			expect(canonical.startsWith("GET\n")).toBe(true);
		});
	});
});
