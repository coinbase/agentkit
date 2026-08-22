import { isServiceRegistered } from "./utils";

describe("isServiceRegistered", () => {
  const registered = new Set(["https://api.example.com", "https://pay.example.com/v1"]);

  it("allows exact origin registration for any path on that origin", () => {
    expect(isServiceRegistered("https://api.example.com/foo", registered)).toBe(true);
  });

  it("allows same-origin path prefix registrations", () => {
    expect(isServiceRegistered("https://pay.example.com/v1/charge", registered)).toBe(true);
    expect(isServiceRegistered("https://pay.example.com/v1", registered)).toBe(true);
  });

  it("rejects hostname-suffix bypass of prefix matching", () => {
    expect(isServiceRegistered("https://api.example.com.evil.com/x", registered)).toBe(false);
  });

  it("rejects different hosts even when the string shares a prefix", () => {
    expect(isServiceRegistered("https://api.example.com.attacker/x", registered)).toBe(false);
    expect(isServiceRegistered("https://evil.com/https://api.example.com", registered)).toBe(
      false,
    );
  });

  it("rejects sibling paths outside the registered prefix", () => {
    expect(isServiceRegistered("https://pay.example.com/v2/charge", registered)).toBe(false);
    expect(isServiceRegistered("https://pay.example.com/v10", registered)).toBe(false);
  });
});
