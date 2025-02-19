import { describe, it, expect, beforeEach } from "vitest";

// Mock the Clarity functions and types
const mockClarity = {
  tx: {
    sender: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  },
  types: {
    uint: (value: number) => ({ type: "uint", value }),
    principal: (value: string) => ({ type: "principal", value }),
    string: (value: string) => ({ type: "string", value }),
    bool: (value: boolean) => ({ type: "bool", value }),
  },
};

// Mock contract state
let lastRecyclingId = 0;
const recyclingRecords = new Map();
const recyclingPoints = new Map();
const authorizedVerifiers = new Map();

// Mock contract calls
const contractCalls = {
  "authorize-verifier": (verifier: string) => {
    authorizedVerifiers.set(verifier, { authorized: mockClarity.types.bool(true) });
    return { success: true, value: true };
  },
  "record-recycling": (wasteType: string, amount: number) => {
    const recyclingId = ++lastRecyclingId;
    recyclingRecords.set(recyclingId, {
      recycler: mockClarity.types.principal(mockClarity.tx.sender),
      "waste-type": mockClarity.types.string(wasteType),
      amount: mockClarity.types.uint(amount),
      timestamp: mockClarity.types.uint(100), // Mock block height
      verified: mockClarity.types.bool(false),
    });
    return { success: true, value: mockClarity.types.uint(recyclingId) };
  },
  "verify-recycling": (recyclingId: number) => {
    const recycling = recyclingRecords.get(recyclingId);
    if (!recycling) {
      return { success: false, error: "err-not-found" };
    }
    if (!authorizedVerifiers.get(mockClarity.tx.sender)?.authorized.value) {
      return { success: false, error: "err-unauthorized" };
    }
    if (recycling.verified.value) {
      return { success: false, error: "err-unauthorized" };
    }
    recycling.verified = mockClarity.types.bool(true);
    const currentPoints = recyclingPoints.get(recycling.recycler.value)?.points.value || 0;
    recyclingPoints.set(recycling.recycler.value, { points: mockClarity.types.uint(currentPoints + recycling.amount.value) });
    { points: mockClarity.types.uint(currentPoints + recycling.amount.value) });
    return { success: true, value: true };
  },
  "get-recycling-record": (recyclingId: number) => {
    const recycling = recyclingRecords.get(recyclingId);
    return recycling ? { success: true, value: recycling } : { success: false, error: "err-not-found" };
  },
  "get-recycler-points": (recycler: string) => {
    const points = recyclingPoints.get(recycler)?.points || mockClarity.types.uint(0);
    return { success: true, value: points };
  },
  "is-authorized-verifier": (verifier: string) => {
    return { success: true, value: authorizedVerifiers.get(verifier)?.authorized || mockClarity.types.bool(false) };
  },
};

describe("Recycling Incentive Contract", () => {
  beforeEach(() => {
    lastRecyclingId = 0;
    recyclingRecords.clear();
    recyclingPoints.clear();
    authorizedVerifiers.clear();
  });
  
  it("should authorize a verifier", () => {
    const result = contractCalls["authorize-verifier"]("ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM");
    expect(result.success).toBe(true);
    expect(result.value).toBe(true);
    
    const isAuthorized = contractCalls["is-authorized-verifier"]("ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM");
    expect(isAuthorized.success).toBe(true);
    expect(isAuthorized.value).toEqual(mockClarity.types.bool(true));
  });
  
  it("should record recycling activity", () => {
    const result = contractCalls["record-recycling"]("plastic", 100);
    expect(result.success).toBe(true);
    expect(result.value).toEqual(mockClarity.types.uint(1));
    
    const recyclingRecord = contractCalls["get-recycling-record"](1);
    expect(recyclingRecord.success).toBe(true);
    expect(recyclingRecord.value["waste-type"]).toEqual(mockClarity.types.string("plastic"));
    expect(recyclingRecord.value.amount).toEqual(mockClarity.types.uint(100));
    expect(recyclingRecord.value.verified).toEqual(mockClarity.types.bool(false));
  });
  
  it("should verify recycling and award points", () => {
    contractCalls["authorize-verifier"](mockClarity.tx.sender);
    contractCalls["record-recycling"]("plastic", 100);
    const result = contractCalls["verify-recycling"](1);
    expect(result.success).toBe(true);
    expect(result.value).toBe(true);
    
    const recyclingRecord = contractCalls["get-recycling-record"](1);
    expect(recyclingRecord.success).toBe(true);
    expect(recyclingRecord.value.verified).toEqual(mockClarity.types.bool(true));
    
    const points = contractCalls["get-recycler-points"](mockClarity.tx.sender);
    expect(points.success).toBe(true);
    expect(points.value).toEqual(mockClarity.types.uint(100));
  });
  
  it("should fail to verify recycling without authorization", () => {
    contractCalls["record-recycling"]("plastic", 100);
    const result = contractCalls["verify-recycling"](1);
    expect(result.success).toBe(false);
    expect(result.error).toBe("err-unauthorized");
  });
  
  it("should fail to verify non-existent recycling record", () => {
    contractCalls["authorize-verifier"](mockClarity.tx.sender);
    const result = contractCalls["verify-recycling"](999);
    expect(result.success).toBe(false);
    expect(result.error).toBe("err-not-found");
  });
  
  it("should fail to get non-existent recycling record", () => {
    const result = contractCalls["get-recycling-record"](999);
    expect(result.success).toBe(false);
    expect(result.error).toBe("err-not-found");
  });
});
