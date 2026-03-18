import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { validateInitData, parseInitData } from "../middleware/telegram-auth.js";

const BOT_TOKEN = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11";

function createValidInitData(
  data: Record<string, string>,
  botToken: string
): string {
  const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n");
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const hash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");
  const params = new URLSearchParams({ ...data, hash });
  return params.toString();
}

describe("telegram-auth", () => {
  describe("validateInitData", () => {
    it("returns true for valid initData", () => {
      const userData = JSON.stringify({
        id: 123456789,
        first_name: "Test",
        username: "testuser",
      });
      const initData = createValidInitData(
        {
          user: userData,
          auth_date: String(Math.floor(Date.now() / 1000)),
          query_id: "test-query",
        },
        BOT_TOKEN
      );
      expect(validateInitData(initData, BOT_TOKEN)).toBe(true);
    });

    it("returns false for tampered data", () => {
      const userData = JSON.stringify({ id: 123456789, first_name: "Test" });
      const initData = createValidInitData(
        {
          user: userData,
          auth_date: String(Math.floor(Date.now() / 1000)),
        },
        BOT_TOKEN
      );
      const tampered = initData.replace("Test", "Hacker");
      expect(validateInitData(tampered, BOT_TOKEN)).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(validateInitData("", BOT_TOKEN)).toBe(false);
    });
  });

  describe("parseInitData", () => {
    it("extracts telegramId from valid user JSON", () => {
      const userData = JSON.stringify({
        id: 123456789,
        first_name: "Test",
      });
      const initData = createValidInitData(
        {
          user: userData,
          auth_date: String(Math.floor(Date.now() / 1000)),
        },
        BOT_TOKEN
      );
      const result = parseInitData(initData);
      expect(result?.telegramId).toBe(123456789);
      expect(result?.firstName).toBe("Test");
    });
  });
});
