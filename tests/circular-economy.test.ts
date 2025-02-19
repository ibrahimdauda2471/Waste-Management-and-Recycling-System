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
  },
}

// Mock contract state
let lastListingId = 0
const recycledMaterialListings = new Map()
const userBalances = new Map()

// Mock contract calls
const contractCalls = {
  "create-listing": (materialType: string, amount: number, pricePerUnit: number) => {
    const listingId = ++lastListingId
    recycledMaterialListings.set(listingId, {
      seller: mockClarity.types.principal(mockClarity.tx.sender),
      "material-type": mockClarity.types.string(materialType),
      amount: mockClarity.types.uint(amount),
      "price-per-unit": mockClarity.types.uint(pricePerUnit),
      status: mockClarity.types.string("active"),
    })
    return { success: true, value: mockClarity.types.uint(listingId) }
  },
  "purchase-material": (listingId: number, amount: number) => {
    const listing = recycledMaterialListings.get(listingId)
    if (!listing) {
      return { success: false, error: "err-not-found" }
    }
    if (listing.status.value !== "active") {
      return { success: false, error: "err-unauthorized" }
    }
    if (listing.amount.value < amount) {
      return { success: false, error: "err-unauthorized" }
    }
    const totalCost = amount * listing["price-per-unit"].value
    const buyerBalance = userBalances.get(mockClarity.tx.sender)?.balance.value || 0
    if (buyerBalance < totalCost) {
      return { success: false, error: "err-insufficient-balance" }
    }
    
    // Update listing
    listing.amount = mockClarity.types.uint(listing.amount.value - amount)
    listing.status = mockClarity.types.string(listing.amount.value === 0 ? "completed" : "active")
    
    // Transfer balance
    userBalances.set(mockClarity.tx.sender, { balance: mockClarity.types.uint(buyerBalance - totalCost) })
    const sellerBalance = userBalances.get(listing.seller.value)?.balance.value || 0
    userBalances.set(listing.seller.value, { balance: mockClarity.types.uint(sellerBalance + totalCost) })
    
    return { success: true, value: true }
  },
  "add-funds": (amount: number) => {
    const currentBalance = userBalances.get(mockClarity.tx.sender)?.balance.value || 0
    userBalances.set(mockClarity.tx.sender, { balance: mockClarity.types.uint(currentBalance + amount) })
    return { success: true, value: true }
  },
  "get-listing": (listingId: number) => {
    const listing = recycledMaterialListings.get(listingId)
    return listing ? { success: true, value: listing } : { success: false, error: "err-not-found" }
  },
  "get-balance": (user: string) => {
    const balance = userBalances.get(user)?.balance || mockClarity.types.uint(0)
    return { success: true, value: balance }
  },
}

describe("Circular Economy Contract", () => {
  beforeEach(() => {
    lastListingId = 0
    recycledMaterialListings.clear()
    userBalances.clear()
  })
  
  it("should create a new listing", () => {
    const result = contractCalls["create-listing"]("plastic", 100, 5)
    expect(result.success).toBe(true)
    expect(result.value).toEqual(mockClarity.types.uint(1))
    
    const listing = contractCalls["get-listing"](1)
    expect(listing.success).toBe(true)
    expect(listing.value["material-type"]).toEqual(mockClarity.types.string("plastic"))
    expect(listing.value.amount).toEqual(mockClarity.types.uint(100))
    expect(listing.value["price-per-unit"]).toEqual(mockClarity.types.uint(5))
    expect(listing.value.status).toEqual(mockClarity.types.string("active"))
  })
  
  it("should fail to purchase material with insufficient balance", () => {
    contractCalls["create-listing"]("plastic", 100, 5)
    const result = contractCalls["purchase-material"](1, 20)
    expect(result.success).toBe(false)
    expect(result.error).toBe("err-insufficient-balance")
  })
  
  it("should complete listing when all material is purchased", () => {
    contractCalls["create-listing"]("plastic", 100, 5)
    contractCalls["add-funds"](1000)
    contractCalls["purchase-material"](1, 100)
    const listing = contractCalls["get-listing"](1)
    expect(listing.success).toBe(true)
    expect(listing.value.amount).toEqual(mockClarity.types.uint(0))
    expect(listing.value.status).toEqual(mockClarity.types.string("completed"))
  })
  
  it("should add funds to user balance", () => {
    const result = contractCalls["add-funds"](500)
    expect(result.success).toBe(true)
    expect(result.value).toBe(true)
    
    const balance = contractCalls["get-balance"](mockClarity.tx.sender)
    expect(balance.success).toBe(true)
    expect(balance.value).toEqual(mockClarity.types.uint(500))
  })
  
  it("should fail to get non-existent listing", () => {
    const result = contractCalls["get-listing"](999)
    expect(result.success).toBe(false)
    expect(result.error).toBe("err-not-found")
  })
})

