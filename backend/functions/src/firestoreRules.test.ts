import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("firestore.rules", () => {
  const rules = readFileSync(
    resolve(__dirname, "../../firestore.rules"),
    "utf8",
  );

  it("does not let clients write Stripe mirror fields on club bank accounts", () => {
    expect(rules).toContain("function bankAccountClientUpdateIsValid");
    expect(rules).toContain(
      "affectedKeys().hasOnly(bankAccountClientFields())",
    );
    expect(rules).toContain("allow delete: if false;");
    expect(rules).not.toContain(
      "match /club_bank_accounts/{clubId} {\n      allow read: if isActiveMember(clubId);\n      allow write: if isBoard(clubId);",
    );
  });

  it("strictly validates conversation and message writes", () => {
    expect(rules).toContain("function conversationCreateIsValid");
    expect(rules).toContain("conversation.participantIds.size() == 1");
    expect(rules).toContain("conversation.participantIds.size() == 2");
    expect(rules).toContain("function messageCreateIsValid");
    expect(rules).toContain("message.readBy.size() == 1");
    expect(rules).toContain(
      "request.resource.data.readBy.size() <= resource.data.readBy.size() + 1",
    );
  });
});
