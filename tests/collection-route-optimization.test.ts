import { describe, it, expect, beforeEach } from "vitest"

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
    list: (value: any[]) => ({ type: "list", value }),
  },
}

// Mock contract state
let lastRouteId = 0
const collectionRoutes = new Map()
const authorizedCollectors = new Map()

// Mock contract calls
const contractCalls = {
  "authorize-collector": (collector: string) => {
    authorizedCollectors.set(collector, { authorized: mockClarity.types.bool(true) })
    return { success: true, value: true }
  },
  "create-route": (startLocation: string, endLocation: string, waypoints: string[], estimatedTime: number) => {
    if (!authorizedCollectors.get(mockClarity.tx.sender)?.authorized.value) {
      return { success: false, error: "err-unauthorized" }
    }
    const routeId = ++lastRouteId
    collectionRoutes.set(routeId, {
      collector: mockClarity.types.principal(mockClarity.tx.sender),
      "start-location": mockClarity.types.string(startLocation),
      "end-location": mockClarity.types.string(endLocation),
      waypoints: mockClarity.types.list(waypoints.map((w) => mockClarity.types.string(w))),
      "estimated-time": mockClarity.types.uint(estimatedTime),
      status: mockClarity.types.string("pending"),
    })
    return { success: true, value: mockClarity.types.uint(routeId) }
  },
  "update-route-status": (routeId: number, newStatus: string) => {
    const route = collectionRoutes.get(routeId)
    if (!route) {
      return { success: false, error: "err-not-found" }
    }
    if (route.collector.value !== mockClarity.tx.sender) {
      return { success: false, error: "err-unauthorized" }
    }
    route.status = mockClarity.types.string(newStatus)
    return { success: true, value: true }
  },
  "get-route": (routeId: number) => {
    const route = collectionRoutes.get(routeId)
    return route ? { success: true, value: route } : { success: false, error: "err-not-found" }
  },
  "is-authorized-collector": (collector: string) => {
    return { success: true, value: authorizedCollectors.get(collector)?.authorized || mockClarity.types.bool(false) }
  },
}

describe("Collection Route Optimization Contract", () => {
  beforeEach(() => {
    lastRouteId = 0
    collectionRoutes.clear()
    authorizedCollectors.clear()
  })
  
  it("should authorize a collector", () => {
    const result = contractCalls["authorize-collector"]("ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM")
    expect(result.success).toBe(true)
    expect(result.value).toBe(true)
    
    const isAuthorized = contractCalls["is-authorized-collector"]("ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM")
    expect(isAuthorized.success).toBe(true)
    expect(isAuthorized.value).toEqual(mockClarity.types.bool(true))
  })
  
  it("should create a new collection route", () => {
    contractCalls["authorize-collector"](mockClarity.tx.sender)
    const result = contractCalls["create-route"]("Start", "End", ["A", "B", "C"], 120)
    expect(result.success).toBe(true)
    expect(result.value).toEqual(mockClarity.types.uint(1))
    
    const route = contractCalls["get-route"](1)
    expect(route.success).toBe(true)
    expect(route.value["start-location"]).toEqual(mockClarity.types.string("Start"))
    expect(route.value["end-location"]).toEqual(mockClarity.types.string("End"))
    expect(route.value.waypoints.value).toEqual(["A", "B", "C"].map((w) => mockClarity.types.string(w)))
    expect(route.value["estimated-time"]).toEqual(mockClarity.types.uint(120))
    expect(route.value.status).toEqual(mockClarity.types.string("pending"))
  })
  
  it("should update route status", () => {
    contractCalls["authorize-collector"](mockClarity.tx.sender)
    contractCalls["create-route"]("Start", "End", ["A", "B", "C"], 120)
    const result = contractCalls["update-route-status"](1, "in-progress")
    expect(result.success).toBe(true)
    expect(result.value).toBe(true)
    
    const route = contractCalls["get-route"](1)
    expect(route.success).toBe(true)
    expect(route.value.status).toEqual(mockClarity.types.string("in-progress"))
  })
  
  it("should fail to create route without authorization", () => {
    const result = contractCalls["create-route"]("Start", "End", ["A", "B", "C"], 120)
    expect(result.success).toBe(false)
    expect(result.error).toBe("err-unauthorized")
  })
  
  it("should fail to update non-existent route", () => {
    const result = contractCalls["update-route-status"](999, "completed")
    expect(result.success).toBe(false)
    expect(result.error).toBe("err-not-found")
  })
  
  it("should fail to update route status by non-owner", () => {
    contractCalls["authorize-collector"](mockClarity.tx.sender)
    contractCalls["create-route"]("Start", "End", ["A", "B", "C"], 120)
    mockClarity.tx.sender = "ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
    const result = contractCalls["update-route-status"](1, "completed")
    expect(result.success).toBe(false)
    expect(result.error).toBe("err-unauthorized")
  })
  
  it("should fail to get non-existent route", () => {
    const result = contractCalls["get-route"](999)
    expect(result.success).toBe(false)
    expect(result.error).toBe("err-not-found")
  })
})

