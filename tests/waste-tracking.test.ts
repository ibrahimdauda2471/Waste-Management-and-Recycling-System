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
let lastWasteId = 0;
const wasteRecords = new Map();
const authorizedCollectors = new Map();

// Mock contract calls
const contractCalls = {
  "authorize-collector": (collector: string) => {
    authorizedCollectors.set(collector, { authorized: mockClarity.types.bool(true) });
    return { success: true, value: true };
  },
  "record-waste-generation": (wasteType: string, amount: number) => {
    const wasteId = ++lastWasteId;
    wasteRecords.set(wasteId, {
      generator: mockClarity.types.principal(mockClarity.tx.sender),
      "waste-type": mockClarity.types.string(wasteType),
      amount: mockClarity.types.uint(amount),
      timestamp: mockClarity.types.uint(100), // Mock block height
      disposed: mockClarity.types.bool(false),
    });
    return { success: true, value: mockClarity.types.uint(wasteId) };
  },
  "record-waste-disposal": (wasteId: number) => {
    const waste = wasteRecords.get(wasteId);
    if (!waste) {
      return { success: false, error: "err-not-found" };
    }
    if (!authorizedCollectors.get(mockClarity.tx.sender)?.authorized.value) {
      return { success: false, error: "err-unauthorized" };
    }
    if (waste.disposed.value) {
      return { success: false, error: "err-unauthorized" };
    }
    waste.disposed = mockClarity.types.bool(true);
    return { success: true, value: true };
  },
  "get-waste-record": (wasteId: number) => {
    const waste = wasteRecords.get(wasteId);
    return waste ? { success: true, value: waste } : { success: false, error: "err-not-found" };
  },
  "is-authorized-collector": (collector: string) => {
    return { success: true, value: authorizedCollectors.get(collector)?.authorized || mockClarity.types.bool(false) };
  },
};

describe("Waste Tracking Contract", () => {
  beforeEach(() => {
    lastWasteId = 0;
    wasteRecords.clear();
    authorizedCollectors.clear();
  });
  
  it("should authorize a collector", () => {
    const result = contractCalls["authorize-collector"]("ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM");
    expect(result.success).toBe(true);
    expect(result.value).toBe(true);
    
    const isAuthorized = contractCalls["is-authorized-collector"]("ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM");
    expect(isAuthorized.success).toBe(true);
    expect(isAuthorized.value).toEqual(mockClarity.types.bool(true));
  });
  
  it("should record waste generation", () => {
    const result = contractCalls["record-waste-generation"]("plastic", 100);
    expect(result.success).toBe(true);
    expect(result.value).toEqual(mockClarity.types.uint(1));
    
    const wasteRecord = contractCalls["get-waste-record"](1);
    expect(wasteRecord.success).toBe(true);
    expect(wasteRecord.value["waste-type"]).toEqual(mockClarity.types.string("plastic"));
    expect(wasteRecord.value.amount).toEqual(mockClarity.types.uint(100));
    expect(wasteRecord.value.disposed).toEqual(mockClarity.types.bool(false));
  });
  
  it("should record waste disposal", () => {
    contractCalls["authorize-collector"](mockClarity.tx.sender);
    contractCalls["record-waste-generation"]("plastic", 100);
    const result = contractCalls["record-waste-disposal"](1);
    expect(result.success).toBe(true);
    expect(result.value).toBe(true);
    
    const wasteRecord = contractCalls["get-waste-record"](1);
    expect(wasteRecord.success).toBe(true);
    expect(wasteRecord.value.disposed).toEqual(mockClarity.types.bool(true));
  });
  
  it("should fail to record waste disposal without authorization", () => {
    contractCalls["record-waste-generation"]("plastic", 100);
    const result = contractCalls["record-waste-disposal"](1);
    expect(result.success).toBe(false);
    expect(result.error).toBe("err-unauthorized");
  });
  
  it("should fail to record waste disposal for non-existent waste", () => {
    contractCalls["authorize-collector"](mockClarity.tx.sender);
    const result = contractCalls["record-waste-disposal"](999);
    expect(result.success).toBe(false);
    expect(result.error).toBe("err-not-found");
  });
  
  it("should fail to get non-existent waste record", () => {
    const result = contractCalls["get-waste-record"](999);
    expect(result.success).toBe(false);
    expect(result.error).toBe("err-not-found");
  });
});
