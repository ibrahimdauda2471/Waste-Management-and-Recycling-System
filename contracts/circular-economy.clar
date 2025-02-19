;; Circular Economy Contract

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-found (err u101))
(define-constant err-unauthorized (err u102))
(define-constant err-insufficient-balance (err u103))

;; Data Variables
(define-data-var last-listing-id uint u0)

;; Data Maps
(define-map recycled-material-listings
  { listing-id: uint }
  {
    seller: principal,
    material-type: (string-ascii 20),
    amount: uint,
    price-per-unit: uint,
    status: (string-ascii 20)
  }
)

(define-map user-balances
  { user: principal }
  { balance: uint }
)

;; Public Functions

;; Create a new listing for recycled material
(define-public (create-listing (material-type (string-ascii 20)) (amount uint) (price-per-unit uint))
  (
let
    (
      (new-id (+ (var-get last-listing-id) u1))
    )
    (map-set recycled-material-listings
      { listing-id: new-id }
      {
        seller: tx-sender,
        material-type: material-type,
        amount: amount,
        price-per-unit: price-per-unit,
        status: "active"
      }
    )
    (var-set last-listing-id new-id)
    (ok new-id)
  )
)

;; Purchase recycled material
(define-public (purchase-material (listing-id uint) (amount uint))
  (let
    (
      (listing (unwrap! (map-get? recycled-material-listings { listing-id: listing-id }) err-not-found))
      (total-cost (* amount (get price-per-unit listing)))
      (buyer-balance (default-to { balance: u0 } (map-get? user-balances { user: tx-sender })))
      (seller-balance (default-to { balance: u0 } (map-get? user-balances { user: (get seller listing) })))
    )
    (asserts! (is-eq (get status listing) "active") err-unauthorized)
    (asserts! (<= amount (get amount listing)) err-unauthorized)
    (asserts! (>= (get balance buyer-balance) total-cost) err-insufficient-balance)

    ;; Update listing
    (map-set recycled-material-listings
      { listing-id: listing-id }
      (merge listing {
        amount: (- (get amount listing) amount),
        status: (if (is-eq (- (get amount listing) amount) u0) "completed" "active")
      })
    )

    ;; Transfer balance
    (map-set user-balances
      { user: tx-sender }
      { balance: (- (get balance buyer-balance) total-cost) }
    )
    (map-set user-balances
      { user: (get seller listing) }
      { balance: (+ (get balance seller-balance) total-cost) }
    )

    (ok true)
  )
)

;; Add funds to user balance
(define-public (add-funds (amount uint))
  (let
    (
      (current-balance (default-to { balance: u0 } (map-get? user-balances { user: tx-sender })))
    )
    (map-set user-balances
      { user: tx-sender }
      { balance: (+ (get balance current-balance) amount) }
    )
    (ok true)
  )
)

;; Read-only functions

;; Get listing details
(define-read-only (get-listing (listing-id uint))
  (ok (unwrap! (map-get? recycled-material-listings { listing-id: listing-id }) err-not-found))
)

;; Get user balance
(define-read-only (get-balance (user principal))
  (ok (get balance (default-to { balance: u0 } (map-get? user-balances { user: user }))))
)

;; Initialize contract
(begin
  (var-set last-listing-id u0)
)

