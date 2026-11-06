import type { CallableRequest } from "firebase-functions/v2/https";

const mockPlatformAdminGet = jest.fn();
const mockMembershipsGet = jest.fn();
const mockAudienceGet = jest.fn();

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (name: string) => {
      if (name === "platform_admins") {
        return { doc: () => ({ get: mockPlatformAdminGet }) };
      }
      if (name === "memberships") {
        return { where: () => ({ get: mockMembershipsGet }) };
      }
      if (name === "platform_announcements") {
        return {
          where: (_field: string, _operator: string, audience: string) => ({
            orderBy: () => ({
              limit: () => ({ get: () => mockAudienceGet(audience) }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    },
  }),
}));

import { loadPlatformAnnouncements } from "./platformAnnouncements";

const handler = loadPlatformAnnouncements.run.bind(loadPlatformAnnouncements);

function makeRequest(uid?: string): CallableRequest<Record<string, unknown>> {
  return {
    data: {},
    auth: uid ? { uid, token: {} } : undefined,
  } as unknown as CallableRequest<Record<string, unknown>>;
}

function announcement(id: string, audience: string, publishedAtMillis: number) {
  return {
    id,
    data: () => ({
      title: id,
      body: "Announcement body",
      audience,
      publishedAt: { toMillis: () => publishedAtMillis },
    }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPlatformAdminGet.mockResolvedValue({ exists: false });
  mockMembershipsGet.mockResolvedValue({ docs: [] });
  mockAudienceGet.mockImplementation((audience: string) => ({
    docs:
      audience === "all"
        ? [announcement("all", "all", 100)]
        : [announcement("admins", "admins", 200)],
  }));
});

describe("loadPlatformAnnouncements", () => {
  it("rejects unauthenticated calls", async () => {
    await expect(handler(makeRequest())).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("returns only all-audience announcements to a regular member", async () => {
    const result = await handler(makeRequest("member"));

    expect(mockAudienceGet).toHaveBeenCalledTimes(1);
    expect(mockAudienceGet).toHaveBeenCalledWith("all");
    expect(result).toEqual({
      announcements: [
        {
          id: "all",
          title: "all",
          body: "Announcement body",
          audience: "all",
          publishedAtMillis: 100,
        },
      ],
    });
  });

  it.each(["admin", "board"])(
    "returns admin announcements to an active %s member",
    async (role) => {
      mockMembershipsGet.mockResolvedValue({
        docs: [{ data: () => ({ status: "active", role }) }],
      });

      const result = await handler(makeRequest("committee"));

      expect(mockAudienceGet).toHaveBeenCalledWith("all");
      expect(mockAudienceGet).toHaveBeenCalledWith("admins");
      expect(result.announcements.map((item) => item.id)).toEqual([
        "admins",
        "all",
      ]);
    },
  );

  it("returns admin announcements to a platform admin", async () => {
    mockPlatformAdminGet.mockResolvedValue({ exists: true });

    const result = await handler(makeRequest("platform"));

    expect(result.announcements.map((item) => item.id)).toEqual([
      "admins",
      "all",
    ]);
  });

  it("does not grant admin announcements to an inactive committee member", async () => {
    mockMembershipsGet.mockResolvedValue({
      docs: [{ data: () => ({ status: "inactive", role: "admin" }) }],
    });

    await handler(makeRequest("inactive-admin"));

    expect(mockAudienceGet).toHaveBeenCalledTimes(1);
    expect(mockAudienceGet).toHaveBeenCalledWith("all");
  });
});
